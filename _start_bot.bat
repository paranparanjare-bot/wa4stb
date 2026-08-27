@echo off
cd /d "c:\Vibe Project\wa-stb"
start /B node src/index.js > _qr_test_out.txt 2>&1
timeout /t 6 /nobreak >nul
echo READY
