#!/bin/bash
echo "Waiting for app to close..."
sleep 2
echo "Installing update..."
mv "{{{tempFile}}}" "{{{appImagePath}}}"
chmod +x "{{{appImagePath}}}"
echo "Done! Restarting..."
"{{{appImagePath}}}" &
rm -- "$0"