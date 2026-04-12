from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from bson import ObjectId
import ipaddress
import urllib.parse
import re
from jose import jwt, JWTError
import requests
import bcrypt
from kubernetes import client, config
from kubernetes.client.rest import ApiException

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client_mongo = AsyncIOMotorClient(mongo_url)
db = client_mongo[os.environ['DB_NAME']]

# Kubernetes client
try:
    if os.environ.get('IN_CLUSTER', 'false').lower() == 'true':
        config.load_incluster_config()
    else:
        config.load_kube_config()
    k8s_custom_api = client.CustomObjectsApi()
    k8s_core_api = client.CoreV1Api()
except Exception as e:
    logging.warning(f"Kubernetes config not loaded: {e}")
    k8s_custom_api = None
    k8s_core_api = None

# FastAPI app
app = FastAPI(title="K8s Maintenance Manager")
api_router = APIRouter(prefix="/api")

# Keycloak configuration
KEYCLOAK_SERVER_URL = os.environ.get('KEYCLOAK_SERVER_URL')
KEYCLOAK_REALM = os.environ.get('KEYCLOAK_REALM')
KEYCLOAK_CLIENT_ID = os.environ.get('KEYCLOAK_CLIENT_ID')

# Local super admin configuration
SUPER_ADMIN_USERNAME = os.environ.get('SUPER_ADMIN_USERNAME', 'superadmin')
SUPER_ADMIN_PASSWORD = os.environ.get('SUPER_ADMIN_PASSWORD')
LOCAL_JWT_SECRET = os.environ.get('JWT_SECRET')
LOCAL_JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

security = HTTPBearer()

# Pydantic models
class LocalLoginRequest(BaseModel):
    username: str
    password: str

class IPTemplateCreate(BaseModel):
    name: str
    value: str
    description: Optional[str] = ""
    
    @field_validator('value')
    def validate_ip_or_range(cls, v):
        try:
            ipaddress.ip_network(v, strict=False)
            return v
        except ValueError:
            raise ValueError(f"Invalid IP address or range: {v}")

class IPTemplateUpdate(BaseModel):
    name: Optional[str] = None
    value: Optional[str] = None
    description: Optional[str] = None

    @field_validator('value')
    def validate_ip_or_range(cls, v):
        if v is None:
            return v
        try:
            ipaddress.ip_network(v, strict=False)
            return v
        except ValueError:
            raise ValueError(f"Invalid IP address or range: {v}")

class IPAllowlistEntry(BaseModel):
    type: str  # "manual" or "template"
    value: str
    template_id: Optional[str] = None
    template_name: Optional[str] = None

class IPAllowlistItem(BaseModel):
    value: str
    
    @field_validator('value')
    def validate_ip_or_range(cls, v):
        try:
            # Try to parse as IP network (supports both single IP and CIDR)
            ipaddress.ip_network(v, strict=False)
            return v
        except ValueError:
            raise ValueError(f"Invalid IP address or range: {v}")

class ApplicationCreate(BaseModel):
    name: str
    namespace: str
    
    @field_validator('name')
    def validate_name(cls, v):
        if not re.match(r'^[a-z0-9]([-a-z0-9]*[a-z0-9])?$', v):
            raise ValueError("Name must be lowercase alphanumeric with hyphens")
        return v

class ApplicationUpdate(BaseModel):
    ip_allowlist: List[Dict[str, Any]]
    
    @field_validator('ip_allowlist')
    def validate_entries(cls, v):
        for entry in v:
            entry_type = entry.get("type")
            if entry_type not in ("manual", "template"):
                raise ValueError(f"Invalid entry type: {entry_type}")
            ip_val = entry.get("value", "")
            if ip_val:
                try:
                    ipaddress.ip_network(ip_val, strict=False)
                except ValueError:
                    raise ValueError(f"Invalid IP address or range: {ip_val}")
        return v

class Application(BaseModel):
    id: str
    name: str
    namespace: str
    ip_allowlist: List[Dict[str, Any]] = []
    enabled: bool = True
    created_at: datetime
    updated_at: datetime
    created_by: str

# Password hashing functions
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

