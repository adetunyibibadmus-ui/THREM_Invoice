
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error("Root element not found");
} else {
  try {
    const root = createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (error) {
    console.error("React Init Error:", error);
    rootElement.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; padding: 20px; text-align: center;">
        <div style="background: #fee2e2; border: 1px solid #ef4444; padding: 24px; border-radius: 12px; max-width: 400px;">
          <h1 style="color: #991b1b; margin: 0 0 12px 0; font-size: 1.25rem;">Unable to Start App</h1>
          <p style="color: #b91c1c; margin: 0; font-size: 0.875rem;">The application failed to load. This is usually due to a network error or a browser compatibility issue.</p>
          <button onclick="window.location.reload()" style="margin-top: 16px; background: #ef4444; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer;">Try Refreshing</button>
        </div>
      </div>
    `;
  }
}
