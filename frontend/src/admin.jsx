import { createRoot } from 'react-dom/client';
import AdminPanel from './AdminPanel.jsx';
import './admin.css';

createRoot(document.getElementById('admin-root')).render(<AdminPanel />);
