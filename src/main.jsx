import './lib/overlay';
import './lib/auth';
import './lib/core';
import { createRoot } from 'react-dom/client';
import './styles/01-leaflet.css';
import './styles/02-reset.css';
import './styles/03-layout.css';
import './styles/04-pages.css';
import './styles/05-auth.css';
import './styles/06-explore.css';
import './styles/07-favs.css';
import App from './App';

createRoot(document.getElementById('root')).render(<App />);
