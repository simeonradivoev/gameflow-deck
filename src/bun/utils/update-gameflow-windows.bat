@echo off
timeout /t 2 /nobreak
powershell -Command "Expand-Archive -Force '{{{tempFile}}}' '{{{installDir}}}'"
del "{{{tempFile}}}"
start "" /D "{{{installDir}}}" "{{{exePath}}}"
del "%~f0"