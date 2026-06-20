import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import App from './App.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3500,
        style: { fontSize: '14px', borderRadius: '10px' },
        success: { iconTheme: { primary: '#25d366', secondary: '#fff' } },
      }}
    />
  </React.StrictMode>
);
