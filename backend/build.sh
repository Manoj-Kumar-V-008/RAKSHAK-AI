#!/usr/bin/env bash
# ── Render Build Script for Rakshak AI Backend ──
# This script is called by Render during the build phase.
# It installs both Node.js (server.js) and Python (main.py) dependencies.

set -o errexit  # Exit on error

echo "=== Installing Node.js dependencies ==="
npm install

echo "=== Installing Python dependencies ==="
pip install -r requirements.txt

echo "=== Build complete ==="
