@echo off
echo Starting Job Description Generator Application...

REM Start Flask backend
start cmd /k "cd /d %~dp0 && python flask_app.py"

REM Wait for Flask to start
timeout /t 5

REM Start React frontend
start cmd /k "cd /d %~dp0frontend\frontend && npm start"

echo Application started! 
echo Backend running at http://localhost:5000
echo Frontend running at http://localhost:3000 