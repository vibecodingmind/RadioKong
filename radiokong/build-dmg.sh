#!/bin/bash
# RadioKong - Build macOS .dmg locally
# Run this on a Mac to produce the .dmg installer
#
# Prerequisites:
#   - Xcode Command Line Tools: xcode-select --install
#   - Node.js 20+: brew install node
#   - Rust: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
#
# For code signing (optional, needed for distribution outside App Store):
#   - Apple Developer account + Developer ID Application certificate
#   - Set CSC_LINK=/path/to/certificate.p12 and CSC_KEYCHAIN_PASSWORD=xxx

set -e

echo "========================================"
echo "  RadioKong - macOS .dmg Builder"
echo "========================================"
echo ""

# Step 1: Build the Rust audio engine
echo "[1/3] Building Rust audio engine (release)..."
cd "$(dirname "$0")"
cd engine && cargo build --release && cd ..
echo "  Done: engine/target/release/radiokong-engine"
echo ""

# Step 2: Build the Vite frontend
echo "[2/3] Building Vite frontend..."
npx vite build
echo "  Done: dist/"
echo ""

# Step 3: Package with electron-builder
echo "[3/3] Building .dmg with electron-builder..."
npx electron-builder --mac
echo ""

# Show the results
echo "========================================"
echo "  Build Complete!"
echo "========================================"
echo ""
echo "Output files in dist-electron/:"
ls -lh dist-electron/*.dmg 2>/dev/null || echo "  (No .dmg found - check for errors above)"
ls -lh dist-electron/*.zip 2>/dev/null || true
echo ""
echo "To install: open dist-electron/RadioKong-*.dmg"
echo ""

# Code signing note
if [ -z "$CSC_LINK" ]; then
  echo "NOTE: .dmg is unsigned. For distribution:"
  echo "  1. Get an Apple Developer ID Application certificate"
  echo "  2. Export it as .p12 and set CSC_LINK + CSC_KEYCHAIN_PASSWORD"
  echo "  3. Re-run this script"
  echo ""
  echo "  Or sign manually:"
  echo "  codesign --deep --force --verify --verbose --sign 'Developer ID Application: YOUR NAME' dist-electron/mac/RadioKong.app"
  echo "  xcrun notarytool submit dist-electron/RadioKong-*.dmg --apple-id YOU --team-id TEAM --password APP_PASSWORD"
fi
