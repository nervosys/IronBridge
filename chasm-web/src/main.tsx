/* eslint-disable react-refresh/only-export-components */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from 'react-error-boundary'
import './index.css'
import App from './App.tsx'

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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
