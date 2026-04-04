from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import jwt
import bcrypt
import secrets
from cryptography.fernet import Fernet
import base64
import hashlib
import random
import string

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# JWT configuration
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7

# Encryption configuration
ENCRYPTION_KEY = os.environ['ENCRYPTION_KEY'].encode()
cipher_suite = Fernet(base64.urlsafe_b64encode(hashlib.sha256(ENCRYPTION_KEY).digest()))

# Password hashing
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

# Encryption functions
def encrypt_data(data: str) -> str:
    encrypted = cipher_suite.encrypt(data.encode())
    return base64.urlsafe_b64encode(encrypted).decode()

def decrypt_data(encrypted_data: str) -> str:
    decrypted = cipher_suite.decrypt(base64.urlsafe_b64decode(encrypted_data))
    return decrypted.decode()

# JWT token management
def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        "type": "access"
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        "type": "refresh"
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

# Auth helper
async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["_id"] = str(user["_id"])
        user["id"] = user["_id"]  # Add id field for consistency
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Pydantic models
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    created_at: datetime

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class SpaceCreate(BaseModel):
    name: str
    description: Optional[str] = ""

class SpaceMember(BaseModel):
    user_id: str
    role: str  # admin, editor, viewer

class SpaceAddMember(BaseModel):
    email: str
    role: str

class CredentialCreate(BaseModel):
    space_id: str
    type: str  # password, tls_cert, ssh_key, other
    title: str
    username: Optional[str] = ""
    password: Optional[str] = ""
    url: Optional[str] = ""
    notes: Optional[str] = ""
    certificate: Optional[str] = ""
    private_key: Optional[str] = ""
    custom_fields: Optional[Dict[str, str]] = {}

class CredentialUpdate(BaseModel):
    title: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    url: Optional[str] = None
    notes: Optional[str] = None
    certificate: Optional[str] = None
    private_key: Optional[str] = None
    custom_fields: Optional[Dict[str, str]] = None

class PasswordGeneratorRequest(BaseModel):
    length: int = 16
    include_uppercase: bool = True
    include_lowercase: bool = True
    include_numbers: bool = True
    include_symbols: bool = True

# Brute force protection
async def check_brute_force(identifier: str):
    attempt = await db.login_attempts.find_one({"identifier": identifier})
    if attempt:
        if attempt.get("locked_until") and attempt["locked_until"] > datetime.now(timezone.utc):
            raise HTTPException(status_code=429, detail="Too many failed attempts. Please try again later.")
        if attempt.get("count", 0) >= 5:
            locked_until = datetime.now(timezone.utc) + timedelta(minutes=15)
            await db.login_attempts.update_one(
                {"identifier": identifier},
                {"$set": {"locked_until": locked_until}}
            )
            raise HTTPException(status_code=429, detail="Too many failed attempts. Account locked for 15 minutes.")

async def increment_failed_attempt(identifier: str):
    await db.login_attempts.update_one(
        {"identifier": identifier},
        {"$inc": {"count": 1}, "$set": {"last_attempt": datetime.now(timezone.utc)}},
        upsert=True
    )

async def clear_failed_attempts(identifier: str):
    await db.login_attempts.delete_one({"identifier": identifier})

# Admin seeding
async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@vaultkeeper.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "VaultAdmin2024!")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        hashed = hash_password(admin_password)
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hashed,
            "name": "Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc)
        })
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}}
        )
    
    # Write test credentials
    os.makedirs("/app/memory", exist_ok=True)
    with open("/app/memory/test_credentials.md", "w") as f:
        f.write(f"# Test Credentials\n\n")
        f.write(f"## Admin Account\n")
        f.write(f"- Email: {admin_email}\n")
        f.write(f"- Password: {admin_password}\n")
        f.write(f"- Role: admin\n\n")
        f.write(f"## Auth Endpoints\n")
        f.write(f"- POST /api/auth/register\n")
        f.write(f"- POST /api/auth/login\n")
        f.write(f"- POST /api/auth/logout\n")
        f.write(f"- GET /api/auth/me\n")
        f.write(f"- POST /api/auth/refresh\n")

