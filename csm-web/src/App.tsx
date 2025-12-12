import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Workspaces from './pages/Workspaces';
import Sessions from './pages/Sessions';
import Providers from './pages/Providers';
import Harvest from './pages/Harvest';

function App() {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <BrowserRouter>
      <Layout darkMode={darkMode} setDarkMode={setDarkMode}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/workspaces" element={<Workspaces />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/providers" element={<Providers />} />
          <Route path="/harvest" element={<Harvest />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
