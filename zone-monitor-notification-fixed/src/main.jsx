import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
// Automatically reload page when Vercel deploys a new asset bundle hash
window.addEventListener('vite:preload-error', () => {
  window.location.reload();
});

window.addEventListener('error', (e) => {
  if (e.message && (e.message.includes('Failed to fetch dynamically imported module') || e.message.includes('Expected a JavaScript'))) {
    window.location.reload();
  }
});

ReactDOM.createRoot(document.getElementById('app')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
