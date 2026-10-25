@echo off

echo Starting Aria web...
cd /d "c:\Users\Monojit Main\Desktop\Don't Delete\MY AI"
start cmd /k "npm run dev"

echo Waiting for servers to start...
timeout /t 5

echo Opening Aria in Chrome...
start chrome "http://localhost:3000"
