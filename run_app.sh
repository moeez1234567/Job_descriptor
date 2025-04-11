#!/bin/bash
echo "Starting Job Description Generator Application..."

# Start Flask backend
python flask_app.py &
FLASK_PID=$!

# Wait for Flask to start
echo "Waiting for Flask backend to start..."
sleep 5

# Start React frontend
cd frontend/frontend
npm start &
REACT_PID=$!

echo "Application started!"
echo "Backend running at http://localhost:5000"
echo "Frontend running at http://localhost:3000"
echo "Press Ctrl+C to stop both services"

# Wait for user to press Ctrl+C
trap "kill $FLASK_PID $REACT_PID; exit" INT
wait 