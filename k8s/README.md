# K8s Maintenance Manager - Deployment Guide

## Overview

A web application to manage Traefik Middleware IP allowlists in Kubernetes clusters with Keycloak authentication.

## Prerequisites

- Kubernetes cluster (1.20+)
- Traefik installed as ingress controller
- Keycloak server (for authentication)
- kubectl configured
- Docker registry access

## Quick Start

### 1. Configure Keycloak

1. **Create Realm**: Create a realm named `maintenance` (or update in manifests)

2. **Create Client**:
   - Client ID: `k8s-maintenance-app`
   - Client Protocol: `openid-connect`
   - Access Type: `confidential`
   - Valid Redirect URIs: `https://your-domain.com/*`
   - Web Origins: `https://your-domain.com`

3. **Create Roles**:
   - `admin` - Full access (create, update, delete, enable/disable)
   - `user` - Can update existing applications
   - `readonly` - Can only view applications

4. **Create Users** and assign roles

5. **Get Client Secret**: From Keycloak client credentials tab

### 2. Build Docker Images

```bash
# Build backend
cd backend
docker build -t your-registry/k8s-maintenance-backend:latest .
docker push your-registry/k8s-maintenance-backend:latest

# Build frontend
cd ../frontend
docker build -t your-registry/k8s-maintenance-frontend:latest .
docker push your-registry/k8s-maintenance-frontend:latest
```

### 3. Update Kubernetes Manifests

Edit `k8s/manifests.yaml`:

```yaml
# Update ConfigMap with your Keycloak details
data:
  KEYCLOAK_SERVER_URL: "https://your-keycloak.com"
  KEYCLOAK_REALM: "your-realm"
  KEYCLOAK_CLIENT_ID: "your-client-id"

# Update Secret with client secret
stringData:
  KEYCLOAK_CLIENT_SECRET: "your-actual-client-secret"

# Update image references
image: your-registry/k8s-maintenance-backend:latest
image: your-registry/k8s-maintenance-frontend:latest

# Update Ingress host
spec:
  rules:
    - host: k8s-maintenance.yourdomain.com
```

### 4. Deploy to Kubernetes

```bash
# Apply manifests
kubectl apply -f k8s/manifests.yaml

# Verify deployment
kubectl get pods -n k8s-maintenance
kubectl get svc -n k8s-maintenance

# Check logs
kubectl logs -n k8s-maintenance deployment/k8s-maintenance-backend -f
```

### 5. Access Application

Navigate to your configured domain (e.g., `https://k8s-maintenance.yourdomain.com`)

1. Click "Login with Keycloak"
2. Authenticate with your Keycloak credentials
3. Start managing applications!

## Application Usage

### Create Application (Admin only)

1. Click "Create Application"
2. Enter application name (lowercase alphanumeric with hyphens)
3. Select existing Kubernetes namespace
4. Click "Create"

### Update IP Allowlist (Admin, User)

1. Click edit icon on application
2. Add IP addresses or CIDR ranges
   - Single IP: `192.168.1.1`
   - CIDR range: `10.0.0.0/24`
3. Click "Update"

### Enable/Disable Application (Admin only)

- **Disable**: Sets sourceRange to `0.0.0.0/0` (allows all)
- **Enable**: Restores original IP allowlist

### Delete Application (Admin only)

1. Click delete icon
2. Confirm deletion
3. Traefik Middleware is removed from cluster

## Architecture

### Backend (FastAPI + Python)

- **Port**: 8001
- **Database**: MongoDB
- **Authentication**: Keycloak JWT validation
- **Kubernetes**: Uses in-cluster service account
- **API Prefix**: `/api`

### Frontend (React + Nginx)

- **Port**: 80
- **Styling**: Tailwind CSS with dark professional theme
- **Icons**: Lucide React
- **State**: React Context API

### Kubernetes Resources Created

