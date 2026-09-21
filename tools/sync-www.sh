#!/usr/bin/env bash
# Stage the shippable files into www/ for the Android wrapper.
#
# This is a copy, not a build: nothing is transpiled, minified or bundled, and
# the web app still runs straight from the repo root with no step at all.
# Capacitor simply has no way to exclude node_modules/.git/docs from a webDir,
# so the shippable subset is spelled out here.
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf www
mkdir -p www

cp index.html manifest.webmanifest sw.js www/
cp -r src icons vendor www/

# Pyodide ships inside the APK on purpose: on the web it is a 26MB download on
# first Run, but in a packaged app the bytes are already on the device.
echo "www/ staged — $(du -sh www | cut -f1)"
