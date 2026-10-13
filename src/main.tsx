import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { FoundationCheck } from './tools/FoundationCheck';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FoundationCheck />
  </StrictMode>,
);
