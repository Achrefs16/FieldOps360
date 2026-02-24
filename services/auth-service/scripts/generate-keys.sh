#!/bin/bash
# Generate RS256 key pair for JWT authentication
# Usage: bash scripts/generate-keys.sh

KEYS_DIR="keys"
mkdir -p $KEYS_DIR

echo "Generating RS256 key pair for JWT..."

# Generate 2048-bit RSA private key
openssl genrsa -out $KEYS_DIR/private.pem 2048

# Extract public key from private key
openssl rsa -in $KEYS_DIR/private.pem -pubout -out $KEYS_DIR/public.pem

echo "Keys generated:"
echo "   Private: $KEYS_DIR/private.pem"
echo "   Public:  $KEYS_DIR/public.pem"
echo ""
echo "IMPORTANT: Never commit these keys to Git!"
echo "   For K8s, create a secret:"
echo "   kubectl create secret generic jwt-keys \\"
echo "     --from-file=private.pem=$KEYS_DIR/private.pem \\"
echo "     --from-file=public.pem=$KEYS_DIR/public.pem \\"
echo "     -n fieldops-dev"
