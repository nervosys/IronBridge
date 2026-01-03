import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from 'react-error-boundary'
import './index.css'
import App from './App.tsx'

function ErrorFallback({ error }: { error: Error }) {
  return (
    <div style={{ padding: '20px', color: 'red', background: '#1a1a1a', minHeight: '100vh' }}>
      <h1>Something went wrong:</h1>
      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {error.message}
      </pre>
      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '12px', marginTop: '20px' }}>
        {error.stack}
      </pre>
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
