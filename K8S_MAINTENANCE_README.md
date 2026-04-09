# K8s Maintenance Manager - Complete Documentation

A professional web application to manage Traefik Middleware IP allowlists in Kubernetes clusters with Keycloak authentication.

## 🎯 Overview

This application allows you to:
- Manage Traefik Middleware IP allowlists through a web interface
- Authenticate users via Keycloak SSO
- Apply role-based access control (admin, user, readonly)
- Automatically create/update/delete Kubernetes resources
- Enable/disable IP restrictions with one click

## 📦 What's Included

### Complete Application
- ✅ **Backend**: FastAPI with Keycloak auth, MongoDB storage, K8s integration
- ✅ **Frontend**: React dashboard with dark professional theme
- ✅ **Docker**: Production-ready Dockerfiles for both services
- ✅ **Kubernetes**: Complete manifests with RBAC, ServiceAccount, Deployments
- ✅ **Documentation**: Comprehensive setup and deployment guides

### Key Features
1. **Keycloak Integration**: Enterprise SSO with JWT validation
2. **Role-Based Access**:
   - **admin**: Full CRUD + enable/disable
   - **user**: Update existing applications only
   - **readonly**: View-only access
3. **IP Validation**: Real-time validation of IPs and CIDR ranges
4. **K8s Native**: Uses ServiceAccount to manage Traefik Middlewares
5. **Professional UI**: Dark theme, data tables, responsive design

## 🚀 Quick Start Guide

### Step 1: Keycloak Setup

1. **Create Realm**: `maintenance` (or your preferred name)

2. **Create Client**:
   - Client ID: `k8s-maintenance-app`
   - Client Protocol: `openid-connect`
   - Access Type: `confidential`
   - Standard Flow: Enabled
   - Valid Redirect URIs: `https://your-app-domain.com/*`
   - Web Origins: `https://your-app-domain.com`

3. **Create Roles** (Realm roles or Client roles):
   - `admin`
   - `user`
   - `readonly`

4. **Create Test Users**:
   - Create users in Keycloak
   - Assign appropriate roles
   - Set passwords

5. **Get Client Secret**:
   - Go to Clients → k8s-maintenance-app → Credentials tab
   - Copy the Secret

### Step 2: Build Docker Images

```bash
# Clone or navigate to your project directory
cd /path/to/k8s-maintenance

# Build backend
cd backend
docker build -t your-registry.com/k8s-maintenance-backend:v1.0.0 .
docker push your-registry.com/k8s-maintenance-backend:v1.0.0

# Build frontend
cd ../frontend
docker build -t your-registry.com/k8s-maintenance-frontend:v1.0.0 .
docker push your-registry.com/k8s-maintenance-frontend:v1.0.0
```

### Step 3: Configure Kubernetes Manifests

Edit `k8s/manifests.yaml`:

```yaml
# 1. Update ConfigMap
data:
  KEYCLOAK_SERVER_URL: "https://keycloak.yourcompany.com"
  KEYCLOAK_REALM: "maintenance"
  KEYCLOAK_CLIENT_ID: "k8s-maintenance-app"

# 2. Update Secret
stringData:
  KEYCLOAK_CLIENT_SECRET: "your-actual-client-secret-from-keycloak"

# 3. Update Images
spec:
  containers:
    - name: backend
      image: your-registry.com/k8s-maintenance-backend:v1.0.0
    # and
    - name: frontend
      image: your-registry.com/k8s-maintenance-frontend:v1.0.0

# 4. Update Ingress
spec:
  rules:
    - host: k8s-maintenance.yourcompany.com
```

### Step 4: Deploy to Kubernetes

```bash
# Apply all resources
kubectl apply -f k8s/manifests.yaml

# Watch deployment progress
kubectl get pods -n k8s-maintenance -w

# Check if all pods are running
kubectl get all -n k8s-maintenance

# View logs
kubectl logs -n k8s-maintenance deployment/k8s-maintenance-backend -f
```

### Step 5: Access and Test

1. Navigate to your configured domain (e.g., `https://k8s-maintenance.yourcompany.com`)
2. Click "Login with Keycloak"
3. Authenticate with your Keycloak user
4. You should see the dashboard!

## 📁 File Structure

