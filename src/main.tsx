import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './ui/tokens.css';
import './App.css';
import { App } from './App';
import { countPageView } from './analytics';

countPageView();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
