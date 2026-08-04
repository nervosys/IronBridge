// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable react-refresh/only-export-components */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from 'react-error-boundary'
import './index.css'
import App from './App.tsx'
import { configureDesktopApi } from './api/desktop'

function ErrorFallback({ error }: { error: unknown }) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  return (
    <div style={{ padding: '20px', color: 'red', background: '#1a1a1a', minHeight: '100vh' }}>
      <h1>Something went wrong:</h1>
      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {errorMessage}
      </pre>
      {errorStack && (
        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '12px', marginTop: '20px' }}>
          {errorStack}
        </pre>
      )}
    </div>
  )
}

// Under the desktop app, redirect the API client to the embedded server
// before the first request goes out. A no-op in the browser. Rendering is not
// blocked on it: a failure here should surface as the app's normal
// "backend unreachable" state, not a blank window.
configureDesktopApi().then(status => {
  if (status && !status.running) {
    console.error('[chasm] embedded API server unavailable:', status.error);
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