# Auth routes
@api_router.post("/auth/register")
async def register(user: UserRegister, response: Response):
    email = user.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed = hash_password(user.password)
    user_doc = {
        "email": email,
        "password_hash": hashed,
        "name": user.name,
        "role": "user",
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=900, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    
    return {
        "id": user_id,
        "email": email,
        "name": user.name,
        "role": "user",
        "created_at": user_doc["created_at"]
    }

@api_router.post("/auth/login")
async def login(credentials: UserLogin, request: Request, response: Response):
    email = credentials.email.lower()
    client_ip = request.client.host
    identifier = f"{client_ip}:{email}"
    
    await check_brute_force(identifier)
    
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(credentials.password, user["password_hash"]):
        await increment_failed_attempt(identifier)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    await clear_failed_attempts(identifier)
    
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=900, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    
    return {
        "id": user_id,
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "created_at": user["created_at"]
    }

@api_router.post("/auth/logout")
async def logout(response: Response, current_user: dict = Depends(get_current_user)):
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/")
    return {"message": "Logged out successfully"}

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

@api_router.post("/auth/refresh")
async def refresh_token(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="Refresh token not found")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        user_id = str(user["_id"])
        access_token = create_access_token(user_id, user["email"])
        response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=900, path="/")
        return {"message": "Token refreshed"}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

@api_router.post("/auth/forgot-password")
async def forgot_password(req: ForgotPasswordRequest):
    email = req.email.lower()
    user = await db.users.find_one({"email": email})
    if not user:
        return {"message": "If the email exists, a reset link will be sent"}
    
    token = secrets.token_urlsafe(32)
    await db.password_reset_tokens.insert_one({
        "token": token,
        "user_id": user["_id"],
        "expires_at": datetime.now(timezone.utc) + timedelta(hours=1),
        "used": False,
        "created_at": datetime.now(timezone.utc)
    })
    
    reset_link = f"http://localhost:3000/reset-password?token={token}"
    print(f"\n=== PASSWORD RESET LINK ===")
    print(f"Email: {email}")
    print(f"Reset Link: {reset_link}")
    print(f"Token expires in 1 hour")
    print(f"==========================\n")
    
    return {"message": "If the email exists, a reset link will be sent"}

@api_router.post("/auth/reset-password")
async def reset_password(req: ResetPasswordRequest):
    token_doc = await db.password_reset_tokens.find_one({"token": req.token})
    if not token_doc:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    if token_doc["used"]:
        raise HTTPException(status_code=400, detail="Token already used")
    if token_doc["expires_at"] < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Token expired")
    
    hashed = hash_password(req.new_password)
    await db.users.update_one(
        {"_id": token_doc["user_id"]},
        {"$set": {"password_hash": hashed}}
    )
    await db.password_reset_tokens.update_one(
        {"token": req.token},
        {"$set": {"used": True}}
    )
    
    return {"message": "Password reset successfully"}

