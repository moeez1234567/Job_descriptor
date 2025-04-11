import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // your styling
import App from './App'; // your App component

const rootElement = document.getElementById('root')!;
const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
