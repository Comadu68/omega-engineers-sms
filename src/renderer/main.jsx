import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/global.css';
import { initBrowserBridge } from './browserBridge';

// In browser mode (Chrome/Edge), initialize dev bridge to local SQLite
initBrowserBridge();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