# Space routes
@api_router.post("/spaces")
async def create_space(space: SpaceCreate, current_user: dict = Depends(get_current_user)):
    space_doc = {
        "name": space.name,
        "description": space.description,
        "owner_id": current_user["id"],
        "members": [{"user_id": current_user["id"], "role": "admin", "email": current_user["email"], "name": current_user["name"]}],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    result = await db.spaces.insert_one(space_doc)
    space_doc["_id"] = str(result.inserted_id)
    space_doc["id"] = space_doc.pop("_id")
    return space_doc

@api_router.get("/spaces")
async def get_spaces(current_user: dict = Depends(get_current_user)):
    spaces = await db.spaces.find({"members.user_id": current_user["id"]}).to_list(1000)
    for space in spaces:
        space["id"] = str(space.pop("_id"))
    return spaces

@api_router.get("/spaces/{space_id}")
async def get_space(space_id: str, current_user: dict = Depends(get_current_user)):
    try:
        space = await db.spaces.find_one({"_id": ObjectId(space_id)})
    except:
        raise HTTPException(status_code=404, detail="Space not found")
    
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
    
    # Check if user has access
    has_access = any(m["user_id"] == current_user["id"] for m in space.get("members", []))
    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied")
    
    space["_id"] = str(space["_id"])
    space["id"] = space.pop("_id")
    return space

@api_router.put("/spaces/{space_id}")
async def update_space(space_id: str, space_update: SpaceCreate, current_user: dict = Depends(get_current_user)):
    try:
        space = await db.spaces.find_one({"_id": ObjectId(space_id)})
    except:
        raise HTTPException(status_code=404, detail="Space not found")
    
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
    
    # Check if user is admin
    member = next((m for m in space.get("members", []) if m["user_id"] == current_user["id"]), None)
    if not member or member["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can update space")
    
    await db.spaces.update_one(
        {"_id": ObjectId(space_id)},
        {"$set": {"name": space_update.name, "description": space_update.description, "updated_at": datetime.now(timezone.utc)}}
    )
    return {"message": "Space updated successfully"}

@api_router.delete("/spaces/{space_id}")
async def delete_space(space_id: str, current_user: dict = Depends(get_current_user)):
    try:
        space = await db.spaces.find_one({"_id": ObjectId(space_id)})
    except:
        raise HTTPException(status_code=404, detail="Space not found")
    
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
    
    if space["owner_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only owner can delete space")
    
    await db.spaces.delete_one({"_id": ObjectId(space_id)})
    await db.credentials.delete_many({"space_id": space_id})
    return {"message": "Space deleted successfully"}

@api_router.post("/spaces/{space_id}/members")
async def add_member(space_id: str, member: SpaceAddMember, current_user: dict = Depends(get_current_user)):
    try:
        space = await db.spaces.find_one({"_id": ObjectId(space_id)})
    except:
        raise HTTPException(status_code=404, detail="Space not found")
    
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
    
    # Check if user is admin
    current_member = next((m for m in space.get("members", []) if m["user_id"] == current_user["id"]), None)
    if not current_member or current_member["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can add members")
    
    # Find user by email
    email = member.email.lower()
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_id = str(user["_id"])
    
    # Check if already a member
    if any(m["user_id"] == user_id for m in space.get("members", [])):
        raise HTTPException(status_code=400, detail="User is already a member")
    
    new_member = {
        "user_id": user_id,
        "role": member.role,
        "email": user["email"],
        "name": user["name"]
    }
    await db.spaces.update_one(
        {"_id": ObjectId(space_id)},
        {"$push": {"members": new_member}}
    )
    return {"message": "Member added successfully", "member": new_member}

@api_router.delete("/spaces/{space_id}/members/{user_id}")
async def remove_member(space_id: str, user_id: str, current_user: dict = Depends(get_current_user)):
    try:
        space = await db.spaces.find_one({"_id": ObjectId(space_id)})
    except:
        raise HTTPException(status_code=404, detail="Space not found")
    
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
    
    # Check if user is admin
    current_member = next((m for m in space.get("members", []) if m["user_id"] == current_user["id"]), None)
    if not current_member or current_member["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can remove members")
    
    # Can't remove owner
    if user_id == space["owner_id"]:
        raise HTTPException(status_code=400, detail="Cannot remove space owner")
    
    await db.spaces.update_one(
        {"_id": ObjectId(space_id)},
        {"$pull": {"members": {"user_id": user_id}}}
    )
    return {"message": "Member removed successfully"}

@api_router.put("/spaces/{space_id}/members/{user_id}/role")
async def update_member_role(space_id: str, user_id: str, role_update: dict, current_user: dict = Depends(get_current_user)):
    try:
        space = await db.spaces.find_one({"_id": ObjectId(space_id)})
    except:
        raise HTTPException(status_code=404, detail="Space not found")
    
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
    
    # Check if user is admin
    current_member = next((m for m in space.get("members", []) if m["user_id"] == current_user["id"]), None)
    if not current_member or current_member["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can update roles")
    
    # Can't change owner role
    if user_id == space["owner_id"]:
        raise HTTPException(status_code=400, detail="Cannot change owner role")
    
    new_role = role_update.get("role")
    if new_role not in ["admin", "editor", "viewer"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    await db.spaces.update_one(
        {"_id": ObjectId(space_id), "members.user_id": user_id},
        {"$set": {"members.$.role": new_role}}
    )
    return {"message": "Role updated successfully"}

# Credential routes
@api_router.post("/credentials")
async def create_credential(cred: CredentialCreate, current_user: dict = Depends(get_current_user)):
    # Check space access
    try:
        space = await db.spaces.find_one({"_id": ObjectId(cred.space_id)})
    except:
        raise HTTPException(status_code=404, detail="Space not found")
    
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
    
    member = next((m for m in space.get("members", []) if m["user_id"] == current_user["id"]), None)
    if not member:
        raise HTTPException(status_code=403, detail="Access denied")
    if member["role"] == "viewer":
        raise HTTPException(status_code=403, detail="Viewers cannot create credentials")
    
    # Encrypt sensitive data
    encrypted_data = {
        "username": encrypt_data(cred.username) if cred.username else "",
        "password": encrypt_data(cred.password) if cred.password else "",
        "url": cred.url,
        "notes": encrypt_data(cred.notes) if cred.notes else "",
        "certificate": encrypt_data(cred.certificate) if cred.certificate else "",
        "private_key": encrypt_data(cred.private_key) if cred.private_key else "",
        "custom_fields": {k: encrypt_data(v) for k, v in cred.custom_fields.items()} if cred.custom_fields else {}
    }
    
    cred_doc = {
        "space_id": cred.space_id,
        "type": cred.type,
        "title": cred.title,
        "encrypted_data": encrypted_data,
        "created_by": current_user["id"],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    result = await db.credentials.insert_one(cred_doc)
    cred_doc["_id"] = str(result.inserted_id)
    cred_doc["id"] = cred_doc.pop("_id")
    return cred_doc

@api_router.get("/credentials/{space_id}")
async def get_credentials(space_id: str, current_user: dict = Depends(get_current_user)):
    # Check space access
    try:
        space = await db.spaces.find_one({"_id": ObjectId(space_id)})
    except:
        raise HTTPException(status_code=404, detail="Space not found")
    
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
    
    member = next((m for m in space.get("members", []) if m["user_id"] == current_user["id"]), None)
    if not member:
        raise HTTPException(status_code=403, detail="Access denied")
    
    credentials = await db.credentials.find({"space_id": space_id}).to_list(1000)
    
    # Decrypt data
    for cred in credentials:
        cred["id"] = str(cred.pop("_id"))
        encrypted = cred["encrypted_data"]
        cred["decrypted_data"] = {
            "username": decrypt_data(encrypted["username"]) if encrypted.get("username") else "",
            "password": decrypt_data(encrypted["password"]) if encrypted.get("password") else "",
            "url": encrypted.get("url", ""),
            "notes": decrypt_data(encrypted["notes"]) if encrypted.get("notes") else "",
            "certificate": decrypt_data(encrypted["certificate"]) if encrypted.get("certificate") else "",
            "private_key": decrypt_data(encrypted["private_key"]) if encrypted.get("private_key") else "",
            "custom_fields": {k: decrypt_data(v) for k, v in encrypted.get("custom_fields", {}).items()}
        }
    
    return credentials

@api_router.get("/credential/{credential_id}")
async def get_credential(credential_id: str, current_user: dict = Depends(get_current_user)):
    try:
        cred = await db.credentials.find_one({"_id": ObjectId(credential_id)})
    except:
        raise HTTPException(status_code=404, detail="Credential not found")
    
    if not cred:
        raise HTTPException(status_code=404, detail="Credential not found")
    
    # Check space access
    try:
        space = await db.spaces.find_one({"_id": ObjectId(cred["space_id"])})
    except:
        raise HTTPException(status_code=404, detail="Space not found")
    
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
    
    member = next((m for m in space.get("members", []) if m["user_id"] == current_user["id"]), None)
    if not member:
        raise HTTPException(status_code=403, detail="Access denied")
    
    cred["id"] = str(cred.pop("_id"))
    encrypted = cred["encrypted_data"]
    cred["decrypted_data"] = {
        "username": decrypt_data(encrypted["username"]) if encrypted.get("username") else "",
        "password": decrypt_data(encrypted["password"]) if encrypted.get("password") else "",
        "url": encrypted.get("url", ""),
        "notes": decrypt_data(encrypted["notes"]) if encrypted.get("notes") else "",
        "certificate": decrypt_data(encrypted["certificate"]) if encrypted.get("certificate") else "",
        "private_key": decrypt_data(encrypted["private_key"]) if encrypted.get("private_key") else "",
        "custom_fields": {k: decrypt_data(v) for k, v in encrypted.get("custom_fields", {}).items()}
    }
    
    return cred

@api_router.put("/credential/{credential_id}")
async def update_credential(credential_id: str, cred_update: CredentialUpdate, current_user: dict = Depends(get_current_user)):
    try:
        cred = await db.credentials.find_one({"_id": ObjectId(credential_id)})
    except:
        raise HTTPException(status_code=404, detail="Credential not found")
    
    if not cred:
        raise HTTPException(status_code=404, detail="Credential not found")
    
    # Check space access
    try:
        space = await db.spaces.find_one({"_id": ObjectId(cred["space_id"])})
    except:
        raise HTTPException(status_code=404, detail="Space not found")
    
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
    
    member = next((m for m in space.get("members", []) if m["user_id"] == current_user["id"]), None)
    if not member:
        raise HTTPException(status_code=403, detail="Access denied")
    if member["role"] == "viewer":
        raise HTTPException(status_code=403, detail="Viewers cannot update credentials")
    
    # Build update dict
    update_dict = {}
    if cred_update.title is not None:
        update_dict["title"] = cred_update.title
    
    encrypted_data = cred["encrypted_data"]
    if cred_update.username is not None:
        encrypted_data["username"] = encrypt_data(cred_update.username) if cred_update.username else ""
    if cred_update.password is not None:
        encrypted_data["password"] = encrypt_data(cred_update.password) if cred_update.password else ""
    if cred_update.url is not None:
        encrypted_data["url"] = cred_update.url
    if cred_update.notes is not None:
        encrypted_data["notes"] = encrypt_data(cred_update.notes) if cred_update.notes else ""
    if cred_update.certificate is not None:
        encrypted_data["certificate"] = encrypt_data(cred_update.certificate) if cred_update.certificate else ""
    if cred_update.private_key is not None:
        encrypted_data["private_key"] = encrypt_data(cred_update.private_key) if cred_update.private_key else ""
    if cred_update.custom_fields is not None:
        encrypted_data["custom_fields"] = {k: encrypt_data(v) for k, v in cred_update.custom_fields.items()}
    
    update_dict["encrypted_data"] = encrypted_data
    update_dict["updated_at"] = datetime.now(timezone.utc)
    
    await db.credentials.update_one({"_id": ObjectId(credential_id)}, {"$set": update_dict})
    return {"message": "Credential updated successfully"}

@api_router.delete("/credential/{credential_id}")
async def delete_credential(credential_id: str, current_user: dict = Depends(get_current_user)):
    try:
        cred = await db.credentials.find_one({"_id": ObjectId(credential_id)})
    except:
        raise HTTPException(status_code=404, detail="Credential not found")
    
    if not cred:
        raise HTTPException(status_code=404, detail="Credential not found")
    
    # Check space access
    try:
        space = await db.spaces.find_one({"_id": ObjectId(cred["space_id"])})
    except:
        raise HTTPException(status_code=404, detail="Space not found")
    
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
    
    member = next((m for m in space.get("members", []) if m["user_id"] == current_user["id"]), None)
    if not member:
        raise HTTPException(status_code=403, detail="Access denied")
    if member["role"] == "viewer":
        raise HTTPException(status_code=403, detail="Viewers cannot delete credentials")
    
    await db.credentials.delete_one({"_id": ObjectId(credential_id)})
    return {"message": "Credential deleted successfully"}

# Password generator
@api_router.post("/password-generator")
async def generate_password(req: PasswordGeneratorRequest, current_user: dict = Depends(get_current_user)):
    chars = ""
    if req.include_lowercase:
        chars += string.ascii_lowercase
    if req.include_uppercase:
        chars += string.ascii_uppercase
    if req.include_numbers:
        chars += string.digits
    if req.include_symbols:
        chars += "!@#$%^&*()_+-=[]{}|;:,.<>?"
    
    if not chars:
        raise HTTPException(status_code=400, detail="At least one character type must be selected")
    
    password = ''.join(random.choice(chars) for _ in range(req.length))
    return {"password": password}

# Export/Import
@api_router.get("/export/{space_id}")
async def export_credentials(space_id: str, current_user: dict = Depends(get_current_user)):
    # Check space access
    try:
        space = await db.spaces.find_one({"_id": ObjectId(space_id)})
    except:
        raise HTTPException(status_code=404, detail="Space not found")
    
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
    
    member = next((m for m in space.get("members", []) if m["user_id"] == current_user["id"]), None)
    if not member:
        raise HTTPException(status_code=403, detail="Access denied")
    
    credentials = await db.credentials.find({"space_id": space_id}).to_list(1000)
    
    export_data = []
    for cred in credentials:
        encrypted = cred["encrypted_data"]
        export_data.append({
            "type": cred["type"],
            "title": cred["title"],
            "username": decrypt_data(encrypted["username"]) if encrypted.get("username") else "",
            "password": decrypt_data(encrypted["password"]) if encrypted.get("password") else "",
            "url": encrypted.get("url", ""),
            "notes": decrypt_data(encrypted["notes"]) if encrypted.get("notes") else "",
            "certificate": decrypt_data(encrypted["certificate"]) if encrypted.get("certificate") else "",
            "private_key": decrypt_data(encrypted["private_key"]) if encrypted.get("private_key") else "",
            "custom_fields": {k: decrypt_data(v) for k, v in encrypted.get("custom_fields", {}).items()}
        })
    
    return {"space_name": space["name"], "credentials": export_data, "exported_at": datetime.now(timezone.utc)}

@api_router.post("/import/{space_id}")
async def import_credentials(space_id: str, import_data: dict, current_user: dict = Depends(get_current_user)):
    # Check space access
    try:
        space = await db.spaces.find_one({"_id": ObjectId(space_id)})
    except:
        raise HTTPException(status_code=404, detail="Space not found")
    
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
    
    member = next((m for m in space.get("members", []) if m["user_id"] == current_user["id"]), None)
    if not member:
        raise HTTPException(status_code=403, detail="Access denied")
    if member["role"] == "viewer":
        raise HTTPException(status_code=403, detail="Viewers cannot import credentials")
    
    credentials = import_data.get("credentials", [])
    imported_count = 0
    
    for cred_data in credentials:
        encrypted_data = {
            "username": encrypt_data(cred_data.get("username", "")) if cred_data.get("username") else "",
            "password": encrypt_data(cred_data.get("password", "")) if cred_data.get("password") else "",
            "url": cred_data.get("url", ""),
            "notes": encrypt_data(cred_data.get("notes", "")) if cred_data.get("notes") else "",
            "certificate": encrypt_data(cred_data.get("certificate", "")) if cred_data.get("certificate") else "",
            "private_key": encrypt_data(cred_data.get("private_key", "")) if cred_data.get("private_key") else "",
            "custom_fields": {k: encrypt_data(v) for k, v in cred_data.get("custom_fields", {}).items()}
        }
        
        cred_doc = {
            "space_id": space_id,
            "type": cred_data.get("type", "password"),
            "title": cred_data.get("title", "Imported Credential"),
            "encrypted_data": encrypted_data,
            "created_by": current_user["id"],
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        await db.credentials.insert_one(cred_doc)
        imported_count += 1
    
    return {"message": f"Successfully imported {imported_count} credentials"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.login_attempts.create_index("identifier")
    await db.spaces.create_index("owner_id")
    await db.spaces.create_index("members.user_id")
    await db.credentials.create_index("space_id")
    
    # Seed admin
    await seed_admin()
    logger.info("Application started successfully")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()