- **Namespace**: `k8s-maintenance`
- **ServiceAccount**: `k8s-maintenance-sa`
- **ClusterRole**: Permissions for Traefik Middlewares
- **Deployments**: Backend (2 replicas), Frontend (2 replicas), MongoDB (1 replica)
- **Services**: Backend, Frontend, MongoDB
- **PVC**: MongoDB data persistence

## RBAC Permissions

The ServiceAccount has these permissions:

```yaml
rules:
  - apiGroups: ["traefik.io"]
    resources: ["middlewares"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
  - apiGroups: [""]
    resources: ["namespaces"]
    verbs: ["get", "list"]
```

## Traefik Middleware Format

When you create an application, this manifest is applied:

```yaml
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: <url-encoded-app-name>
  namespace: <selected-namespace>
spec:
  ipAllowList:
    sourceRange:
      - 10.0.0.0/24
      - 192.168.1.100
```

## Environment Variables

### Backend

| Variable | Description | Example |
|----------|-------------|--------|
| `MONGO_URL` | MongoDB connection | `mongodb://mongodb:27017` |
| `DB_NAME` | Database name | `k8s_maintenance` |
| `KEYCLOAK_SERVER_URL` | Keycloak URL | `https://keycloak.com` |
| `KEYCLOAK_REALM` | Keycloak realm | `maintenance` |
| `KEYCLOAK_CLIENT_ID` | Client ID | `k8s-maintenance-app` |
| `KEYCLOAK_CLIENT_SECRET` | Client secret | `secret-from-keycloak` |
| `IN_CLUSTER` | Use in-cluster config | `true` |

### Frontend

| Variable | Description | Example |
|----------|-------------|--------|
| `REACT_APP_BACKEND_URL` | Backend API URL | `https://api.yourdomain.com` |
| `REACT_APP_KEYCLOAK_URL` | Keycloak URL | `https://keycloak.com` |
| `REACT_APP_KEYCLOAK_REALM` | Keycloak realm | `maintenance` |
| `REACT_APP_KEYCLOAK_CLIENT_ID` | Client ID | `k8s-maintenance-app` |

## Troubleshooting

### Pods not starting

```bash
kubectl describe pod -n k8s-maintenance <pod-name>
kubectl logs -n k8s-maintenance <pod-name>
```

### Backend can't create Middlewares

Check RBAC permissions:

```bash
kubectl auth can-i create middlewares.traefik.io --as=system:serviceaccount:k8s-maintenance:k8s-maintenance-sa
```

### Authentication failing

1. Verify Keycloak URL is accessible from pods
2. Check client secret matches
3. Verify realm and client ID are correct
4. Check Keycloak logs

### MongoDB connection issues

```bash
kubectl exec -it -n k8s-maintenance deployment/mongodb -- mongo --eval "db.version()"
```

## Security Considerations

1. **Use TLS/HTTPS** in production
2. **Rotate Keycloak client secrets** regularly
3. **Limit ServiceAccount permissions** to required namespaces
4. **Enable MongoDB authentication** for production
5. **Use NetworkPolicies** to restrict pod communication
6. **Backup MongoDB** regularly

## Scaling

```bash
# Scale backend
kubectl scale deployment -n k8s-maintenance k8s-maintenance-backend --replicas=3

# Scale frontend
kubectl scale deployment -n k8s-maintenance k8s-maintenance-frontend --replicas=3
```

## Monitoring

```bash
# Watch pods
kubectl get pods -n k8s-maintenance -w

# Stream logs
kubectl logs -n k8s-maintenance -l app=k8s-maintenance-backend -f --tail=100

# Check resource usage
kubectl top pods -n k8s-maintenance
```

## Uninstall

```bash
kubectl delete -f k8s/manifests.yaml
```

## Support

For issues or questions, check:
- Backend API docs: `https://your-domain.com/api/docs`
- Logs: `kubectl logs -n k8s-maintenance <pod-name>`
- Keycloak admin console

## License

Self-hosted and self-managed.