```
k8s-maintenance/
├── backend/
│   ├── server.py              # Main FastAPI application (650 lines)
│   │                          # - Keycloak JWT validation
│   │                          # - MongoDB CRUD operations
│   │                          # - Kubernetes client integration
│   │                          # - IP validation logic
│   ├── requirements.txt       # Python dependencies
│   ├── .env                   # Configuration (update this!)
│   └── Dockerfile            # Multi-stage production build
│
├── frontend/
│   ├── src/
│   │   ├── contexts/
│   │   │   └── AuthContext.js          # Auth state management
│   │   ├── components/
│   │   │   ├── ProtectedRoute.js       # Route guard
│   │   │   ├── ApplicationDialog.js     # Create app modal
│   │   │   └── ApplicationUpdateDialog.js  # Update IP allowlist
│   │   ├── pages/
│   │   │   ├── LoginPage.js            # Keycloak SSO login
│   │   │   └── DashboardPage.js        # Main applications table
│   │   └── utils/
│   │       └── api.js                  # Axios client with JWT
│   ├── package.json           # React dependencies
│   ├── nginx.conf            # Nginx config for SPA
│   ├── .env                  # Frontend config (update this!)
│   └── Dockerfile            # Multi-stage build with Nginx
│
└── k8s/
    ├── manifests.yaml         # Complete K8s deployment
    │                          # - Namespace
    │                          # - ServiceAccount & RBAC
    │                          # - MongoDB StatefulSet
    │                          # - Backend Deployment
    │                          # - Frontend Deployment
    │                          # - Services & Ingress
    └── README.md             # Detailed deployment guide
```

## 🔧 Configuration Details

### Backend Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `MONGO_URL` | ✅ | MongoDB connection string | `mongodb://mongodb:27017` |
| `DB_NAME` | ✅ | Database name | `k8s_maintenance` |
| `KEYCLOAK_SERVER_URL` | ✅ | Keycloak base URL | `https://keycloak.com` |
| `KEYCLOAK_REALM` | ✅ | Keycloak realm name | `maintenance` |
| `KEYCLOAK_CLIENT_ID` | ✅ | OAuth client ID | `k8s-maintenance-app` |
| `KEYCLOAK_CLIENT_SECRET` | ✅ | OAuth client secret | `abcd1234...` |
| `IN_CLUSTER` | ✅ | Use in-cluster K8s config | `true` |
| `CORS_ORIGINS` | ✅ | Allowed origins | `*` or specific domain |

### Frontend Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `REACT_APP_BACKEND_URL` | ✅ | Backend API URL | `https://api.yourcompany.com` |
| `REACT_APP_KEYCLOAK_URL` | ✅ | Keycloak URL | `https://keycloak.com` |
| `REACT_APP_KEYCLOAK_REALM` | ✅ | Realm name | `maintenance` |
| `REACT_APP_KEYCLOAK_CLIENT_ID` | ✅ | Client ID | `k8s-maintenance-app` |

## 🎭 User Roles & Permissions

### Admin Role
- ✅ Create applications
- ✅ Update IP allowlists
- ✅ Delete applications
- ✅ Enable/disable applications
- ✅ View all applications

### User Role
- ❌ Cannot create applications
- ✅ Update IP allowlists
- ❌ Cannot delete applications
- ❌ Cannot enable/disable
- ✅ View all applications

### Readonly Role
- ❌ Cannot create applications
- ❌ Cannot update IP allowlists
- ❌ Cannot delete applications
- ❌ Cannot enable/disable
- ✅ View all applications

## 🔐 Security Best Practices

