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

security = HTTPBearer()

# Pydantic models
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
    ip_allowlist: List[str]
    
    @field_validator('ip_allowlist')
    def validate_ips(cls, v):
        for ip in v:
            try:
                ipaddress.ip_network(ip, strict=False)
            except ValueError:
                raise ValueError(f"Invalid IP address or range: {ip}")
        return v

class Application(BaseModel):
    id: str
    name: str
    namespace: str
    ip_allowlist: List[str] = []
    enabled: bool = True
    created_at: datetime
    updated_at: datetime
    created_by: str

# Keycloak token validation
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    token = credentials.credentials
    
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
async def create_traefik_middleware(name: str, namespace: str, ip_allowlist: List[str]):
    if not k8s_custom_api:
        raise HTTPException(status_code=500, detail="Kubernetes client not configured")
    
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
        raise HTTPException(status_code=500, detail="Kubernetes client not configured")
    
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
        raise HTTPException(status_code=500, detail="Kubernetes client not configured")
    
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

@api_router.get("/user/info")
async def get_user_info(user: Dict = Depends(get_current_user)):
    return user

@api_router.get("/namespaces")
async def list_namespaces(user: Dict = Depends(require_role(["admin", "user", "readonly"]))):
    namespaces = await get_k8s_namespaces()
    return {"namespaces": namespaces}

@api_router.get("/applications")
async def list_applications(user: Dict = Depends(require_role(["admin", "user", "readonly"]))):
    apps = await db.applications.find({}).to_list(1000)
    for app in apps:
        app["id"] = str(app.pop("_id"))
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
        app = await db.applications.find_one({"_id": ObjectId(app_id)})
    except:
        raise HTTPException(status_code=404, detail="Application not found")
    
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    app["id"] = str(app.pop("_id"))
    return app

@api_router.put("/applications/{app_id}")
async def update_application(
    app_id: str,
    app_update: ApplicationUpdate,
    user: Dict = Depends(require_role(["admin", "user"]))
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
            "ip_allowlist": app_update.ip_allowlist,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    # Update Traefik Middleware in Kubernetes
    ip_list = app_update.ip_allowlist if app.get("enabled", True) else ["0.0.0.0/0"]
    await update_traefik_middleware(app["name"], app["namespace"], ip_list)
    
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
    ip_list = app.get("ip_allowlist", []) if enabled else ["0.0.0.0/0"]
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
    logger.info("Application started successfully")

@app.on_event("shutdown")
async def shutdown_event():
    client_mongo.close()
