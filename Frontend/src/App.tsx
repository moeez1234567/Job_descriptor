import React, { useState, useEffect } from "react";
import "./styles.css"; // Make sure you have this CSS file or remove/replace the import

// Define the structure of the form data, matching FastAPI's Pydantic model
interface JobDescriptionForm {
  job_title: string;
  company_name: string;
  location: string;
  workplace: string;
  skills: string[]; // Will be sent as an array of strings
  min_experience_years: number | string; // Allow string for flexibility, FastAPI handles Union
  exp_level_category: string;
  min_salary: number | null; // Allow null for optional fields
  max_salary: number | null; // Allow null for optional fields
  deadline: string;
  notes: string;
  qualification_details: string;
  benefits_details: string;
  style_preference: string;
  output_length_preference: string;
}

const App: React.FC = () => {
  // Initialize state for the form data
  const [formData, setFormData] = useState<JobDescriptionForm>({
    job_title: "",
    company_name: "",
    location: "",
    workplace: "", // Default empty, user must select
    skills: [],
    min_experience_years: 0,
    exp_level_category: "", // Default empty, user must select
    min_salary: null, // Use null for 'not specified'
    max_salary: null, // Use null for 'not specified'
    deadline: "", // Will be set by useEffect
    notes: "",
    qualification_details: "",
    benefits_details: "",
    style_preference: "LinkedIn", // Default style
    output_length_preference: "Standard", // Default length
  });

  // State variables for loading, results, errors, etc.
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(""); // Stores HTML formatted result
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [copied, setCopied] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [rawResult, setRawResult] = useState(""); // Stores plain text result for copying

  // Set default deadline to 30 days from today when component mounts
  useEffect(() => {
    const today = new Date();
    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    const formattedDate = thirtyDaysFromNow.toISOString().split("T")[0]; // YYYY-MM-DD format

    setFormData((prev) => ({
      ...prev,
      deadline: formattedDate,
    }));
  }, []); // Empty dependency array ensures this runs only once on mount

  // --- Form Validation ---
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.job_title.trim()) errors.job_title = "Job title is required";
    if (!formData.company_name.trim()) errors.company_name = "Company name is required";
    if (!formData.location.trim()) errors.location = "Location is required";
    if (!formData.workplace) errors.workplace = "Workplace type is required";
    if (formData.skills.length === 0) errors.skills = "At least one skill is required (comma-separated)";
    if (formData.min_experience_years === "" || Number(formData.min_experience_years) < 0) errors.min_experience_years = "Valid minimum experience (0 or more) is required";
    if (!formData.exp_level_category) errors.exp_level_category = "Experience level is required";
    // Optional fields like salary don't need validation here unless specific rules apply (e.g., max >= min)

    setFormErrors(errors);
    return Object.keys(errors).length === 0; // Returns true if no errors
  };

  // --- Input Change Handlers ---
  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value, type } = e.target;

    // Handle number inputs specifically, converting empty string or invalid numbers appropriately
    let processedValue: string | number | null = value;
    if (type === 'number') {
        // Keep it as a string if empty for display, or parse to number
        // Handle potential null for salary fields if user clears them
         if (name === 'min_salary' || name === 'max_salary') {
             processedValue = value === '' ? null : parseFloat(value);
         } else if (name === 'min_experience_years') {
            // Keep experience as string/number based on input for flexibility
             processedValue = value === '' ? '' : parseFloat(value);
         } else {
             processedValue = parseFloat(value);
         }
    }


    setFormData((prev) => ({
      ...prev,
      [name]: processedValue,
    }));

    // Clear validation error for the field being edited
    if (formErrors[name]) {
      setFormErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSkillsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const skillsArray = e.target.value
      .split(",") // Split by comma
      .map((skill) => skill.trim()) // Remove whitespace
      .filter((skill) => skill !== ""); // Remove empty entries
    setFormData((prev) => ({
      ...prev,
      skills: skillsArray,
    }));

    // Clear validation error for skills
    if (formErrors.skills) {
      setFormErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.skills;
        return newErrors;
      });
    }
  };

  // --- Form Submission Handler ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevent default form submission

    // Validate form before proceeding
    if (!validateForm()) {
      return;
    }

    // Reset states and start loading indicator
    setLoading(true);
    setError("");
    setSuccess("");
    setResult("");
    setRawResult("");

    // Prepare data payload - ensure numbers are numbers if not null
    const payload = {
        ...formData,
        min_salary: formData.min_salary === null ? 0 : Number(formData.min_salary), // Send 0 if null, or number
        max_salary: formData.max_salary === null ? 0 : Number(formData.max_salary), // Send 0 if null, or number
        min_experience_years: Number(formData.min_experience_years) // Ensure experience is a number
    }


    try {
      // THE ACTUAL API CALL TO FASTAPI
      const response = await fetch(
        "http://localhost:8000/generate_job_description", // Ensure this matches your FastAPI server address
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload), // Send the processed form data as JSON
        }
      );

      const data = await response.json(); // Attempt to parse the JSON response body

      // Check if the response status indicates success (e.g., 2xx)
      if (response.ok && data.status === "success") {
        setResult(data.job_description); // Set HTML result for display
        setRawResult(data.raw_description || data.job_description); // Set raw text for copy
        setSuccess("Job description generated successfully!");
      } else {
        // Handle errors reported by the backend (either custom or FastAPI default)
        setError(
          data.message || data.detail || // Check for custom 'message' or FastAPI's 'detail'
            `An error occurred (Status: ${response.status}). Please check inputs.`
        );
      }
    } catch (err) {
      // Handle network errors or issues connecting to the server
      console.error("Fetch Error:", err); // Log the detailed error to the console
      setError(
        "Failed to connect to the server. Please ensure the backend is running and accessible at http://localhost:8000."
      );
    } finally {
      // Stop loading indicator regardless of success or failure
      setLoading(false);
    }
  };

  // --- Utility Handlers ---
  const handleCopyToClipboard = () => {
    if (!rawResult) return; // Don't copy if there's nothing to copy
    navigator.clipboard
      .writeText(rawResult) // Use the raw text state
      .then(() => {
        setCopied(true); // Show "Copied!" message
        setTimeout(() => setCopied(false), 2000); // Hide message after 2 seconds
      })
      .catch((err) => {
        console.error("Failed to copy text: ", err);
        setError("Failed to copy text to clipboard."); // Inform user of copy failure
      });
  };

  const handleResetForm = () => {
    // Reset form to initial state (including default deadline)
    setFormData({
      job_title: "",
      company_name: "",
      location: "",
      workplace: "",
      skills: [],
      min_experience_years: 0,
      exp_level_category: "",
      min_salary: null,
      max_salary: null,
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Calculate 30 days from now again
        .toISOString()
        .split("T")[0],
      notes: "",
      qualification_details: "",
      benefits_details: "",
      style_preference: "LinkedIn",
      output_length_preference: "Standard",
    });
    // Clear all errors, results, and messages
    setFormErrors({});
    setResult("");
    setRawResult("");
    setError("");
    setSuccess("");
    setCopied(false);
  };

  // --- JSX Rendering ---
  return (
    <div className="container">
      <header className="header">
        <h1>Job Description Generator</h1>
        <p>Create professional job descriptions with AI assistance</p>
      </header>

      <form onSubmit={handleSubmit} className="form-container" noValidate>
        {/* Form Row 1: Job Title, Company Name */}
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="job_title">Job Title *</label>
            <input
              type="text" id="job_title" name="job_title"
              className={`form-control ${formErrors.job_title ? "error" : ""}`}
              value={formData.job_title}
              onChange={handleInputChange} required
            />
            {formErrors.job_title && <div className="error-message">{formErrors.job_title}</div>}
          </div>
          <div className="form-group">
            <label htmlFor="company_name">Company Name *</label>
            <input
              type="text" id="company_name" name="company_name"
              className={`form-control ${formErrors.company_name ? "error" : ""}`}
              value={formData.company_name}
              onChange={handleInputChange} required
            />
            {formErrors.company_name && <div className="error-message">{formErrors.company_name}</div>}
          </div>
        </div>

        {/* Form Row 2: Location, Workplace Type */}
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="location">Location *</label>
            <input
              type="text" id="location" name="location"
              className={`form-control ${formErrors.location ? "error" : ""}`}
              value={formData.location}
              onChange={handleInputChange} required
            />
            {formErrors.location && <div className="error-message">{formErrors.location}</div>}
          </div>
          <div className="form-group">
            <label htmlFor="workplace">Workplace Type *</label>
            <select
              id="workplace" name="workplace"
              className={`form-control ${formErrors.workplace ? "error" : ""}`}
              value={formData.workplace}
              onChange={handleInputChange} required
            >
              <option value="">Select workplace type</option>
              <option value="Remote">Remote</option>
              <option value="On-site">On-site</option>
              <option value="Hybrid">Hybrid</option>
            </select>
            {formErrors.workplace && <div className="error-message">{formErrors.workplace}</div>}
          </div>
        </div>

        {/* Skills */}
        <div className="form-group">
          <label htmlFor="skills">Required Skills (comma-separated) *</label>
          <textarea
            id="skills" name="skills" rows={3}
            className={`form-control ${formErrors.skills ? "error" : ""}`}
            value={formData.skills.join(", ")} // Display skills joined by comma
            onChange={handleSkillsChange} required
            placeholder="e.g., JavaScript, React, Node.js, Python, SQL"
          />
          {formErrors.skills && <div className="error-message">{formErrors.skills}</div>}
        </div>

        {/* Form Row 3: Min Experience, Experience Level */}
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="min_experience_years">Min Experience (Years) *</label>
            <input
              type="number" id="min_experience_years" name="min_experience_years"
              className={`form-control ${formErrors.min_experience_years ? "error" : ""}`}
              value={formData.min_experience_years}
              onChange={handleInputChange} required min="0" step="0.5" // Allow half years
            />
            {formErrors.min_experience_years && <div className="error-message">{formErrors.min_experience_years}</div>}
          </div>
          <div className="form-group">
            <label htmlFor="exp_level_category">Experience Level *</label>
            <select
              id="exp_level_category" name="exp_level_category"
              className={`form-control ${formErrors.exp_level_category ? "error" : ""}`}
              value={formData.exp_level_category}
              onChange={handleInputChange} required
            >
              <option value="">Select experience level</option>
              <option value="Entry Level">Entry Level</option>
              <option value="Mid Level">Mid Level</option>
              <option value="Senior Level">Senior Level</option>
              <option value="Expert">Expert</option>
            </select>
            {formErrors.exp_level_category && <div className="error-message">{formErrors.exp_level_category}</div>}
          </div>
        </div>

        {/* Form Row 4: Min Salary, Max Salary */}
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="min_salary">Minimum Salary (PKR, Optional)</label>
            <input
              type="number" id="min_salary" name="min_salary"
              className="form-control" // No error class needed for optional fields unless validating range
              value={formData.min_salary ?? ""} // Display empty string if null
              onChange={handleInputChange} min="0" placeholder="e.g., 80000"
            />
          </div>
          <div className="form-group">
            <label htmlFor="max_salary">Maximum Salary (PKR, Optional)</label>
            <input
              type="number" id="max_salary" name="max_salary"
              className="form-control"
              value={formData.max_salary ?? ""} // Display empty string if null
              onChange={handleInputChange} min="0" placeholder="e.g., 120000"
            />
          </div>
        </div>

        {/* Deadline */}
        <div className="form-group">
          <label htmlFor="deadline">Application Deadline</label>
          <input
            type="date" id="deadline" name="deadline"
            className="form-control"
            value={formData.deadline}
            onChange={handleInputChange}
          />
        </div>

        {/* Form Row 5: Style Preference, Output Length */}
         <div className="form-row">
           <div className="form-group">
             <label htmlFor="style_preference">Style Preference *</label>
             <select
               id="style_preference" name="style_preference"
               className="form-control" // Required, but default value exists
               value={formData.style_preference}
               onChange={handleInputChange} required
             >
               <option value="LinkedIn">LinkedIn</option>
               <option value="Indeed">Indeed</option>
               <option value="Rozee.pk">Rozee.pk</option>
               <option value="LLM Generated (Full & Beautiful)">LLM Generated (Detailed)</option> {/* Match backend prompt */}
             </select>
           </div>
          <div className="form-group">
            <label htmlFor="output_length_preference">Output Length *</label>
            <select
              id="output_length_preference" name="output_length_preference"
              className="form-control" // Required, but default value exists
              value={formData.output_length_preference}
              onChange={handleInputChange} required
            >
              <option value="Concise">Concise</option>
              <option value="Standard">Standard</option>
              <option value="Detailed">Detailed</option>
            </select>
          </div>
         </div>

        {/* Optional Details: Qualifications, Benefits, Notes */}
        <div className="form-group">
          <label htmlFor="qualification_details">Qualification Details (Optional)</label>
          <textarea
            id="qualification_details" name="qualification_details" rows={3}
            className="form-control"
            value={formData.qualification_details}
            onChange={handleInputChange}
            placeholder="e.g., Bachelor's degree in Computer Science or related field, Specific certifications"
          />
        </div>
        <div className="form-group">
          <label htmlFor="benefits_details">Benefits Details (Optional)</label>
          <textarea
            id="benefits_details" name="benefits_details" rows={3}
            className="form-control"
            value={formData.benefits_details}
            onChange={handleInputChange}
            placeholder="e.g., Health insurance, Provident Fund, Paid Time Off, Flexible working hours, Annual bonus"
          />
        </div>
        <div className="form-group">
          <label htmlFor="notes">Additional Notes (Optional)</label>
          <textarea
            id="notes" name="notes" rows={3}
            className="form-control"
            value={formData.notes}
            onChange={handleInputChange}
            placeholder="Any other relevant information, e.g., context about the team or project"
          />
        </div>

        {/* Action Buttons */}
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Generating..." : "Generate Job Description"}
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleResetForm} disabled={loading}>
            Reset Form
          </button>
        </div>
      </form>

      {/* Loading Indicator */}
      {loading && (
        <div className="loading-overlay"> {/* Use overlay for better UX */}
          <div className="loading-spinner" />
           <p>Generating description, please wait...</p>
        </div>
      )}

      {/* Status Messages */}
      {error && <div className="status-message error-message">{error}</div>}
      {success && <div className="status-message success-message">{success}</div>}

      {/* Result Display Area */}
      {result && !loading && ( // Only show result when not loading
        <div className="result-container fade-in">
          <h2>Generated Job Description</h2>
          <div
            className="result-content"
            dangerouslySetInnerHTML={{ __html: result }} // Render the HTML from backend
          />
          <button className="copy-button" onClick={handleCopyToClipboard} disabled={!rawResult}>
            {copied ? "Copied!" : "Copy Text to Clipboard"}
          </button>
        </div>
      )}
    </div>
  );
};

export default App;