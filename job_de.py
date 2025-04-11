import os
import traceback
import re
import uvicorn # Import uvicorn
from fastapi import FastAPI, Request, HTTPException # Import FastAPI and HTTPException
from fastapi.responses import JSONResponse # For potential custom responses
from fastapi.middleware.cors import CORSMiddleware # Import CORS Middleware
from pydantic import BaseModel, Field, validator # Import Pydantic BaseModel and Field
from typing import List, Optional, Union # For type hinting
from langchain_huggingface import HuggingFaceEndpoint
from langchain_community.llms import Ollama
from langchain_core.prompts import PromptTemplate
from datetime import date, timedelta
import sys # To exit if model loading fails



ollama_model = "llama3:8b"
# Note: FastAPI/Uvicorn use --reload flag for debug/hot-reloading
# DEBUG_MODE = os.getenv("FASTAPI_DEBUG", "False").lower() == "true" # Less direct equivalent

# --- Initialize FastAPI App ---
app = FastAPI(
    title="Job Description Generator API",
    description="API to generate job descriptions using Hugging Face LLM",
    version="1.0.0"
)

# --- CORS Configuration ---
# Allow all origins for development, restrict in production
origins = ["*"] # Or specify frontend origins like ["http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Allows all methods (GET, POST, etc.)
    allow_headers=["*"], # Allows all headers
)

# --- Global variable to hold the loaded LLM and Prompt ---
# # These will be populated during startup
# llm: Optional[HuggingFaceEndpoint] = None
# prompt_template: Optional[PromptTemplate] = None

# --- LLM Loading Function (mostly unchanged) ---
def load_llm_model(model_name="llama3:8b"):
    """Loads the Hugging Face Endpoint LLM."""
    global llm
    print(f"Attempting to load LLM: {model_name}")

    # if not api_token or not api_token.startswith("hf_"):
    #     print("ERROR: Invalid Hugging Face API Token format.")
    #     return None # Return None on failure

    try:
        loaded_llm = Ollama(
            model = ollama_model,
            # huggingfacehub_api_token=api_token,
            temperature=0.5,
            num_predict=1024,
        )
        print("LLM loaded successfully.")
        return loaded_llm
    except ValueError as e:
        print(f"Configuration error: {e}")
        return None
    except ConnectionError as e:
        print(f"Connection error: {e}")
        return None
    except Exception as e:
        print(f"FATAL: Error loading LLM '{model_name}': {e}\n{traceback.format_exc()}")
        return None

# --- Prompt Template Function (mostly unchanged) ---
def get_job_description_prompt():
    """Creates the prompt template."""
    template = """
You are an expert Human Resources professional specialized in writing professional job descriptions.
Your task is to generate **two distinct sections** based on the provided details: 1) A short summary of key details, and 2) The main job description details. Adhere to the specified style and length preferences for the second section.

**Job Details:**
* Job Title: {job_title}
* Company Name: {company_name}
* Location: {location}
* Workplace Type: {workplace}
* Required Skills: {skills}
* Minimum Experience (Years): {min_experience_years}
* Experience Level Category: {exp_level_category}
* Salary Range: {min_salary} - {max_salary}. **Note: This salary is in Pakistani Rupees (PKR).** Please state the range clearly using the PKR currency symbol (e.g., "PKR 100,000 - PKR 150,000 per month" or just "PKR 150,000 per month" if only one value is provided). Handle cases where values are "Not Specified" appropriately.
* Application Deadline: {deadline}
* Additional Notes: {notes}

**Specific Inputs for Description:**
* Qualification Details Provided: {qualification_details}
* Benefits Details Provided: {benefits_details}

**Output Requirements (Apply mainly to Section 2):**
* Desired Style: {style_preference}
* Desired Output Length: {output_length_preference}

**Style Guidelines (Apply mainly to Section 2):**
* **Indeed:** Clear, concise bullet points. Brief company overview. Direct.
* **Rozee.pk:** Similar to Indeed, tailor for Pakistani market. Professional sections.
* **LinkedIn:** Narrative, focus on culture, impact, growth. Engaging.
* **LLM Generated (Full & Beautiful):** Creative, comprehensive. Highlight culture, impact, responsibilities, qualifications, skills, salary, benefits. Engaging language. Well-structured.

**Length Guidelines (Apply mainly to Section 2):**
* **Concise:** Be very brief, focus only on the absolute key responsibilities and requirements (~10-15 lines max).
* **Standard:** Provide a typical level of detail covering main aspects (~15-25 lines).
* **Detailed:** Be comprehensive and elaborate on all sections.

**Instructions:**
1.  Generate **two distinct sections** separated by "--- DETAILS ---".
2.  **The first section** must contain *only* the Job Title, Company Name, Location, and Workplace Type, formatted exactly like this (replace placeholders with actual values):
    **Title:** [Job Title]
    **Company:** [Company Name]
    **Location:** [Location]
    **Type:** [Workplace Type]
3.  **The second section** (after the "--- DETAILS ---" separator) should start directly with "**Responsibilities:**" and contain the main body of the job description.
4.  In the second section, incorporate the remaining **Job Details** (Skills, Experience, Salary, Deadline), **Specific Inputs** (Qualifications, Benefits), and **Additional Notes** as relevant.
5.  Apply the requested **Desired Style** and **Desired Output Length** primarily to the **second section**.
6.  Accurately use all provided input details across both sections as appropriate.
7.  Do not include any conversational text, introductions, explanations, greetings, or any content other than the two specifically requested sections in the specified format.

**Generated Output:**
"""
    created_prompt = PromptTemplate(
        template=template,
        input_variables=[
            "job_title", "company_name", "location", "workplace", "skills",
            "min_experience_years", "exp_level_category", "min_salary", "max_salary",
            "deadline", "notes",
            "qualification_details",
            "benefits_details",
            "style_preference",
            "output_length_preference"
        ]
    )
    print("Prompt template created.")
    return created_prompt

