@echo off
cd /d "c:\Vibe Project\wa-stb"
start /B node src/index.js > _run_out.txt 2>&1
timeout /t 5 /nobreak >nul
echo STARTED
