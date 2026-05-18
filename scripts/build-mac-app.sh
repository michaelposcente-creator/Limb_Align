#!/usr/bin/env bash
set -e

APP_NAME="LimbAlign"
BUNDLE="${APP_NAME}.app"
MACOS="${BUNDLE}/Contents/MacOS"
RESOURCES="${BUNDLE}/Contents/Resources"
PORT=47891

# Clean previous build
rm -rf "${BUNDLE}"

# Create structure
mkdir -p "${MACOS}" "${RESOURCES}"

# Copy Vite build output
cp -r dist/ "${RESOURCES}/dist/"

# Copy the standalone server
cp scripts/server.cjs "${RESOURCES}/server.cjs"

# Write Info.plist
cat > "${BUNDLE}/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>         <string>LimbAlign</string>
  <key>CFBundleDisplayName</key>  <string>Limb Align</string>
  <key>CFBundleIdentifier</key>   <string>com.limbalign.app</string>
  <key>CFBundleVersion</key>      <string>1.0</string>
  <key>CFBundleExecutable</key>   <string>LimbAlign</string>
  <key>CFBundlePackageType</key>  <string>APPL</string>
  <key>LSUIElement</key>          <false/>
  <key>NSHighResolutionCapable</key> <true/>
  <key>LSMinimumSystemVersion</key>  <string>10.15</string>
</dict>
</plist>
PLIST

# Write the launcher executable
cat > "${MACOS}/${APP_NAME}" <<LAUNCHER
#!/bin/bash
PORT=${PORT}
DIR="\$(cd "\$(dirname "\$0")/../Resources" && pwd)"
DIST="\${DIR}/dist"
SERVER="\${DIR}/server.cjs"

# Kill any previous instance on this port
lsof -ti :\${PORT} 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 0.15

# Find node (includes nvm paths)
NODE=""
for candidate in \
  "\$(which node 2>/dev/null)" \
  /opt/homebrew/bin/node \
  /usr/local/bin/node \
  \$(ls -d \$HOME/.nvm/versions/node/*/bin/node 2>/dev/null | sort -V | tail -1) \
  /usr/bin/node; do
  if [ -x "\$candidate" ]; then NODE="\$candidate"; break; fi
done

if [ -z "\$NODE" ]; then
  osascript -e 'display alert "Limb Align" message "Node.js is required but was not found. Please install it from nodejs.org."'
  exit 1
fi

"\$NODE" "\$SERVER" "\$DIST" \$PORT &
sleep 0.5
open "http://localhost:\${PORT}"
LAUNCHER

chmod +x "${MACOS}/${APP_NAME}"

echo ""
echo "✓ Built ${BUNDLE}"
echo "  Double-click it in Finder, or run:"
echo "  open ${BUNDLE}"