# --- Startup Event ---
@app.on_event("startup")
async def startup_event(): # async can works like that if the upper line of code take time to execute they cant effect on them they start processing this async function in the same time 
    """Load LLM and Prompt on application startup."""
    global llm, prompt_template
    print("Running startup event...")
    llm = load_llm_model(ollama_model)
    if llm is None:
        print("FATAL: Failed to load LLM. Application cannot start.")
        # Exit the application if the core component fails to load
        sys.exit("LLM Loading Failed")

    prompt_template = get_job_description_prompt()
    if prompt_template is None: # Should not happen based on current code, but good practice
         print("FATAL: Failed to create prompt template. Application cannot start.")
         sys.exit("Prompt Template Creation Failed")
    print("Startup complete. LLM and prompt are ready.")


# --- Pydantic Model for Input Validation ---
class JobDetailsInput(BaseModel):
    job_title: str
    company_name: str
    location: str
    workplace: str # e.g., "Remote", "On-site", "Hybrid"
    skills: Union[List[str], str] # Accept list or comma-separated string
    min_experience_years: Union[float, str] # Can be number or text like "1-2"
    exp_level_category: str # e.g., "Entry Level", "Mid Level", "Senior Level"
    style_preference: str # e.g., "Indeed", "LinkedIn", "LLM Generated (Full & Beautiful)"
    output_length_preference: str # e.g., "Concise", "Standard", "Detailed"

    # Optional fields with defaults
    min_salary: Optional[Union[int, float]] = None
    max_salary: Optional[Union[int, float]] = None
    deadline: Optional[str] = Field(default_factory=lambda: (date.today() + timedelta(days=30)).strftime("%Y-%m-%d"))
    notes: Optional[str] = None
    qualification_details: Optional[str] = None
    benefits_details: Optional[str] = None

    # Validator to ensure skills is handled correctly if passed as string
    @validator('skills', pre=True)
    def ensure_skills_is_list_or_str(cls, v):
        if isinstance(v, str):
            # If you expect comma-separated, you could split here:
            # return [skill.strip() for skill in v.split(',') if skill.strip()]
            # Or just keep it as a string if the prompt handles it
            return v
        if isinstance(v, list):
            return v
        raise ValueError("Skills must be a list of strings or a single string")

# --- Formatting Function (Unchanged) ---
def format_job_description(text, data_dict):
    """Format the job description with HTML tags for bold text."""
    # Keywords to highlight
    keywords = [
        data_dict.get("job_title"),
        data_dict.get("company_name"),
        data_dict.get("location"),
        data_dict.get("workplace"),
        data_dict.get("exp_level_category"),
        f"{data_dict.get('min_experience_years')} years",
        f"{data_dict.get('min_experience_years')} year",
        "PKR",
        "Remote",
        "On-site",
        "Hybrid",
        "Entry Level",
        "Mid Level",
        "Senior Level",
        "Expert",
        "Responsibilities",
        "Requirements",
        "Qualifications",
        "Benefits",
        "About Us",
        "About the Role",
        "About the Company"
    ]

    # Add skills to keywords (handle both list and string)
    skills = data_dict.get("skills", [])
    if isinstance(skills, str):
         # If skills remain a string, you might split them here or add the whole string
         keywords.append(skills)
         # Example if splitting: keywords.extend([s.strip() for s in skills.split(',') if s.strip()])
    elif isinstance(skills, list):
         keywords.extend(skills)

    # Filter out None or empty keywords before sorting
    keywords = [kw for kw in keywords if kw]

    # Sort keywords by length (longest first) to avoid partial replacements
    keywords.sort(key=len, reverse=True)

    formatted_text = text
    for keyword in keywords:
         # Ensure keyword is a non-empty string before attempting regex
        if isinstance(keyword, str) and keyword and keyword != "None" and keyword != "Not Specified":
            try:
                # Case-insensitive replacement using word boundaries for safety
                pattern = re.compile(r'\b' + re.escape(keyword) + r'\b', re.IGNORECASE)
                # Replacement using a function to preserve original case in <strong> tag - slightly more complex
                # def replace_func(match):
                #     return f"<strong>{match.group(0)}</strong>"
                # formatted_text = pattern.sub(replace_func, formatted_text)

                # Simpler replacement (makes keyword bold with the case defined in `keywords` list):
                formatted_text = pattern.sub(f"<strong>{keyword}</strong>", formatted_text)
            except re.error as e:
                 print(f"Regex error for keyword '{keyword}': {e}") # Log regex errors

    return formatted_text

