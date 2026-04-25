# Admin Control Panel Guide

## Overview

The Admin Control Panel provides a comprehensive interface for managing your AI Glasses 3D model matching system.

## Features

### 1. Dashboard
- View system statistics at a glance
- Monitor total 3D models and reference images
- Check AI embedding status
- See recent model uploads

### 2. 3D Models Management
- Browse all uploaded 3D models
- View model details and download links
- Refresh model list
- Quick access to model URLs

### 3. Upload New Models
- Upload GLB files for 3D models
- Add reference images for AI matching
- Simple drag-and-drop interface
- Automatic processing and storage

### 4. System Information
- Python environment details
- PyTorch installation status
- Storage statistics
- Directory information
- Rebuild AI embeddings

## Access the Admin Panel

### Development Mode

1. Start the development server:
```bash
cd frontend
npm run dev
```

2. Access the admin panel at:
```
http://localhost:5173/admin.html
```

3. Access the main app at:
```
http://localhost:5173/
```

### Production Build

1. Build the project:
```bash
cd frontend
npm run build
```

2. The build will create two entry points:
   - `dist/index.html` - Main user interface
   - `dist/admin.html` - Admin control panel

## Admin Panel Sections

### Dashboard Tab
- **3D Models**: Total count of uploaded models
- **Reference Images**: Number of reference images for AI matching
- **AI Status**: Shows if embeddings are ready
- **System Status**: Overall system health
- **Recent Models**: Quick view of latest uploads

### Models Tab
- Grid view of all 3D models
- Click "View Model" to access signed URLs
- Refresh button to reload model list
- Visual preview placeholders

### Upload Tab
- **3D Model File**: Upload GLB format files
- **Reference Image**: Optional thumbnail/reference for AI matching
- Automatic upload to S3/Wasabi storage
- Success/error notifications

### System Tab
- **Python Environment**: Version and PyTorch status
- **Storage**: Reference images and embeddings count
- **Directories**: Working directory paths
- **Rebuild Embeddings**: Regenerate AI embeddings after adding references

## API Integration

The admin panel connects to your backend API:

```javascript
const API = import.meta.env.VITE_API_URL || 'https://test-1-production-7a52.up.railway.app';
```

### Endpoints Used
- `GET /models` - List all 3D models
- `GET /debug` - System statistics
- `POST /upload-model` - Upload new model
- `POST /rebuild-embeddings` - Regenerate AI embeddings

## Configuration

Set the API URL in your environment:

```bash
# .env file
VITE_API_URL=https://your-backend-url.com
```

## Security Considerations

### Authentication (Optional)
The backend supports API key authentication. To enable:

1. Set environment variable:
```bash
REQUIRE_AUTH=true
```

2. Add API key header to admin panel requests (modify AdminPanel.jsx):
```javascript
headers: {
  'X-API-Key': 'your-api-key'
}
```

### Recommended Security Measures
- Deploy admin panel on a separate subdomain
- Use authentication middleware
- Restrict access by IP address
- Enable HTTPS only
- Implement rate limiting

## Troubleshooting

### Models Not Loading
- Check backend API is running
- Verify VITE_API_URL is correct
- Check browser console for CORS errors
- Ensure S3/Wasabi credentials are configured

### Upload Failures
- Verify file format (GLB for models)
- Check file size limits
- Ensure backend has write permissions
- Check S3 bucket configuration

### Embeddings Not Building
- Verify Python and PyTorch are installed
- Check reference images exist
- Review backend logs for errors
- Ensure match.py script is present

## Customization

### Styling
Edit `frontend/src/admin.css` to customize:
- Color scheme
- Layout
- Typography
- Responsive breakpoints

### Features
Modify `frontend/src/AdminPanel.jsx` to:
- Add new tabs
- Customize statistics
- Add bulk operations
- Implement search/filter

## Development Tips

1. **Hot Reload**: Changes to admin panel files auto-reload in dev mode
2. **Component Structure**: Each tab is a separate component for easy maintenance
3. **State Management**: Uses React hooks for simple state management
4. **API Calls**: Centralized API URL configuration

## Next Steps

- Add user authentication
- Implement model deletion
- Add batch upload functionality
- Create analytics dashboard
- Add webhook management UI
- Implement search and filtering
