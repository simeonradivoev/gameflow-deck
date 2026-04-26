#!/bin/bash
sleep 2
mv "{{{tempFile}}}" "{{{appImagePath}}}"
chmod +x "{{{appImagePath}}}"
"{{{appImagePath}}}" &
rm -- "$0"