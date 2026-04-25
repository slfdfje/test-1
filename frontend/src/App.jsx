import { useState, useEffect } from "react";
import GlassesViewer from "./GlassesViewer.jsx";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function App() {
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [matchResult, setMatchResult] = useState(null);
  const [faceData, setFaceData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    checkBackendStatus();
  }, []);

  async function checkBackendStatus() {
    try {
      const response = await fetch(`${API}/status`);
      if (response.ok) {
        const data = await response.json();
        console.log("Backend status:", data);
      }
    } catch (err) {
      console.log("Backend not available");
    }
  }

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
    setFaceData(null);

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
      setFaceData(null);
    }
  }

  async function handleMatch() {
    if (files.length === 0) {
      setError("Please upload at least 1 image");
      return;
    }

    setLoading(true);
    setAnalyzing(true);
    setError(null);
    setStatusMessage("Analyzing face...");

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
      setStatusMessage("");
    } catch (err) {
      console.error(err);
      setError(err.message);
      setStatusMessage("");
    } finally {
      setLoading(false);
      setAnalyzing(false);
    }
  }

  async function handleAnalyzeFace() {
    if (files.length === 0) {
      setError("Please upload an image first");
      return;
    }

    setLoading(true);
    setAnalyzing(true);
    setError(null);
    setStatusMessage("Detecting face and extracting measurements...");

    try {
      const formData = new FormData();
      formData.append("image", files[0]);

      const response = await fetch(`${API}/analyze`, {
        method: "POST",
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Face analysis failed");
      }

      setFaceData(data);
      setStatusMessage("");
      
      console.log("Face analysis result:", data);
      
    } catch (err) {
      console.error(err);
      setError(err.message);
      setStatusMessage("");
    } finally {
      setLoading(false);
      setAnalyzing(false);
    }
  }

  function reset() {
    previews.forEach(url => URL.revokeObjectURL(url));
    setFiles([]);
    setPreviews([]);
    setMatchResult(null);
    setFaceData(null);
    setError(null);
    setStatusMessage("");
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect x="4" y="12" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="2"/>
              <rect x="20" y="12" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="2"/>
              <path d="M12 16h8M4 16h-2M30 16h-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span>AI Glasses Try-On</span>
          </div>
          <div className="header-subtitle">Upload your photo for AI-powered glasses fitting</div>
        </div>
      </header>

      <div className="main-content">
        <div className="upload-section">
          <div className="section-header">
            <h2>Upload Your Photo</h2>
            <p>Upload a clear frontal photo for best results</p>
          </div>

          <div className="upload-area">
            {previews.length === 0 ? (
              <label className="upload-dropzone">
                <input
                  type="file"
                  accept="image/*"
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
                  <div className="dropzone-hint">PNG, JPG, WEBP</div>
                </div>
              </label>
            ) : (
              <div className="preview-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
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

          {statusMessage && (
            <div className="status-message">
              <div className="spinner"></div>
              {statusMessage}
            </div>
          )}

          <div className="action-buttons" style={{ gap: '1rem', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              onClick={handleAnalyzeFace}
              disabled={loading || files.length === 0}
              style={{ flex: '1', minWidth: '200px' }}
            >
              {analyzing ? (
                <>
                  <span className="spinner"></span>
                  Analyzing Face...
                </>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 16v-4M12 8h.01"/>
                  </svg>
                  AI Face Analysis
                </>
              )}
            </button>
            
            <button
              className="btn btn-secondary"
              onClick={handleMatch}
              disabled={loading || files.length === 0}
              style={{ flex: '1', minWidth: '200px' }}
            >
              {loading && !analyzing ? (
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
                  Find Matching Model
                </>
              )}
            </button>
            
            {files.length > 0 && (
              <button className="btn btn-outline" onClick={reset}>
                Reset
              </button>
            )}
          </div>
        </div>

        {faceData && faceData.success && (
          <div className="results-section">
            <div className="match-info">
              <div className="match-header">
                <h3>Face Analysis Complete</h3>
                <div className="confidence-badge" style={{ background: '#48bb78' }}>
                  AI Powered
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                <div style={{ background: '#f7fafc', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: '#718096' }}>Face Width</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '600', color: '#2d3748' }}>
                    {faceData.measurements?.faceWidth}px
                  </div>
                </div>
                <div style={{ background: '#f7fafc', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: '#718096' }}>Glasses Width</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '600', color: '#2d3748' }}>
                    {faceData.measurements?.glassesWidth}px
                  </div>
                </div>
                <div style={{ background: '#f7fafc', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: '#718096' }}>Bridge Width</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '600', color: '#2d3748' }}>
                    {faceData.measurements?.bridgeWidth}px
                  </div>
                </div>
                <div style={{ background: '#f7fafc', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: '#718096' }}>Face Tilt</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '600', color: '#2d3748' }}>
                    {faceData.position?.faceTilt}°
                  </div>
                </div>
              </div>
            </div>

            <div className="viewer-container">
              <GlassesViewer faceData={faceData} />
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
              {matchResult.source_image && (
                <div className="match-details">
                  Based on reference: {matchResult.source_image}
                </div>
              )}
            </div>

            <div className="viewer-container">
              <GlassesViewer modelName={matchResult.best_model} faceData={matchResult.faceData} />
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

        {!matchResult && !faceData && files.length === 0 && (
          <div className="empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="11" width="7" height="6" rx="1"/>
              <rect x="14" y="11" width="7" height="6" rx="1"/>
              <path d="M10 14h4M3 14h-1M22 14h-1"/>
              <path d="M3 14v-2a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2"/>
            </svg>
            <h3>No photo uploaded yet</h3>
            <p>Upload your photo to try on glasses with AI-powered fitting</p>
          </div>
        )}
      </div>

      <style>{`
        .status-message {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          background: #ebf8ff;
          border-radius: 8px;
          color: #2c5282;
          font-size: 0.95rem;
        }
        .btn-outline {
          background: transparent;
          border: 2px solid #e2e8f0;
          color: #4a5568;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          font-size: 0.95rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-outline:hover {
          border-color: #cbd5e0;
          background: #f7fafc;
        }
        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid #e2e8f0;
          border-top-color: #667eea;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}