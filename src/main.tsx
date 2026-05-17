import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import OpsApp from './ops/App';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <OpsApp />
  </StrictMode>,
);