# Local JWT token creation
def create_local_access_token(username: str, roles: List[str]) -> str:
    from datetime import datetime, timezone, timedelta
    payload = {
        "sub": username,
        "username": username,
        "roles": roles,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        "type": "local"
    }
    return jwt.encode(payload, LOCAL_JWT_SECRET, algorithm=LOCAL_JWT_ALGORITHM)

# Keycloak token validation
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    token = credentials.credentials
    
    # Try local JWT first
    try:
        payload = jwt.decode(token, LOCAL_JWT_SECRET, algorithms=[LOCAL_JWT_ALGORITHM])
        if payload.get("type") == "local":
            # Local super admin token
            return {
                "sub": payload.get("username"),
                "username": payload.get("username"),
                "email": f"{payload.get('username')}@local",
                "roles": payload.get("roles", ["admin"])
            }
    except JWTError:
        pass  # Not a local token, try Keycloak
    
    # Try Keycloak token
    try:
        # Get Keycloak public key
        jwks_url = f"{KEYCLOAK_SERVER_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/certs"
        jwks_response = requests.get(jwks_url)
        jwks = jwks_response.json()
        
        # Decode token
        unverified_header = jwt.get_unverified_header(token)
        rsa_key = {}
        for key in jwks["keys"]:
            if key["kid"] == unverified_header["kid"]:
                rsa_key = {
                    "kty": key["kty"],
                    "kid": key["kid"],
                    "use": key["use"],
                    "n": key["n"],
                    "e": key["e"]
                }
        
        if rsa_key:
            payload = jwt.decode(
                token,
                rsa_key,
                algorithms=["RS256"],
                audience=KEYCLOAK_CLIENT_ID,
                options={"verify_aud": False}  # Set to True in production
            )
            
            # Extract roles from token
            roles = []
            if "realm_access" in payload and "roles" in payload["realm_access"]:
                roles = payload["realm_access"]["roles"]
            if "resource_access" in payload and KEYCLOAK_CLIENT_ID in payload["resource_access"]:
                client_roles = payload["resource_access"][KEYCLOAK_CLIENT_ID].get("roles", [])
                roles.extend(client_roles)
            
            return {
                "sub": payload.get("sub"),
                "username": payload.get("preferred_username"),
                "email": payload.get("email"),
                "roles": roles
            }
        raise HTTPException(status_code=401, detail="Unable to validate credentials")
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid authentication credentials: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication error: {str(e)}")

# Role-based access control
def require_role(required_roles: List[str]):
    async def role_checker(user: Dict = Depends(get_current_user)):
        user_roles = user.get("roles", [])
        if not any(role in user_roles for role in required_roles):
            raise HTTPException(
                status_code=403,
                detail=f"Insufficient permissions. Required roles: {required_roles}"
            )
        return user
    return role_checker

# Kubernetes operations
def extract_ip_values(ip_allowlist: List[Dict[str, Any]]) -> List[str]:
    """Extract raw IP values from the structured allowlist for K8s middleware."""
    return [entry.get("value", "") for entry in ip_allowlist if entry.get("value")]

