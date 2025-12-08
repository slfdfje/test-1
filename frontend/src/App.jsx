import { useState } from "react";
import Viewer from "./Viewer.jsx";

const API = "https://test-1-production-7a52.up.railway.app";

export default function App() {
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [matchResult, setMatchResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function handleFileSelect(e) {
    const selectedFiles = Array.from(e.target.files || []);
    
    if (selectedFiles.length === 0) return;
    if (selectedFiles.length > 4) {
      setError("Maximum 4 images allowed");
      return;
    }

    setFiles(selectedFiles);
    setError(null);
    setMatchResult(null);

    // Generate previews
    const previewUrls = selectedFiles.map(file => URL.createObjectURL(file));
    setPreviews(previewUrls);
  }

  function removeImage(index) {
    const newFiles = files.filter((_, i) => i !== index);
    const newPreviews = previews.filter((_, i) => i !== index);
    
    URL.revokeObjectURL(previews[index]);
    
    setFiles(newFiles);
    setPreviews(newPreviews);
    
    if (newFiles.length === 0) {
      setMatchResult(null);
    }
  }

  async function handleMatch() {
    if (files.length === 0) {
      setError("Please upload at least 1 image");
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    files.forEach(file => formData.append("images", file));

    try {
      const response = await fetch(`${API}/match-model`, {

        method: "POST",
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Matching failed");
      }

      setMatchResult(data);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    previews.forEach(url => URL.revokeObjectURL(url));
    setFiles([]);
    setPreviews([]);
    setMatchResult(null);
    setError(null);
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect x="4" y="12" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="2"/>
              <rect x="20" y="12" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="2"/>
              <path d="M12 16h8M4 16h-2M30 16h-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span>AI Glasses Finder</span>
          </div>
          <div className="header-subtitle">Upload images to find matching 3D models</div>
        </div>
      </header>

      <div className="main-content">
        {/* Upload Section */}
        <div className="upload-section">
          <div className="section-header">
            <h2>Upload Glasses Images</h2>
            <p>Upload 1-4 images from different angles for best results</p>
          </div>

          <div className="upload-area">
            {previews.length === 0 ? (
              <label className="upload-dropzone">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                <div className="dropzone-content">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                  </svg>
                  <div className="dropzone-text">
                    <strong>Click to upload</strong> or drag and drop
                  </div>
                  <div className="dropzone-hint">PNG, JPG, WEBP (max 4 images)</div>
                </div>
              </label>
            ) : (
              <div className="preview-grid">
                {previews.map((preview, index) => (
                  <div key={index} className="preview-item">
                    <img src={preview} alt={`Preview ${index + 1}`} />
                    <button
                      className="remove-btn"
                      onClick={() => removeImage(index)}
                      title="Remove image"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {previews.length < 4 && (
                  <label className="add-more">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileSelect}
                      style={{ display: 'none' }}
                    />
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="5" x2="12" y2="19"/>
                      <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    <span>Add more</span>
                  </label>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="error-message">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          <div className="action-buttons">
            <button
              className="btn btn-primary"
              onClick={handleMatch}
              disabled={loading || files.length === 0}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Finding Match...
                </>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.35-4.35"/>
                  </svg>
                  Find 3D Model
                </>
              )}
            </button>
            {files.length > 0 && (
              <button className="btn btn-secondary" onClick={reset}>
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Results Section */}
        {matchResult && (
          <div className="results-section">
            <div className="match-info">
              <div className="match-header">
                <h3>Best Match Found</h3>
                <div className="confidence-badge">
                  {matchResult.confidence ? Math.round(matchResult.confidence * 100) : 0}% Match
                </div>
              </div>
              <div className="model-name">{matchResult.best_model}</div>
              <div className="match-details">
                Based on reference: {matchResult.source_image}
              </div>
            </div>

            <div className="viewer-container">
              <Viewer modelName={matchResult.best_model} />
            </div>

            <div className="viewer-controls">
              <div className="control-hint">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 16v-4M12 8h.01"/>
                </svg>
                Drag to rotate • Scroll to zoom • Right-click to pan
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!matchResult && files.length === 0 && (
          <div className="empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="11" width="7" height="6" rx="1"/>
              <rect x="14" y="11" width="7" height="6" rx="1"/>
              <path d="M10 14h4M3 14h-1M22 14h-1"/>
              <path d="M3 14v-2a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2"/>
            </svg>
            <h3>No images uploaded yet</h3>
            <p>Upload glasses images to find matching 3D models using AI</p>
          </div>
        )}
      </div>
    </div>
  );
}
