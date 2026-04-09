# Dockerfile for Backend
FROM python:3.11-slim AS backend

WORKDIR /app

# Install dependencies
COPY ./backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY ./backend .

# Expose port
EXPOSE 8001

# Run application
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]


# Dockerfile for Frontend
FROM node:18-alpine AS build

WORKDIR /app

# Install dependencies
COPY ./frontend/package.json ./frontend/yarn.lock ./
RUN yarn install --frozen-lockfile

# Copy source and build
COPY ./frontend .
RUN yarn build

# Production image
FROM nginx:alpine AS frontend

# Copy build files
COPY --from=build /app/build /usr/share/nginx/html

# Copy nginx config
COPY ./frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
