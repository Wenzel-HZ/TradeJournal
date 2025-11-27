import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx'; // 确保这里是 'App.jsx'，并且大小写完全匹配！
import './index.css'; // 确保 CSS 样式被正确引入

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
);