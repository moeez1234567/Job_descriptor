# Job Description Generator

A full-stack application that generates professional job descriptions using AI.

## Features

- Modern, responsive UI built with React and TypeScript
- AI-powered job description generation using Hugging Face models
- Automatic bold formatting of key terms in the generated description
- Form validation and error handling
- Copy to clipboard functionality
- Mobile-friendly design

## Prerequisites

- Python 3.8+
- Node.js 14+
- npm or yarn

## Setup and Installation

### Backend (Flask)

1. Install Python dependencies:
   ```
   pip install flask flask-cors langchain-huggingface langchain-core
   ```

2. Set environment variables (optional):
   ```
   set HUGGINGFACE_API_TOKEN=your_token_here
   set HUGGING_FACE_REPO_ID=microsoft/Phi-3-mini-4k-instruct
   set FLASK_DEBUG=False
   ```

### Frontend (React)

1. Navigate to the frontend directory:
   ```
   cd frontend/frontend
   ```

2. Install dependencies:
   ```
   npm install
   ```

## Running the Application

### Option 1: Using the batch script

Simply run the `run_app.bat` script:
```
run_app.bat
```

This will start both the Flask backend and React frontend.

### Option 2: Manual startup

1. Start the Flask backend:
   ```
   python flask_app.py
   ```

2. In a separate terminal, start the React frontend:
   ```
   cd frontend/frontend
   npm start
   ```

## Usage

1. Open your browser and navigate to `http://localhost:3000`
2. Fill out the job description form
3. Click "Generate Job Description"
4. The generated description will have key terms highlighted in bold
5. Copy the generated description to your clipboard

## Testing the Bold Formatting

You can test the bold formatting feature independently by running:
```
python test_bold_formatting.py
```

This will generate a test HTML file (`test_output.html`) that you can open in your browser to see how the formatting works.

## API Endpoints

- `POST /generate_job_description`: Generates a job description based on the provided form data

## Troubleshooting

- If you encounter CORS issues, make sure the Flask backend is running and CORS is properly configured
- If the AI model fails to generate a description, check your Hugging Face API token
- For any other issues, check the console logs in both the browser and terminal 