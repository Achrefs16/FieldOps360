#!/bin/bash
# ================================================================
# setup.sh - One-time infrastructure setup for Auth Service on K3s
# ================================================================
# Run this ONCE on the K3s VM to prepare the infrastructure.
# After this, all deployments go through CI/CD (GitHub Actions).
#
# Prerequisites (on the K3s VM):
#   - kubectl access to the cluster
#   - openssl installed
#   - The auth-service Docker image already pushed to Docker Hub
#     (push code to GitHub first, let CI build the image)
#
# No Node.js required on the VM. Migrations and seeding run
# inside K8s Jobs using the auth-service Docker image.
#
# Usage:
#   bash scripts/setup.sh
# ================================================================

set -e

NAMESPACE="fieldops-dev"
IMAGE="${DOCKER_USER:-achrefs16}/fieldops-auth-service:latest"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
INFRA_DIR="$SCRIPT_DIR/../../infra"
KEYS_DIR="$SCRIPT_DIR/../keys"

echo "========================================"
echo "  Auth Service - One-Time Setup"
echo "  Namespace: $NAMESPACE"
echo "  Image: $IMAGE"
echo "========================================"
echo ""

# ── Step 1: Create Databases ────────────────────────────────────
echo "[1/6] Creating databases..."

PG_POD=$(kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=postgresql -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")

if [ -z "$PG_POD" ]; then
  echo "  ERROR: PostgreSQL pod not found in $NAMESPACE."
  echo "  Make sure Terraform has been applied first."
  exit 1
fi

PG_PASSWORD=$(kubectl get secret -n $NAMESPACE fieldops-secrets -o jsonpath='{.data.postgresql-password}' | base64 -d)

kubectl exec -n $NAMESPACE "$PG_POD" -- env PGPASSWORD="$PG_PASSWORD" psql -U postgres -tc \
  "SELECT 1 FROM pg_database WHERE datname = 'fieldops_platform'" | grep -q 1 || \
  kubectl exec -n $NAMESPACE "$PG_POD" -- env PGPASSWORD="$PG_PASSWORD" psql -U postgres -c "CREATE DATABASE fieldops_platform;"
echo "  fieldops_platform: OK"

kubectl exec -n $NAMESPACE "$PG_POD" -- env PGPASSWORD="$PG_PASSWORD" psql -U postgres -tc \
  "SELECT 1 FROM pg_database WHERE datname = 'fieldops_tenant_demo'" | grep -q 1 || \
  kubectl exec -n $NAMESPACE "$PG_POD" -- env PGPASSWORD="$PG_PASSWORD" psql -U postgres -c "CREATE DATABASE fieldops_tenant_demo;"
echo "  fieldops_tenant_demo: OK"
echo ""

# ── Step 2: Generate RS256 Keys ─────────────────────────────────
echo "[2/6] Generating JWT keys..."
if [ ! -f "$KEYS_DIR/private.pem" ]; then
  mkdir -p "$KEYS_DIR"
  openssl genrsa -out "$KEYS_DIR/private.pem" 2048 2>/dev/null
  openssl rsa -in "$KEYS_DIR/private.pem" -pubout -out "$KEYS_DIR/public.pem" 2>/dev/null
  echo "  Keys generated."
else
  echo "  Keys already exist. Skipping."
fi
echo ""

# ── Step 3: Create K8s Secrets ──────────────────────────────────
echo "[3/6] Creating jwt-keys secret..."
kubectl create secret generic jwt-keys \
  --from-file=private.pem="$KEYS_DIR/private.pem" \
  --from-file=public.pem="$KEYS_DIR/public.pem" \
  -n $NAMESPACE \
  --dry-run=client -o yaml | kubectl apply -f -
echo "  Secret jwt-keys: OK"
echo ""

# ── Step 4: Apply K8s Deployment + Service + IngressRoute ───────
echo "[4/6] Applying K8s manifests..."
kubectl apply -f "$INFRA_DIR/k8s/secrets/smtp-credentials.yaml"
kubectl apply -f "$INFRA_DIR/k8s/configmaps/auth-service.yaml"
kubectl apply -f "$INFRA_DIR/k8s/services/auth-service.yaml"
kubectl apply -f "$INFRA_DIR/k8s/deployments/auth-service.yaml"
kubectl apply -f "$INFRA_DIR/k8s/ingress/ingressroutes.yaml"
echo "  Secrets, ConfigMap, Service, Deployment, IngressRoute: OK"
echo ""

# ── Step 5: Run Prisma Migrations (via K8s Job) ────────────────
echo "[5/6] Running database migrations via K8s Job..."

PG_PASSWORD=$(kubectl get secret -n $NAMESPACE fieldops-secrets -o jsonpath='{.data.postgresql-password}' | base64 -d)
PG_HOST="postgresql.$NAMESPACE.svc.cluster.local"

cat <<EOF | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: auth-migrate
  namespace: $NAMESPACE
spec:
  ttlSecondsAfterFinished: 300
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: migrate
          image: $IMAGE
          command: ["sh", "-c"]
          args:
            - |
              npx prisma db push --schema=prisma/platform/schema.prisma --accept-data-loss &&
              npx prisma db push --schema=prisma/tenant/schema.prisma --accept-data-loss &&
              echo "Migrations complete."
          env:
            - name: PLATFORM_DATABASE_URL
              value: "postgresql://postgres:${PG_PASSWORD}@${PG_HOST}:5432/fieldops_platform"
            - name: TENANT_DATABASE_URL
              value: "postgresql://postgres:${PG_PASSWORD}@${PG_HOST}:5432/fieldops_tenant_demo"
          workingDir: /app
EOF

echo "  Waiting for migration job to complete..."
kubectl wait --for=condition=complete job/auth-migrate -n $NAMESPACE --timeout=120s
echo "  Migrations: OK"

# Clean up the job
kubectl delete job auth-migrate -n $NAMESPACE --ignore-not-found
echo ""

# ── Step 6: Seed Test Data (via K8s Job) ────────────────────────
echo "[6/6] Seeding test data via K8s Job..."

cat <<EOF | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: auth-seed
  namespace: $NAMESPACE
spec:
  ttlSecondsAfterFinished: 300
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: seed
          image: $IMAGE
          command: ["sh", "-c"]
          args:
            - |
              node dist/database/prisma/seed.js &&
              echo "Seeding complete."
          env:
            - name: PLATFORM_DATABASE_URL
              value: "postgresql://postgres:${PG_PASSWORD}@${PG_HOST}:5432/fieldops_platform"
            - name: TENANT_DATABASE_URL
              value: "postgresql://postgres:${PG_PASSWORD}@${PG_HOST}:5432/fieldops_tenant_demo"
            - name: DB_HOST
              value: "$PG_HOST"
            - name: DB_PORT
              value: "5432"
            - name: DB_USER
              value: "postgres"
            - name: DB_PASSWORD
              value: "$PG_PASSWORD"
          workingDir: /app
EOF

echo "  Waiting for seed job to complete..."
kubectl wait --for=condition=complete job/auth-seed -n $NAMESPACE --timeout=120s
echo "  Seed: OK"

# Clean up the job
kubectl delete job auth-seed -n $NAMESPACE --ignore-not-found
echo ""

# ── Verify ──────────────────────────────────────────────────────
echo "Waiting for auth-service pod to be ready..."
kubectl rollout status deployment/auth-service -n $NAMESPACE --timeout=120s

echo ""
kubectl get pods -n $NAMESPACE -l app=auth-service
echo ""
echo "========================================"
echo "  Setup complete."
echo ""
echo "  The DevOps pipeline is now active:"
echo "    1. Edit code on Windows"
echo "    2. git push to develop branch"
echo "    3. CI builds Docker image (GitHub Actions)"
echo "    4. CD deploys to K3s (self-hosted runner)"
echo "    5. Traefik routes /api/auth to auth-service"
echo ""
echo "  Test: curl http://<VM_IP>/api/auth/v1/health"
echo "========================================"
