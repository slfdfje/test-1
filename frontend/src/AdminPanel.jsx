import { useState, useEffect } from 'react';

const API = import.meta.env.VITE_API_URL || 'https://test-1-production-7a52.up.railway.app';

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [models, setModels] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadModels();
    loadStats();
  }, []);

  async function loadModels() {
    try {
      const res = await fetch(`${API}/models`);
      const data = await res.json();
      setModels(data);
    } catch (err) {
      showMessage('Failed to load models', 'error');
    }
  }

  async function loadStats() {
    try {
      const res = await fetch(`${API}/debug`);
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }

  function showMessage(text, type = 'success') {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  }

  async function handleUploadModel(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    setLoading(true);
    try {
      const res = await fetch(`${API}/upload-model`, {
        method: 'POST',
        body: formData
      });
      
      if (!res.ok) throw new Error('Upload failed');
      
      showMessage('Model uploaded successfully!');
      loadModels();
      e.target.reset();
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function rebuildEmbeddings() {
    if (!confirm('Rebuild embeddings? This may take a few minutes.')) return;
    
    setLoading(true);
    try {
      const res = await fetch(`${API}/rebuild-embeddings`, { method: 'POST' });
      if (!res.ok) throw new Error('Rebuild failed');
      
      showMessage('Embeddings rebuilt successfully!');
      loadStats();
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-container">
      <aside className="admin-sidebar">
        <div className="admin-logo">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect x="4" y="12" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="2"/>
            <rect x="20" y="12" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="2"/>
          </svg>
          <span>Admin Panel</span>
        </div>
        
        <nav className="admin-nav">
          <button 
            className={activeTab === 'dashboard' ? 'active' : ''}
            onClick={() => setActiveTab('dashboard')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7"/>
              <rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/>
            </svg>
            Dashboard
          </button>
          
          <button 
            className={activeTab === 'models' ? 'active' : ''}
            onClick={() => setActiveTab('models')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
            3D Models
          </button>
          
          <button 
            className={activeTab === 'upload' ? 'active' : ''}
            onClick={() => setActiveTab('upload')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
            </svg>
            Upload
          </button>
          
          <button 
            className={activeTab === 'system' ? 'active' : ''}
            onClick={() => setActiveTab('system')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 1v6m0 6v6M5.6 5.6l4.2 4.2m4.2 4.2l4.2 4.2M1 12h6m6 0h6M5.6 18.4l4.2-4.2m4.2-4.2l4.2-4.2"/>
            </svg>
            System
          </button>
        </nav>
      </aside>

      <main className="admin-main">
        {message && (
          <div className={`admin-message ${message.type}`}>
            {message.text}
          </div>
        )}

        {activeTab === 'dashboard' && <Dashboard stats={stats} models={models} />}
        {activeTab === 'models' && <ModelsTab models={models} onRefresh={loadModels} />}
        {activeTab === 'upload' && <UploadTab onUpload={handleUploadModel} loading={loading} />}
        {activeTab === 'system' && <SystemTab stats={stats} onRebuild={rebuildEmbeddings} loading={loading} />}
      </main>
    </div>
  );
}

function Dashboard({ stats, models }) {
  return (
    <div className="admin-content">
      <h1>Dashboard</h1>
      
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-value">{models.length}</div>
            <div className="stat-label">3D Models</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <path d="M21 15l-5-5L5 21"/>
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats?.referenceImages || 0}</div>
            <div className="stat-label">Reference Images</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats?.embeddingsExist ? 'Ready' : 'Missing'}</div>
            <div className="stat-label">AI Status</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-value">Online</div>
            <div className="stat-label">System Status</div>
          </div>
        </div>
      </div>

      <div className="recent-section">
        <h2>Recent Models</h2>
        <div className="model-list">
          {Array.isArray(models) && models.slice(0, 5).map((model, i) => (
            <div key={i} className="model-item">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              </svg>
              <span>{model.name}</span>
            </div>
          ))}
          {(!Array.isArray(models) || models.length === 0) && (
            <div style={{ padding: '1rem', textAlign: 'center', color: '#718096' }}>
              No models uploaded yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ModelsTab({ models, onRefresh }) {
  return (
    <div className="admin-content">
      <div className="content-header">
        <h1>3D Models</h1>
        <button className="btn-primary" onClick={onRefresh}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
          </svg>
          Refresh
        </button>
      </div>

      <div className="models-grid">
        {Array.isArray(models) && models.length > 0 ? (
          models.map((model, i) => (
            <div key={i} className="model-card">
              <div className="model-preview">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                  <path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
              </div>
              <div className="model-info">
                <div className="model-name">{model.name}</div>
                <a href={model.url} target="_blank" rel="noopener noreferrer" className="model-link">
                  View Model
                </a>
              </div>
            </div>
          ))
        ) : (
          <div style={{ 
            gridColumn: '1 / -1', 
            padding: '3rem', 
            textAlign: 'center', 
            color: '#718096',
            background: 'white',
            borderRadius: '12px'
          }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 1rem', color: '#cbd5e0' }}>
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
            <h3 style={{ marginBottom: '0.5rem', color: '#2d3748' }}>No Models Found</h3>
            <p>Upload your first 3D model to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}

function UploadTab({ onUpload, loading }) {
  return (
    <div className="admin-content">
      <h1>Upload New Model</h1>
      
      <form onSubmit={onUpload} className="upload-form">
        <div className="form-group">
          <label>3D Model File (GLB)</label>
          <input 
            type="file" 
            name="file" 
            accept=".glb" 
            required 
            className="file-input"
          />
          <p className="form-hint">Upload a GLB file for the 3D model</p>
        </div>

        <div className="form-group">
          <label>Reference Image (Optional)</label>
          <input 
            type="file" 
            name="thumb" 
            accept="image/*" 
            className="file-input"
          />
          <p className="form-hint">Upload a reference image for AI matching</p>
        </div>

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Uploading...' : 'Upload Model'}
        </button>
      </form>
    </div>
  );
}

function SystemTab({ stats, onRebuild, loading }) {
  return (
    <div className="admin-content">
      <h1>System Information</h1>
      
      <div className="system-info">
        <div className="info-section">
          <h3>Python Environment</h3>
          <div className="info-item">
            <span>Version:</span>
            <code>{stats?.pythonVersion || 'Loading...'}</code>
          </div>
          <div className="info-item">
            <span>PyTorch:</span>
            <code>{stats?.torchInstalled || 'Loading...'}</code>
          </div>
        </div>

        <div className="info-section">
          <h3>Storage</h3>
          <div className="info-item">
            <span>Reference Images:</span>
            <strong>{stats?.referenceImages || 0}</strong>
          </div>
          <div className="info-item">
            <span>Embeddings:</span>
            <strong>{stats?.embeddingsExist ? 'Generated' : 'Not Found'}</strong>
          </div>
        </div>

        <div className="info-section">
          <h3>Directories</h3>
          <div className="info-item">
            <span>Working Directory:</span>
            <code>{stats?.cwd || 'N/A'}</code>
          </div>
          <div className="info-item">
            <span>Uploads Folder:</span>
            <strong>{stats?.uploadsExist ? 'Exists' : 'Missing'}</strong>
          </div>
        </div>
      </div>

      <div className="actions-section">
        <h3>System Actions</h3>
        <button 
          className="btn-primary" 
          onClick={onRebuild} 
          disabled={loading}
        >
          {loading ? 'Rebuilding...' : 'Rebuild AI Embeddings'}
        </button>
        <p className="form-hint">
          Rebuild embeddings after adding new reference images
        </p>
      </div>
    </div>
  );
}
