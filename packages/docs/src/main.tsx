import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/index.css';
import 'react-toastify/dist/ReactToastify.css';

// React takes ownership of route metadata when the interactive app starts.
document.querySelectorAll('[data-prerender]').forEach((node) => node.remove());

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