async def resolve_template_values(ip_allowlist: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Resolve template entries to get current template values."""
    resolved = []
    for entry in ip_allowlist:
        if entry.get("type") == "template" and entry.get("template_id"):
            try:
                template = await db.ip_templates.find_one({"_id": ObjectId(entry["template_id"])})
                if template:
                    resolved.append({
                        "type": "template",
                        "value": template["value"],
                        "template_id": entry["template_id"],
                        "template_name": template["name"]
                    })
                else:
                    # Template deleted, keep as manual
                    resolved.append({
                        "type": "manual",
                        "value": entry.get("value", "")
                    })
            except Exception:
                resolved.append(entry)
        else:
            resolved.append(entry)
    return resolved

async def create_traefik_middleware(name: str, namespace: str, ip_allowlist: List[str]):
    if not k8s_custom_api:
        logger.warning(f"Kubernetes client not configured. Skipping middleware creation for {name}")
        return
    
    # URL encode the name for middleware
    middleware_name = urllib.parse.quote(name, safe='')
    
    middleware = {
        "apiVersion": "traefik.io/v1alpha1",
        "kind": "Middleware",
        "metadata": {
            "name": middleware_name,
            "namespace": namespace
        },
        "spec": {
            "ipAllowList": {
                "sourceRange": ip_allowlist if ip_allowlist else ["0.0.0.0/0"]
            }
        }
    }
    
    try:
        k8s_custom_api.create_namespaced_custom_object(
            group="traefik.io",
            version="v1alpha1",
            namespace=namespace,
            plural="middlewares",
            body=middleware
        )
    except ApiException as e:
        if e.status == 409:  # Already exists, update it
            k8s_custom_api.patch_namespaced_custom_object(
                group="traefik.io",
                version="v1alpha1",
                namespace=namespace,
                plural="middlewares",
                name=middleware_name,
                body=middleware
            )
        else:
            raise HTTPException(status_code=500, detail=f"Kubernetes API error: {e}")

async def update_traefik_middleware(name: str, namespace: str, ip_allowlist: List[str]):
    if not k8s_custom_api:
        logger.warning(f"Kubernetes client not configured. Skipping middleware update for {name}")
        return
    
    middleware_name = urllib.parse.quote(name, safe='')
    
    middleware = {
        "apiVersion": "traefik.io/v1alpha1",
        "kind": "Middleware",
        "metadata": {
            "name": middleware_name,
            "namespace": namespace
        },
        "spec": {
            "ipAllowList": {
                "sourceRange": ip_allowlist if ip_allowlist else ["0.0.0.0/0"]
            }
        }
    }
    
    try:
        k8s_custom_api.patch_namespaced_custom_object(
            group="traefik.io",
            version="v1alpha1",
            namespace=namespace,
            plural="middlewares",
            name=middleware_name,
            body=middleware
        )
    except ApiException as e:
        raise HTTPException(status_code=500, detail=f"Kubernetes API error: {e}")

async def delete_traefik_middleware(name: str, namespace: str):
    if not k8s_custom_api:
        logger.warning(f"Kubernetes client not configured. Skipping middleware deletion for {name}")
        return
    
    middleware_name = urllib.parse.quote(name, safe='')
    
    try:
        k8s_custom_api.delete_namespaced_custom_object(
            group="traefik.io",
            version="v1alpha1",
            namespace=namespace,
            plural="middlewares",
            name=middleware_name
        )
    except ApiException as e:
        if e.status != 404:  # Ignore if not found
            raise HTTPException(status_code=500, detail=f"Kubernetes API error: {e}")

async def get_k8s_namespaces() -> List[str]:
    if not k8s_core_api:
        return []
    
    try:
        namespaces = k8s_core_api.list_namespace()
        return [ns.metadata.name for ns in namespaces.items]
    except ApiException as e:
        logging.error(f"Failed to list namespaces: {e}")
        return []

# API Routes
@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "kubernetes": k8s_custom_api is not None}

@api_router.post("/auth/local-login")
async def local_login(credentials: LocalLoginRequest):
    """Login with local super admin credentials"""
    # Check super admin from database
    admin_user = await db.super_admins.find_one({"username": credentials.username})
    
    if not admin_user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    if not verify_password(credentials.password, admin_user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    # Create local JWT token
    access_token = create_local_access_token(
        username=admin_user["username"],
        roles=["admin"]  # Super admin always has admin role
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "username": admin_user["username"],
            "email": f"{admin_user['username']}@local",
            "roles": ["admin"]
        }
    }

@api_router.get("/user/info")
async def get_user_info(user: Dict = Depends(get_current_user)):
    return user

@api_router.get("/namespaces")
async def list_namespaces(user: Dict = Depends(require_role(["admin", "user", "readonly"]))):
    namespaces = await get_k8s_namespaces()
    return {"namespaces": namespaces}

# IP Templates Routes
@api_router.get("/ip-templates")
async def list_ip_templates(user: Dict = Depends(require_role(["admin", "user", "readonly"]))):
    """List all saved IP templates"""
    templates = await db.ip_templates.find({}).to_list(1000)
    for template in templates:
        template["id"] = str(template.pop("_id"))
    return {"templates": templates}

@api_router.post("/ip-templates")
async def create_ip_template(
    template: IPTemplateCreate,
    user: Dict = Depends(require_role(["admin", "user"]))
):
    """Create a new IP template"""
    # Check if name already exists
    existing = await db.ip_templates.find_one({"name": template.name})
    if existing:
        raise HTTPException(status_code=400, detail=f"Template with name '{template.name}' already exists")
    
    template_doc = {
        "name": template.name,
        "value": template.value,
        "description": template.description,
        "created_by": user.get("username"),
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.ip_templates.insert_one(template_doc)
    template_doc["id"] = str(result.inserted_id)
    template_doc.pop("_id", None)
    return template_doc

@api_router.delete("/ip-templates/{template_id}")
async def delete_ip_template(
    template_id: str,
    user: Dict = Depends(require_role(["admin", "user"]))
):
    """Delete an IP template. Linked entries become manual."""
    try:
        template = await db.ip_templates.find_one({"_id": ObjectId(template_id)})
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")

        # Convert linked entries to manual in all applications
        apps_using = await db.applications.find(
            {"ip_allowlist.template_id": template_id}
        ).to_list(1000)

        for app_doc in apps_using:
            updated_list = []
            for entry in app_doc.get("ip_allowlist", []):
                if entry.get("template_id") == template_id:
                    updated_list.append({"type": "manual", "value": entry.get("value", "")})
                else:
                    updated_list.append(entry)
            await db.applications.update_one(
                {"_id": app_doc["_id"]},
                {"$set": {"ip_allowlist": updated_list, "updated_at": datetime.now(timezone.utc)}}
            )

        await db.ip_templates.delete_one({"_id": ObjectId(template_id)})
        return {"message": "Template deleted successfully", "affected_apps": len(apps_using)}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=404, detail="Template not found")

@api_router.put("/ip-templates/{template_id}")
async def update_ip_template(
    template_id: str,
    template_update: IPTemplateUpdate,
    user: Dict = Depends(require_role(["admin", "user"]))
):
    """Update an IP template and propagate changes to all linked applications."""
    try:
        template = await db.ip_templates.find_one({"_id": ObjectId(template_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Template not found")

    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Build update dict
    update_fields = {}
    if template_update.name is not None:
        # Check name uniqueness
        existing = await db.ip_templates.find_one({"name": template_update.name, "_id": {"$ne": ObjectId(template_id)}})
        if existing:
            raise HTTPException(status_code=400, detail=f"Template name '{template_update.name}' already exists")
        update_fields["name"] = template_update.name
    if template_update.value is not None:
        update_fields["value"] = template_update.value
    if template_update.description is not None:
        update_fields["description"] = template_update.description

    if not update_fields:
        return {"message": "Nothing to update"}

    update_fields["updated_at"] = datetime.now(timezone.utc)

    # Update the template
    await db.ip_templates.update_one(
        {"_id": ObjectId(template_id)},
        {"$set": update_fields}
    )

    new_name = update_fields.get("name", template["name"])
    new_value = update_fields.get("value", template["value"])

    # Propagate changes to all applications using this template
    apps_using = await db.applications.find(
        {"ip_allowlist.template_id": template_id}
    ).to_list(1000)

    affected_apps = []
    for app_doc in apps_using:
        updated_list = []
        changed = False
        for entry in app_doc.get("ip_allowlist", []):
            if entry.get("template_id") == template_id:
                updated_list.append({
                    "type": "template",
                    "value": new_value,
                    "template_id": template_id,
                    "template_name": new_name
                })
                changed = True
            else:
                updated_list.append(entry)

        if changed:
            await db.applications.update_one(
                {"_id": app_doc["_id"]},
                {"$set": {"ip_allowlist": updated_list, "updated_at": datetime.now(timezone.utc)}}
            )

            # Re-apply K8s middleware if app is enabled
            if app_doc.get("enabled", True):
                ip_values = extract_ip_values(updated_list)
                try:
                    await update_traefik_middleware(app_doc["name"], app_doc["namespace"], ip_values)
                except Exception as e:
                    logger.error(f"Failed to update K8s middleware for {app_doc['name']}: {e}")

            affected_apps.append(app_doc["name"])

    return {
        "message": "Template updated successfully",
        "affected_apps": affected_apps
    }

@api_router.get("/ip-templates/usage")
async def get_template_usage(user: Dict = Depends(require_role(["admin", "user", "readonly"]))):
    """Get usage count for each template (how many apps link to it)."""
    templates = await db.ip_templates.find({}).to_list(1000)
    usage = {}
    for t in templates:
        tid = str(t["_id"])
        count = await db.applications.count_documents({"ip_allowlist.template_id": tid})
        usage[tid] = count
    return {"usage": usage}

@api_router.get("/applications/{app_id}/yaml")
async def get_application_yaml(
    app_id: str,
    user: Dict = Depends(require_role(["admin", "user", "readonly"]))
):
    """Generate the final Traefik Middleware YAML for an application."""
    import yaml
    try:
        app_doc = await db.applications.find_one({"_id": ObjectId(app_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Application not found")

    if not app_doc:
        raise HTTPException(status_code=404, detail="Application not found")

    resolved = await resolve_template_values(app_doc.get("ip_allowlist", []))
    ip_values = extract_ip_values(resolved) or ["0.0.0.0/0"]

    middleware_name = urllib.parse.quote(app_doc["name"], safe='')
    middleware = {
        "apiVersion": "traefik.io/v1alpha1",
        "kind": "Middleware",
        "metadata": {
            "name": middleware_name,
            "namespace": app_doc["namespace"]
        },
        "spec": {
            "ipAllowList": {
                "sourceRange": ip_values
            }
        }
    }

    yaml_str = yaml.dump(middleware, default_flow_style=False, sort_keys=False)
    return {"yaml": yaml_str, "name": app_doc["name"], "namespace": app_doc["namespace"]}

@api_router.get("/applications")
async def list_applications(user: Dict = Depends(require_role(["admin", "user", "readonly"]))):
    apps = await db.applications.find({}).to_list(1000)
    for app_doc in apps:
        app_doc["id"] = str(app_doc.pop("_id"))
        # Resolve template values to ensure they're up to date
        app_doc["ip_allowlist"] = await resolve_template_values(app_doc.get("ip_allowlist", []))
    return {"applications": apps}

@api_router.post("/applications")
async def create_application(
    app_data: ApplicationCreate,
    user: Dict = Depends(require_role(["admin"]))
):
    # Check if namespace exists
    namespaces = await get_k8s_namespaces()
    if app_data.namespace not in namespaces:
        raise HTTPException(status_code=400, detail=f"Namespace '{app_data.namespace}' does not exist")
    
    # Check if application already exists
    existing = await db.applications.find_one({"name": app_data.name, "namespace": app_data.namespace})
    if existing:
        raise HTTPException(status_code=400, detail="Application already exists")
    
    # Create in MongoDB
    app_doc = {
        "name": app_data.name,
        "namespace": app_data.namespace,
        "ip_allowlist": [],
        "enabled": True,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "created_by": user.get("username")
    }
    result = await db.applications.insert_one(app_doc)
    
    # Create Traefik Middleware in Kubernetes
    await create_traefik_middleware(app_data.name, app_data.namespace, [])
    
    app_doc["id"] = str(result.inserted_id)
    app_doc.pop("_id", None)
    return app_doc

@api_router.get("/applications/{app_id}")
async def get_application(
    app_id: str,
    user: Dict = Depends(require_role(["admin", "user", "readonly"]))
):
    try:
        app_doc = await db.applications.find_one({"_id": ObjectId(app_id)})
    except:
        raise HTTPException(status_code=404, detail="Application not found")
    
    if not app_doc:
        raise HTTPException(status_code=404, detail="Application not found")
    
    app_doc["id"] = str(app_doc.pop("_id"))
    app_doc["ip_allowlist"] = await resolve_template_values(app_doc.get("ip_allowlist", []))
    return app_doc

@api_router.put("/applications/{app_id}")
async def update_application(
    app_id: str,
    app_update: ApplicationUpdate,
    user: Dict = Depends(require_role(["admin", "user"]))
):
    try:
        app_doc = await db.applications.find_one({"_id": ObjectId(app_id)})
    except:
        raise HTTPException(status_code=404, detail="Application not found")
    
    if not app_doc:
        raise HTTPException(status_code=404, detail="Application not found")
    
    # Resolve template values before storing
    resolved_list = await resolve_template_values(app_update.ip_allowlist)

    # Update in MongoDB
    await db.applications.update_one(
        {"_id": ObjectId(app_id)},
        {"$set": {
            "ip_allowlist": resolved_list,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    # Update Traefik Middleware in Kubernetes
    ip_values = extract_ip_values(resolved_list) if app_doc.get("enabled", True) else ["0.0.0.0/0"]
    await update_traefik_middleware(app_doc["name"], app_doc["namespace"], ip_values)
    
    return {"message": "Application updated successfully"}

@api_router.delete("/applications/{app_id}")
async def delete_application(
    app_id: str,
    user: Dict = Depends(require_role(["admin"]))
):
    try:
        app = await db.applications.find_one({"_id": ObjectId(app_id)})
    except:
        raise HTTPException(status_code=404, detail="Application not found")
    
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    # Delete from Kubernetes
    await delete_traefik_middleware(app["name"], app["namespace"])
    
    # Delete from MongoDB
    await db.applications.delete_one({"_id": ObjectId(app_id)})
    
    return {"message": "Application deleted successfully"}

@api_router.post("/applications/{app_id}/toggle")
async def toggle_application(
    app_id: str,
    enabled: bool,
    user: Dict = Depends(require_role(["admin"]))
):
    try:
        app = await db.applications.find_one({"_id": ObjectId(app_id)})
    except:
        raise HTTPException(status_code=404, detail="Application not found")
    
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    # Update in MongoDB
    await db.applications.update_one(
        {"_id": ObjectId(app_id)},
        {"$set": {
            "enabled": enabled,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    # Update Traefik Middleware in Kubernetes
    ip_list = extract_ip_values(app.get("ip_allowlist", [])) if enabled else ["0.0.0.0/0"]
    await update_traefik_middleware(app["name"], app["namespace"], ip_list)
    
    return {"message": f"Application {'enabled' if enabled else 'disabled'} successfully"}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    # Create indexes
    await db.applications.create_index([("name", 1), ("namespace", 1)], unique=True)
    await db.super_admins.create_index("username", unique=True)
    await db.ip_templates.create_index("name", unique=True)
    
    # Seed super admin
    if SUPER_ADMIN_USERNAME and SUPER_ADMIN_PASSWORD:
        existing_admin = await db.super_admins.find_one({"username": SUPER_ADMIN_USERNAME})
        if not existing_admin:
            # Create new super admin
            admin_doc = {
                "username": SUPER_ADMIN_USERNAME,
                "password_hash": hash_password(SUPER_ADMIN_PASSWORD),
                "created_at": datetime.now(timezone.utc)
            }
            await db.super_admins.insert_one(admin_doc)
            logger.info(f"Super admin created: {SUPER_ADMIN_USERNAME}")
        else:
            # Update password if changed
            if not verify_password(SUPER_ADMIN_PASSWORD, existing_admin["password_hash"]):
                await db.super_admins.update_one(
                    {"username": SUPER_ADMIN_USERNAME},
                    {"$set": {"password_hash": hash_password(SUPER_ADMIN_PASSWORD)}}
                )
                logger.info(f"Super admin password updated: {SUPER_ADMIN_USERNAME}")
    
    # Write test credentials
    os.makedirs("/app/memory", exist_ok=True)
    with open("/app/memory/test_credentials.md", "w") as f:
        f.write("# Test Credentials\n\n")
        f.write("## Local Super Admin\n")
        f.write(f"- Username: {SUPER_ADMIN_USERNAME}\n")
        f.write(f"- Password: {SUPER_ADMIN_PASSWORD}\n")
        f.write("- Role: admin\n")
        f.write("- Auth Type: Local (MongoDB)\n\n")
        f.write("## API Endpoints\n")
        f.write("- POST /api/auth/local-login (username + password)\n")
        f.write("- GET /api/user/info (requires Bearer token)\n")
    
    logger.info("Application started successfully")

@app.on_event("shutdown")
async def shutdown_event():
    client_mongo.close()