# --- API Endpoint ---
@app.post('/generate_job_description', tags=["Job Description"])
async def generate_job_description_api(data: JobDetailsInput):
    """
    API endpoint to generate job description based on input details.
    """
    global llm, prompt_template

    # Check if LLM is loaded (should be handled by startup, but double-check)
    if llm is None or prompt_template is None:
        print("Error: LLM or Prompt Template not available.")
        raise HTTPException(status_code=500, detail="Server error: LLM or Prompt not initialized")

    print(f"Received request data: {data.dict()}") # Log Pydantic model data

    # --- Prepare Input for LangChain ---
    # Convert skills list/string back to string for the prompt if needed
    # (The template expects a single string)
    if isinstance(data.skills, list):
        skills_str = ", ".join(data.skills)
    else:
        skills_str = data.skills # Assume it's already a suitable string

    # Format salary strings (handle None/0 gracefully)
    try:
        min_salary_str = f"{int(data.min_salary):,}" if data.min_salary is not None and data.min_salary > 0 else "Not Specified"
    except (ValueError, TypeError):
        min_salary_str = "Not Specified"
    try:
        max_salary_str = f"{int(data.max_salary):,}" if data.max_salary is not None and data.max_salary > 0 else "Not Specified"
    except (ValueError, TypeError):
        max_salary_str = "Not Specified"

    # Create the input dictionary using data from the Pydantic model
    input_data_dict = {
        "job_title": data.job_title,
        "company_name": data.company_name,
        "location": data.location,
        "workplace": data.workplace,
        "skills": skills_str,
        "min_experience_years": str(data.min_experience_years), # Ensure string if needed by prompt
        "exp_level_category": data.exp_level_category,
        "min_salary": min_salary_str,
        "max_salary": max_salary_str,
        "deadline": data.deadline if data.deadline else "Not Specified", # Handle potential None from Pydantic default_factory edge case
        "notes": data.notes if data.notes else "None",
        "qualification_details": data.qualification_details if data.qualification_details else "None",
        "benefits_details": data.benefits_details if data.benefits_details else "None",
        "style_preference": data.style_preference,
        "output_length_preference": data.output_length_preference
    }

    # --- Invoke LLM Chain ---
    try:
        # Note: HuggingFaceEndpoint might not have a native async 'ainvoke'.
        # If this call is blocking and impacts performance under load,
        # consider running it in a separate thread pool using asyncio.to_thread
        # or starlette.concurrency.run_in_threadpool
        chain = prompt_template | llm
        response = chain.invoke(input_data_dict) # Using synchronous invoke

        if isinstance(response, str):
            clean_response = response.strip()

            # Format the response with HTML tags for bold text
            # Pass the original input_data_dict for keyword extraction
            formatted_response = format_job_description(clean_response, input_data_dict)

            print("Successfully generated job description.")
            return {
                "status": "success",
                "job_description": formatted_response,
                # "raw_description": clean_response
            } # FastAPI automatically converts dict to JSON response
        else:
            print(f"Error: LLM returned unexpected type: {type(response)}")
            raise HTTPException(status_code=500, detail="LLM returned unexpected response type")

    except Exception as e:
        print(f"Error during LLM invocation or processing: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="An error occurred while generating the description.")
    



# --- Health Check Endpoint (Good Practice) ---
@app.get("/health", tags=["Health Check"])
async def health_check():
    """Basic health check endpoint."""
    # Could add checks here (e.g., is LLM loaded?)
    if llm and prompt_template:
         return {"status": "ok", "message": "Service is running and LLM is loaded."}
    else:
         # Should not happen if startup succeeded, but indicates a problem
         return JSONResponse(
             status_code=503,
             content={"status": "error", "message": "Service is starting or encountered an issue (LLM not ready)."}
         )
    


    


# --- Main Execution ---
if __name__ == '__main__':
    # Uvicorn runs the app. Startup events are handled by FastAPI itself.
    # Use reload=True for development (similar to Flask's debug=True)
    print("Starting FastAPI server with Uvicorn...")
    uvicorn.run("main:app", host='0.0.0.0', port=8000, reload=True, log_level="info")
    # For production, you would typically run:
    # uvicorn main:app --host 0.0.0.0 --port 5000 --workers 4
    # (Save the code as main.py)