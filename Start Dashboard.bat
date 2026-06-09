@echo off
title RLM&CO Dashboard
cd /d "C:\Users\brrud\OneDrive\Desktop\claude projects\rlmco-dashboard"
echo Starting RLM^&CO Dashboard server...
start "RLM&CO Server" cmd /k "npm run dev"
timeout /t 9 /nobreak > nul
echo Opening browser...
start http://localhost:3000
