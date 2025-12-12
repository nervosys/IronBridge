import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Chat from './pages/Chat';
import Comparison from './pages/Comparison';
import Overview from './pages/Overview';
import Swarms from './pages/Swarms';
import Workspaces from './pages/Workspaces';
import Sessions from './pages/Sessions';
import Providers from './pages/Providers';
import Harvest from './pages/Harvest';
import Agents from './pages/Agents';
import Protocols from './pages/Protocols';
import Accounts from './pages/Accounts';
import Developer from './pages/Developer';
import Research from './pages/Research';

type ThemeMode = 'light' | 'neutral' | 'dark';

function App() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'neutral' || saved === 'dark') {
      return saved;
    }
    // Migration from old darkMode boolean
    const oldDarkMode = localStorage.getItem('darkMode');
    if (oldDarkMode !== null) {
      localStorage.removeItem('darkMode');
      return JSON.parse(oldDarkMode) ? 'dark' : 'light';
    }
    return 'dark';
  });

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.classList.remove('light', 'neutral', 'dark');
    document.documentElement.classList.add(theme);
  }, [theme]);

  return (
    <BrowserRouter>
      <Layout theme={theme} setTheme={setTheme}>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/swarms" element={<Swarms />} />
          <Route path="/comparison" element={<Comparison />} />
          <Route path="/workspaces" element={<Workspaces />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/providers" element={<Providers />} />
          <Route path="/harvest" element={<Harvest />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/protocols" element={<Protocols />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/developer" element={<Developer />} />
          <Route path="/research" element={<Research />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
