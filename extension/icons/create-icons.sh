#!/bin/bash
# Generate PNG icons from SVG for the extension
# Requires ImageMagick (convert command)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if command -v convert &> /dev/null; then
  convert -background none icon.svg -resize 16x16 icon16.png
  convert -background none icon.svg -resize 48x48 icon48.png
  convert -background none icon.svg -resize 128x128 icon128.png
  echo "Icons generated successfully!"
else
  echo "ImageMagick not found. Please install it or create icons manually."
  echo "Required sizes: 16x16, 48x48, 128x128 pixels"
  echo ""
  echo "On Ubuntu/Debian: sudo apt-get install imagemagick"
  echo "On macOS: brew install imagemagick"
fi
