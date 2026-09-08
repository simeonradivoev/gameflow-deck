#!/bin/bash
set -eu

parent_pid=$1
appimage=$2
ready=$3
staging=$(dirname -- "$0")
cleanup() {
    rm -f -- "$ready" "$0"
    rmdir -- "$staging" 2>/dev/null || true
}
trap cleanup EXIT

printf 'Restart helper ready\n' > "$ready"
echo "Waiting for Gameflow to shut down..."
for ((attempt = 0; attempt < 240; attempt++)); do
    if ! kill -0 "$parent_pid" 2>/dev/null; then
        cd -- "$(dirname -- "$appimage")"
        cleanup
        trap - EXIT
        echo "Starting updated Gameflow..."
        exec "$appimage"
    fi
    sleep 0.25
done
echo "Gameflow did not exit within 60 seconds. The update is installed; launch the AppImage manually." >&2
exit 1
