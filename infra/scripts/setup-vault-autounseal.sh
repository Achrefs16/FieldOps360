#!/bin/bash
# setup-vault-autounseal.sh
# Install and configure Vault auto-unseal systemd service
# Run this ONCE on your VM to enable automatic unsealing on boot

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UNSEAL_SCRIPT="$SCRIPT_DIR/vault-unseal.sh"
SERVICE_FILE="$SCRIPT_DIR/vault-unseal.service"
UNSEAL_KEY_FILE="/root/.vault-unseal-key"
SYSTEMD_DIR="/etc/systemd/system"
SERVICE_NAME="vault-unseal.service"

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    log_error "This script must be run as root (use sudo)"
    exit 1
fi

echo ""
log_info "===== Vault Auto-Unseal Setup ====="
echo ""

# Step 1: Verify source files exist
log_info "Step 1/5: Verifying source files..."
if [ ! -f "$UNSEAL_SCRIPT" ]; then
    log_error "Unseal script not found at: $UNSEAL_SCRIPT"
    exit 1
fi

if [ ! -f "$SERVICE_FILE" ]; then
    log_error "Systemd service file not found at: $SERVICE_FILE"
    exit 1
fi
log_success "Source files verified"

# Step 2: Update script path in service file (in case repo is in different location)
log_info "Step 2/5: Updating script path in service file..."
REPO_PATH="$(dirname "$(dirname "$SCRIPT_DIR")")"
ACTUAL_SCRIPT_PATH="$REPO_PATH/infra/scripts/vault-unseal.sh"
log_info "Repository path: $REPO_PATH"
log_info "Script path: $ACTUAL_SCRIPT_PATH"

# Make script executable
chmod +x "$UNSEAL_SCRIPT"
log_success "Script is executable"

# Step 3: Prompt for unseal key
log_info "Step 3/5: Configuring unseal key..."
if [ -f "$UNSEAL_KEY_FILE" ]; then
    log_warn "Unseal key file already exists at $UNSEAL_KEY_FILE"
    read -p "Do you want to overwrite it? (yes/no): " OVERWRITE
    if [ "$OVERWRITE" != "yes" ]; then
        log_info "Keeping existing unseal key"
    else
        read -sp "Enter your Vault unseal key: " UNSEAL_KEY
        echo ""
        echo "$UNSEAL_KEY" > "$UNSEAL_KEY_FILE"
        chmod 600 "$UNSEAL_KEY_FILE"
        log_success "Unseal key updated"
    fi
else
    echo ""
    log_warn "You need to provide your Vault unseal key for automatic unsealing"
    log_info "This key will be stored encrypted at $UNSEAL_KEY_FILE (readable only by root)"
    echo ""
    read -sp "Enter your Vault unseal key: " UNSEAL_KEY
    echo ""
    
    if [ -z "$UNSEAL_KEY" ]; then
        log_error "Unseal key cannot be empty"
        exit 1
    fi
    
    echo "$UNSEAL_KEY" > "$UNSEAL_KEY_FILE"
    chmod 600 "$UNSEAL_KEY_FILE"
    chown root:root "$UNSEAL_KEY_FILE"
    log_success "Unseal key stored securely at $UNSEAL_KEY_FILE"
fi

# Step 4: Install systemd service
log_info "Step 4/5: Installing systemd service..."

# Update ExecStart path in the service file copy
TMP_SERVICE="/tmp/vault-unseal.service.tmp"
sed "s|ExecStart=.*|ExecStart=/bin/bash $ACTUAL_SCRIPT_PATH|g" "$SERVICE_FILE" > "$TMP_SERVICE"

# Copy to systemd directory
cp "$TMP_SERVICE" "$SYSTEMD_DIR/$SERVICE_NAME"
rm "$TMP_SERVICE"
chmod 644 "$SYSTEMD_DIR/$SERVICE_NAME"

# Reload systemd
systemctl daemon-reload
log_success "Systemd service installed"

# Step 5: Enable service
log_info "Step 5/5: Enabling service to run on boot..."
systemctl enable "$SERVICE_NAME"
log_success "Service enabled"

echo ""
log_success "===== Setup Complete ====="
echo ""
log_info "The vault-unseal service will now run automatically on every boot"
log_info ""
log_info "Useful commands:"
echo "  - Test unseal now:        sudo systemctl start vault-unseal"
echo "  - Check service status:   sudo systemctl status vault-unseal"
echo "  - View logs:              sudo journalctl -u vault-unseal -f"
echo "  - Disable auto-unseal:    sudo systemctl disable vault-unseal"
echo ""
read -p "Do you want to test the unseal service now? (yes/no): " TEST_NOW

if [ "$TEST_NOW" = "yes" ]; then
    echo ""
    log_info "Starting vault-unseal service..."
    systemctl start "$SERVICE_NAME"
    sleep 2
    systemctl status "$SERVICE_NAME" --no-pager
    echo ""
    log_info "Check logs with: sudo journalctl -u vault-unseal -n 50"
fi

echo ""
log_success "Done! Your Vault will now auto-unseal on every boot."
