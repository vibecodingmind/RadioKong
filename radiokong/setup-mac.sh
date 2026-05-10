#!/bin/bash
# RadioKong - macOS Development Setup Script
# Run this on your Mac to get started with development

set -e

echo "🎸 RadioKong macOS Development Setup"
echo "====================================="

# Check for Homebrew
if ! command -v brew &> /dev/null; then
    echo "📦 Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js via Homebrew..."
    brew install node
fi

# Check for Rust
if ! command -v cargo &> /dev/null; then
    echo "🦀 Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
fi

# Check for Docker (for Icecast test server)
if ! command -v docker &> /dev/null; then
    echo "🐳 Installing Docker Desktop..."
    brew install --cask docker
fi

echo ""
echo "📦 Installing npm dependencies..."
cd "$(dirname "$0")"
npm install

echo ""
echo "🦀 Building Rust audio engine (with CoreAudio support)..."
cd engine
cargo build --release
cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start development:"
echo "  npm run dev          # Start Vite + Electron"
echo "  npm run build:engine # Rebuild Rust engine"
echo "  npm run build        # Build for production"
echo ""
echo "To test with Icecast:"
echo "  docker run -d -p 8000:8000 -p 8001:8001 moul/icecast"
echo ""
echo "Then configure RadioKong to connect to:"
echo "  Host: localhost  Port: 8000  Mount: /live"
echo "  Username: source  Password: hackme"
