// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Chat from './pages/Chat';
import Comparison from './pages/Comparison';
import Overview from './pages/Overview';
import Agents from './pages/Agents';
import Workspaces from './pages/Workspaces';
import Sessions from './pages/Sessions';
import Providers from './pages/Providers';
import Harvest from './pages/Harvest';
import Protocols from './pages/Protocols';
import Accounts from './pages/Accounts';
import Developer from './pages/Developer';
import Research from './pages/Research';
import SWE from './pages/SWE';
import Admin from './pages/Admin';
import { ApiProvider } from './context';
import { config } from './config';

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
    <ApiProvider baseUrl={config.apiBaseUrl} autoConnect={config.enableWebSocket}>
      <BrowserRouter>
        <Layout theme={theme} setTheme={setTheme}>
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/chat" element={<Chat />} />
            {/* Agents section - /agents defaults to Inbox */}
            <Route path="/agents" element={<Agents />} />
            <Route path="/agents/all" element={<Agents />} />
            <Route path="/agents/inbox" element={<Agents />} />
            <Route path="/agents/swe" element={<Agents />} />
            <Route path="/agents/os" element={<Agents />} />
            <Route path="/agents/network" element={<Agents />} />
            <Route path="/agents/cyber" element={<Agents />} />
            <Route path="/agents/web" element={<Agents />} />
            <Route path="/agents/social" element={<Agents />} />
            <Route path="/agents/research" element={<Agents />} />
            <Route path="/agents/swarms" element={<Agents />} />
            <Route path="/agents/protocols" element={<Protocols />} />
            {/* SWE Memory standalone page */}
            <Route path="/swe-memory" element={<SWE />} />
            {/* Other pages */}
            <Route path="/comparison" element={<Comparison />} />
            <Route path="/workspaces" element={<Workspaces />} />
            <Route path="/sessions" element={<Sessions />} />
            <Route path="/providers" element={<Providers />} />
            <Route path="/harvest" element={<Harvest />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/developer" element={<Developer />} />
            <Route path="/research" element={<Research />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </ApiProvider>
  );
}

export default App;
