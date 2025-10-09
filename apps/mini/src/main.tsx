import React from 'react';
import { createRoot } from 'react-dom/client';
import 'zmp-ui/zaui.css';
import './styles/tailwind.css';
import App from './app';

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
