# Super Admin Local Authentication - Added Feature

## Overview

Added local super admin authentication that stores credentials in MongoDB instead of requiring Keycloak tokens. This provides a fallback authentication method for administrators.

## Changes Made

### Backend (`/app/backend/server.py`)

1. **Added Password Hashing Functions**:
   - `hash_password()` - Uses bcrypt to hash passwords
   - `verify_password()` - Verifies password against hash
   - `create_local_access_token()` - Creates JWT tokens for local users

2. **New Endpoint**: `POST /api/auth/local-login`
   - Accepts username and password
   - Validates against MongoDB stored credentials
   - Returns JWT access token with admin role

3. **Updated Token Validation**: `get_current_user()`
   - First tries to validate as local JWT token
   - Falls back to Keycloak JWT validation if not local
   - Supports both authentication methods simultaneously

4. **Super Admin Seeding**:
   - Automatically creates super admin on startup
   - Updates password if changed in environment variables
   - Stores hashed password in MongoDB `super_admins` collection

### Frontend (`/app/frontend/src/pages/LoginPage.js`)

1. **Tab-Based Login Interface**:
   - **Keycloak SSO** tab - OAuth login with Keycloak
   - **Super Admin** tab - Username/password form for local auth
   - **Token** tab - Manual JWT token entry

2. **New Local Login Form**:
   - Username input field
   - Password input field (with autocomplete)
   - "Login as Super Admin" button
   - Informational message about super admin access

3. **Local Login Handler**:
   - Calls `/api/auth/local-login` endpoint
   - Stores returned JWT token
   - Navigates to dashboard on success

### Environment Variables

Added to `/app/backend/.env`:

```env
# Local Super Admin (MongoDB)
SUPER_ADMIN_USERNAME="superadmin"
SUPER_ADMIN_PASSWORD="SuperAdmin2024!"
JWT_SECRET="your-jwt-secret-key-at-least-32-characters-long"
```

## Usage

### Option 1: Login with Keycloak (Existing)
1. Navigate to login page
2. Click "Keycloak SSO" tab
3. Click "Login with Keycloak" button
4. Authenticate via Keycloak

### Option 2: Login as Super Admin (New)
1. Navigate to login page
2. Click "Super Admin" tab
3. Enter username: `superadmin` (default)
4. Enter password: `SuperAdmin2024!` (default)
5. Click "Login as Super Admin"

### Option 3: Login with Token (Existing)
1. Navigate to login page
2. Click "Token" tab
3. Paste JWT token
4. Click "Login with Token"

## Security Features

1. **Password Hashing**: Uses bcrypt with salt for secure storage
2. **JWT Tokens**: Local tokens signed with HS256 algorithm
3. **Token Expiration**: 60 minutes for local tokens
4. **Auto-Update**: Password automatically updated if changed in .env
5. **Database Storage**: Credentials stored in MongoDB, not in code

## Configuration

### Change Super Admin Credentials

Update `/app/backend/.env`:

```env
SUPER_ADMIN_USERNAME="youradmin"
SUPER_ADMIN_PASSWORD="YourSecurePassword123!"
JWT_SECRET="generate-a-random-32-character-string-here"
```

Generate secure JWT secret:
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

Restart backend:
```bash
sudo supervisorctl restart backend
```

## Test Credentials

Automatically written to `/app/memory/test_credentials.md`:

```
# Test Credentials

## Local Super Admin
- Username: superadmin
- Password: SuperAdmin2024!
- Role: admin
- Auth Type: Local (MongoDB)

## API Endpoints
- POST /api/auth/local-login (username + password)
- GET /api/user/info (requires Bearer token)
```

## API Testing

### Login:
```bash
curl -X POST http://localhost:8001/api/auth/local-login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"SuperAdmin2024!"}' \
  | jq .
```

Response:
```json
{
  "access_token": "eyJhbGci...",
  "token_type": "bearer",
  "user": {
    "username": "superadmin",
    "email": "superadmin@local",
    "roles": ["admin"]
  }
}
```

### Use Token:
```bash
TOKEN="your-access-token-here"

curl -X GET http://localhost:8001/api/user/info \
  -H "Authorization: Bearer $TOKEN" \
  | jq .
```

## Kubernetes Deployment

Update `k8s/manifests.yaml` ConfigMap or Secret:

```yaml
---
# Add to ConfigMap or create new Secret
apiVersion: v1
kind: Secret
metadata:
  name: backend-secret
  namespace: k8s-maintenance
type: Opaque
stringData:
  SUPER_ADMIN_USERNAME: "youradmin"
  SUPER_ADMIN_PASSWORD: "YourSecurePassword123!"
  JWT_SECRET: "your-generated-jwt-secret-64-chars"
  KEYCLOAK_CLIENT_SECRET: "your-keycloak-secret"
```

## Benefits

1. **Fallback Authentication**: Works even if Keycloak is unavailable
2. **Quick Access**: No need to configure Keycloak for initial setup
3. **Emergency Access**: Super admin can always access the system
4. **Simple Setup**: Just username and password, no OAuth flow
5. **Flexible**: Supports both local and Keycloak auth simultaneously

## Database Schema

### Collection: `super_admins`

```javascript
{
  "_id": ObjectId("..."),
  "username": "superadmin",
  "password_hash": "$2b$12$...",  // bcrypt hash
  "created_at": ISODate("2026-04-09T...")
}
```

## Screenshots

1. **Login with Tabs**: Three authentication methods available
2. **Super Admin Form**: Username and password fields
3. **Dashboard**: Successfully logged in as superadmin@local with admin role

## Notes

- Super admin always has `admin` role
- Local tokens use HS256, Keycloak tokens use RS256
- Both token types are validated in `get_current_user()`
- Password is automatically seeded/updated on startup
- Email shown as `username@local` for local users

## Security Recommendations

1. Change default credentials immediately
2. Use strong passwords (16+ characters)
3. Rotate JWT secret periodically
4. Store .env file securely
5. Use HTTPS in production
6. Consider adding 2FA for super admin
7. Log super admin access for auditing
