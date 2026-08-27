@echo off
taskkill /F /IM node.exe 2>nul
timeout /t 1 >nul
rmdir /s /q "data\sessions" 2>nul
mkdir data\sessions
echo Sessions cleared. Starting bot...
node src\index.js