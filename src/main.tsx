import { createRoot } from 'react-dom/client';
import App from './app/App.tsx';
import { ErrorBoundary } from './app/components/error-boundary.tsx';
import './i18n';
import './styles/index.css';
import { useState } from 'react';

function Root() {
  const [appKey, setAppKey] = useState(0);

  const handleReset = () => {
    try {
      localStorage.setItem('lightops-welcome-seen', 'true');
    } catch {
      /* ignore */
    }
    setAppKey((key) => key + 1);
  };

  return (
    <ErrorBoundary onReset={handleReset}>
      <App key={appKey} />
    </ErrorBoundary>
  );
}

createRoot(document.getElementById('root')!).render(<Root />);
