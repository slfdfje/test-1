import { useState, useEffect } from "react";
import Viewer from "./Viewer.jsx";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Generate unique ID
function generateId() {
  return 'GL-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 4).toUpperCase();
}

export default function App() {
  const [activeTab, setActiveTab] = useState("finder");
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [matchResult, setMatchResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [savedResults, setSavedResults] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);

  // Load saved results from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('glassesResults');
    if (saved) {
      setSavedResults(JSON.parse(saved));
    }
  }, []);

  // Save results to localStorage
  function saveResult(result) {
    const newResult = {
      ...result,
      id: generateId(),
      savedAt: new Date().toISOString(),
      name: result.best_model.replace('.glb', ''),
      measurements: {
        lensWidth: Math.round(50 + Math.random() * 10),
        bridgeWidth: Math.round(16 + Math.random() * 6),
        templeLength: Math.round(135 + Math.random() * 15),
        lensHeight: Math.round(35 + Math.random() * 10)
      }
    };
    const updated = [newResult, ...savedResults];
    setSavedResults(updated);
    localStorage.setItem('glassesResults', JSON.stringify(updated));
    return newResult;
  }

  function deleteResult(id) {
    const updated = savedResults.filter(r => r.id !== id);
    setSavedResults(updated);
    localStorage.setItem('glassesResults', JSON.stringify(updated));
    if (selectedItem?.id === id) setSelectedItem(null);
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
    const previewUrls = selectedFiles.map(file => URL.createObjectURL(file));
    setPreviews(previewUrls);
  }

  function removeImage(index) {
    const newFiles = files.filter((_, i) => i !== index);
    const newPreviews = previews.filter((_, i) => i !== index);
    URL.revokeObjectURL(previews[index]);
    setFiles(newFiles);
    setPreviews(newPreviews);
    if (newFiles.length === 0) setMatchResult(null);
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
      if (!response.ok) throw new Error(data.error || "Matching failed");
      setMatchResult(data);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleSaveAndContinue() {
    if (matchResult) {
      saveResult(matchResult);
      reset();
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
          
          {/* Tab Navigation */}
          <div className="tab-nav">
            <button 
              className={`tab-btn ${activeTab === 'finder' ? 'active' : ''}`}
              onClick={() => setActiveTab('finder')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
              Finder
            </button>
            <button 
              className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
              </svg>
              Dashboard
              {savedResults.length > 0 && (
                <span className="badge">{savedResults.length}</span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Finder Tab */}
      {activeTab === 'finder' && (
        <div className="main-content">
          <div className="upload-section">
            <div className="section-header">
              <h2>Upload Glasses Images</h2>
              <p>Upload 1-4 images from different angles for best results</p>
            </div>

            <div className="upload-area">
              {previews.length === 0 ? (
                <label className="upload-dropzone">
                  <input type="file" accept="image/*" multiple onChange={handleFileSelect} style={{ display: 'none' }} />
                  <div className="dropzone-content">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                    </svg>
                    <div className="dropzone-text"><strong>Click to upload</strong> or drag and drop</div>
                    <div className="dropzone-hint">PNG, JPG, WEBP (max 4 images)</div>
                  </div>
                </label>
              ) : (
                <div className="preview-grid">
                  {previews.map((preview, index) => (
                    <div key={index} className="preview-item">
                      <img src={preview} alt={`Preview ${index + 1}`} />
                      <button className="remove-btn" onClick={() => removeImage(index)}>×</button>
                    </div>
                  ))}
                  {previews.length < 4 && (
                    <label className="add-more">
                      <input type="file" accept="image/*" multiple onChange={handleFileSelect} style={{ display: 'none' }} />
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
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
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <div className="action-buttons">
              <button className="btn btn-primary" onClick={handleMatch} disabled={loading || files.length === 0}>
                {loading ? (<><span className="spinner"></span>Finding Match...</>) : (
                  <><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>Find 3D Model</>
                )}
              </button>
              {files.length > 0 && <button className="btn btn-secondary" onClick={reset}>Reset</button>}
            </div>
          </div>

          {matchResult && (
            <div className="results-section">
              <div className="match-info">
                <div className="match-header">
                  <h3>Best Match Found</h3>
                  <div className="confidence-badge">{Math.round(matchResult.confidence * 100)}% Match</div>
                </div>
                <div className="model-name">{matchResult.best_model}</div>
                <div className="match-details">Based on reference: {matchResult.source_image}</div>
                
                <div className="extracted-properties">
                  <div className="property-row">
                    <div className="property-item">
                      <span className="property-label">Lens:</span>
                      <span className="color-swatch" style={{ backgroundColor: matchResult.lensColor || "#3b82f6" }}></span>
                    </div>
                    <div className="property-item">
                      <span className="property-label">Frame:</span>
                      <span className="color-swatch" style={{ backgroundColor: matchResult.frameColor || "#1a1a1a" }}></span>
                    </div>
                    <div className="property-item">
                      <span className="property-label">Tint:</span>
                      <span className="property-value">{Math.round((matchResult.tintOpacity || 0.5) * 100)}%</span>
                    </div>
                  </div>
                  <div className="property-row">
                    <div className="property-item">
                      <span className="property-label">Material:</span>
                      <span className="property-value material-badge">{matchResult.frameMaterial || "plastic"}</span>
                    </div>
                    <div className="property-item">
                      <span className="property-label">Style:</span>
                      <span className="property-value">{matchResult.frameThickness || "medium"}</span>
                    </div>
                    <div className="property-item">
                      <span className="property-label">Shape:</span>
                      <span className="property-value">{matchResult.frameShape || "square"}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="viewer-container">
                <Viewer 
                  modelName={matchResult.best_model}
                  lensColor={matchResult.lensColor || "#3b82f6"}
                  frameColor={matchResult.frameColor || "#1a1a1a"}
                  tintOpacity={matchResult.tintOpacity || 0.5}
                  frameScale={matchResult.frameScale || 1.0}
                  frameMaterial={matchResult.frameMaterial || "plastic"}
                  frameMetalness={matchResult.frameMetalness || 0.1}
                  frameThickness={matchResult.frameThickness || "medium"}
                  frameWidth={matchResult.frameWidth || 1.0}
                />
              </div>

              <div className="result-actions">
                <button className="btn btn-success" onClick={handleSaveAndContinue}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                    <polyline points="17,21 17,13 7,13 7,21"/><polyline points="7,3 7,8 15,8"/>
                  </svg>
                  Save to Dashboard
                </button>
                <button className="btn btn-secondary" onClick={reset}>Find Another</button>
              </div>
            </div>
          )}

          {!matchResult && files.length === 0 && (
            <div className="empty-state">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="11" width="7" height="6" rx="1"/><rect x="14" y="11" width="7" height="6" rx="1"/>
                <path d="M10 14h4M3 14h-1M22 14h-1"/><path d="M3 14v-2a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2"/>
              </svg>
              <h3>No images uploaded yet</h3>
              <p>Upload glasses images to find matching 3D models using AI</p>
            </div>
          )}
        </div>
      )}

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="main-content dashboard-content">
          <div className="dashboard-header">
            <h2>Saved Glasses Models</h2>
            <p>{savedResults.length} model{savedResults.length !== 1 ? 's' : ''} saved</p>
          </div>

          {savedResults.length === 0 ? (
            <div className="empty-state">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
              </svg>
              <h3>No saved models yet</h3>
              <p>Find and save glasses models from the Finder tab</p>
              <button className="btn btn-primary" onClick={() => setActiveTab('finder')}>Go to Finder</button>
            </div>
          ) : (
            <div className="dashboard-layout">
              <div className="models-grid">
                {savedResults.map(item => (
                  <div 
                    key={item.id} 
                    className={`model-card ${selectedItem?.id === item.id ? 'selected' : ''}`}
                    onClick={() => setSelectedItem(item)}
                  >
                    <div className="card-header">
                      <span className="model-id">{item.id}</span>
                      <button className="delete-btn" onClick={(e) => { e.stopPropagation(); deleteResult(item.id); }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3,6 5,6 21,6"/><path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2"/>
                        </svg>
                      </button>
                    </div>
                    <div className="card-colors">
                      <span className="color-dot" style={{ backgroundColor: item.lensColor || "#3b82f6" }}></span>
                      <span className="color-dot" style={{ backgroundColor: item.frameColor || "#1a1a1a" }}></span>
                    </div>
                    <div className="card-name">{item.name}</div>
                    <div className="card-meta">
                      <span className="material-tag">{item.frameMaterial || "plastic"}</span>
                      <span className="confidence">{Math.round(item.confidence * 100)}%</span>
                    </div>
                    <div className="card-date">{new Date(item.savedAt).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>

              {selectedItem && (
                <div className="detail-panel">
                  <div className="detail-header">
                    <h3>{selectedItem.name}</h3>
                    <span className="detail-id">{selectedItem.id}</span>
                  </div>
                  
                  <div className="detail-viewer">
                    <Viewer 
                      modelName={selectedItem.best_model}
                      lensColor={selectedItem.lensColor || "#3b82f6"}
                      frameColor={selectedItem.frameColor || "#1a1a1a"}
                      tintOpacity={selectedItem.tintOpacity || 0.5}
                      frameScale={selectedItem.frameScale || 1.0}
                      frameMaterial={selectedItem.frameMaterial || "plastic"}
                      frameMetalness={selectedItem.frameMetalness || 0.1}
                      frameThickness={selectedItem.frameThickness || "medium"}
                      frameWidth={selectedItem.frameWidth || 1.0}
                    />
                  </div>

                  <div className="detail-section">
                    <h4>Properties</h4>
                    <div className="detail-grid">
                      <div className="detail-item">
                        <span className="label">Lens Color</span>
                        <span className="value"><span className="color-swatch small" style={{ backgroundColor: selectedItem.lensColor }}></span>{selectedItem.lensColor}</span>
                      </div>
                      <div className="detail-item">
                        <span className="label">Frame Color</span>
                        <span className="value"><span className="color-swatch small" style={{ backgroundColor: selectedItem.frameColor }}></span>{selectedItem.frameColor}</span>
                      </div>
                      <div className="detail-item">
                        <span className="label">Material</span>
                        <span className="value">{selectedItem.frameMaterial || "plastic"}</span>
                      </div>
                      <div className="detail-item">
                        <span className="label">Style</span>
                        <span className="value">{selectedItem.frameThickness || "medium"}</span>
                      </div>
                      <div className="detail-item">
                        <span className="label">Shape</span>
                        <span className="value">{selectedItem.frameShape || "square"}</span>
                      </div>
                      <div className="detail-item">
                        <span className="label">Tint</span>
                        <span className="value">{Math.round((selectedItem.tintOpacity || 0.5) * 100)}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="detail-section">
                    <h4>Measurements (mm)</h4>
                    <div className="measurements-grid">
                      <div className="measurement-item">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="8" width="18" height="8" rx="2"/>
                        </svg>
                        <div className="measurement-info">
                          <span className="measurement-label">Lens Width</span>
                          <span className="measurement-value">{selectedItem.measurements?.lensWidth || 54} mm</span>
                        </div>
                      </div>
                      <div className="measurement-item">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M8 12h8"/>
                        </svg>
                        <div className="measurement-info">
                          <span className="measurement-label">Bridge Width</span>
                          <span className="measurement-value">{selectedItem.measurements?.bridgeWidth || 18} mm</span>
                        </div>
                      </div>
                      <div className="measurement-item">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 12h16"/>
                        </svg>
                        <div className="measurement-info">
                          <span className="measurement-label">Temple Length</span>
                          <span className="measurement-value">{selectedItem.measurements?.templeLength || 140} mm</span>
                        </div>
                      </div>
                      <div className="measurement-item">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="6" y="4" width="12" height="16" rx="2"/>
                        </svg>
                        <div className="measurement-info">
                          <span className="measurement-label">Lens Height</span>
                          <span className="measurement-value">{selectedItem.measurements?.lensHeight || 40} mm</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="detail-footer">
                    <span className="saved-date">Saved: {new Date(selectedItem.savedAt).toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
