import { useState } from 'react';
import { createRoot, type Root as ReactRoot } from 'react-dom/client';
import App from './app/LightOpsApp.tsx';
import { LightOpsAuthProvider } from './app/auth/auth-context.tsx';
import { ErrorBoundary } from './app/components/error-boundary.tsx';
import './i18n';
import './styles/index.css';

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
    <LightOpsAuthProvider>
      <ErrorBoundary onReset={handleReset}>
        <App key={appKey} />
      </ErrorBoundary>
    </LightOpsAuthProvider>
  );
}

const rootElement = document.getElementById('root')!;
const hotGlobal = globalThis as typeof globalThis & { __lightopsReactRoot?: ReactRoot };
const reactRoot = hotGlobal.__lightopsReactRoot ?? createRoot(rootElement);
hotGlobal.__lightopsReactRoot = reactRoot;
reactRoot.render(<Root />);
