import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';
import { useStore } from './store';

// handle for automated browser tests (read-only use)
(window as unknown as { __slotolog: typeof useStore }).__slotolog = useStore;

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
