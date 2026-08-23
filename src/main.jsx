import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

/**
 * Hängt das Widget in jeden Container mit [data-hf-village-hero] ein.
 * So funktioniert es sowohl in der Entwicklungsseite als auch mehrfach
 * auf einer WordPress-Seite (Shortcode/Block), ohne feste ID.
 */
function mountAll() {
  document.querySelectorAll('[data-hf-village-hero]').forEach(el => {
    if (el.dataset.hfvhMounted) return;      // doppeltes Einhängen vermeiden
    el.dataset.hfvhMounted = '1';
    el.classList.add('hfvh-root');
    const h = el.getAttribute('data-height');
    if (h) el.style.setProperty('--hfvh-h', h);
    createRoot(el).render(<App />);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountAll, { once: true });
} else {
  mountAll();
}