1. **HTTPS Only**: Use TLS certificates (Let's Encrypt recommended)
2. **Keycloak Configuration**:
   - Enable 2FA for admin users
   - Configure proper session timeouts
   - Use strong client secrets (32+ characters)
3. **Kubernetes RBAC**:
   - Limit ServiceAccount permissions
   - Use NetworkPolicies to restrict traffic
4. **MongoDB**:
   - Enable authentication
   - Use separate user for the app
   - Backup regularly
5. **Docker Images**:
   - Scan for vulnerabilities
   - Use specific version tags
   - Don't use `latest` in production

## 📊 API Documentation

Once deployed, access interactive API docs at:
- **Swagger UI**: `https://your-domain.com/api/docs`
- **ReDoc**: `https://your-domain.com/api/redoc`

### Key Endpoints

```
GET    /api/health                    # Health check
GET    /api/user/info                 # Get current user
GET    /api/namespaces                # List K8s namespaces
GET    /api/applications              # List all applications
POST   /api/applications              # Create application (admin)
GET    /api/applications/{id}         # Get application
PUT    /api/applications/{id}         # Update IP allowlist
DELETE /api/applications/{id}         # Delete application (admin)
POST   /api/applications/{id}/toggle  # Enable/disable (admin)
```

## 🧪 Testing

### Test Backend Locally
```bash
cd backend
pip install -r requirements.txt

# Set up local MongoDB
docker run -d -p 27017:27017 mongo:7

# Update .env with local values
# Set IN_CLUSTER=false for local K8s config

# Run server
uvicorn server:app --reload --port 8001

# Test health endpoint
curl http://localhost:8001/api/health
```

### Test Frontend Locally
```bash
cd frontend
yarn install

# Update .env with backend URL
# REACT_APP_BACKEND_URL=http://localhost:8001

# Start dev server
yarn start

# Opens http://localhost:3000
```

## 🐛 Troubleshooting

### Pods Not Starting

```bash
# Check pod status
kubectl describe pod -n k8s-maintenance <pod-name>

# Check logs
kubectl logs -n k8s-maintenance <pod-name>

# Common issues:
# - Image pull errors: Check registry credentials
# - CrashLoopBackOff: Check environment variables
# - Pending: Check PVC binding for MongoDB
```

### Can't Create Middlewares

```bash
# Test RBAC permissions
kubectl auth can-i create middlewares.traefik.io \
  --namespace=your-namespace \
  --as=system:serviceaccount:k8s-maintenance:k8s-maintenance-sa

# Should return "yes"
# If "no", check ClusterRole and ClusterRoleBinding
```

### Authentication Failing

1. **Check Keycloak is accessible**:
   ```bash
   kubectl exec -it -n k8s-maintenance deployment/k8s-maintenance-backend -- \
     curl -v https://keycloak.yourcompany.com/realms/maintenance
   ```

2. **Verify client secret**:
   ```bash
   kubectl get secret -n k8s-maintenance backend-secret -o yaml
   # Decode the base64 secret and compare with Keycloak
   ```

3. **Check Keycloak logs**:
   - Look for failed authentication attempts
   - Verify redirect URIs match

### MongoDB Connection Issues

```bash
# Test MongoDB connection
kubectl exec -it -n k8s-maintenance deployment/mongodb -- \
  mongo --eval "db.version()"

# Check if backend can reach MongoDB
kubectl exec -it -n k8s-maintenance deployment/k8s-maintenance-backend -- \
  ping mongodb
```

## 📈 Monitoring & Operations

### View Logs
```bash
# Backend logs
kubectl logs -n k8s-maintenance -l app=k8s-maintenance-backend -f --tail=100

# Frontend logs (Nginx access logs)
kubectl logs -n k8s-maintenance -l app=k8s-maintenance-frontend -f

# MongoDB logs
kubectl logs -n k8s-maintenance -l app=mongodb -f
```

### Check Resource Usage
```bash
# CPU and Memory
kubectl top pods -n k8s-maintenance

# Disk usage (MongoDB)
kubectl exec -n k8s-maintenance deployment/mongodb -- df -h
```

### Scale Deployment
```bash
# Scale backend
kubectl scale deployment -n k8s-maintenance k8s-maintenance-backend --replicas=3

# Scale frontend
kubectl scale deployment -n k8s-maintenance k8s-maintenance-frontend --replicas=3
```

### Backup MongoDB
```bash
# Create backup
kubectl exec -n k8s-maintenance deployment/mongodb -- \
  mongodump --out=/tmp/backup

# Copy backup locally
kubectl cp k8s-maintenance/mongodb-pod:/tmp/backup ./mongodb-backup
```

## 🔄 Upgrade Process

1. **Build new images** with version tags
2. **Update manifests** with new image versions
3. **Apply changes**:
   ```bash
   kubectl apply -f k8s/manifests.yaml
   ```
4. **Monitor rollout**:
   ```bash
   kubectl rollout status deployment -n k8s-maintenance k8s-maintenance-backend
   ```
5. **Rollback if needed**:
   ```bash
   kubectl rollout undo deployment -n k8s-maintenance k8s-maintenance-backend
   ```

## 📝 Example Usage

### Create Application (Admin)
1. Click "Create Application"
2. Enter name: `my-api`
3. Select namespace: `production`
4. Click "Create"
5. Traefik Middleware is created in K8s

### Update IP Allowlist (Admin/User)
1. Click edit icon on application
2. Add IPs:
   - `192.168.1.0/24`
   - `10.0.0.100`
3. Click "Update"
4. Middleware is patched in K8s

### Disable Application (Admin)
1. Click power icon
2. Middleware sourceRange is set to `["0.0.0.0/0"]`
3. All traffic is allowed

### Enable Application (Admin)
1. Click power icon again
2. Middleware sourceRange is restored to IP allowlist
3. Only allowed IPs can access

## 🗑️ Uninstall

```bash
# Delete all resources
kubectl delete -f k8s/manifests.yaml

# Or delete namespace (removes everything)
kubectl delete namespace k8s-maintenance
```

## 📞 Support & Contributing

- **Issues**: Check pod logs and events
- **API Docs**: `https://your-domain.com/api/docs`
- **Keycloak Admin**: Configure users and roles
- **K8s Dashboard**: View resources visually

## 📄 License

Self-hosted and self-managed application.

---

**Built with**: Python FastAPI, React, Kubernetes, Traefik, Keycloak, MongoDB
