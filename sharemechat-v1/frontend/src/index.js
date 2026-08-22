import './polyfills';
import './index.css';
import React from 'react';
import ReactDOM from 'react-dom';
import { HelmetProvider } from 'react-helmet-async';
import { captureFirstTouch } from './utils/attribution';
import { installGlobalErrorHandlers } from './utils/clientErrorReporter';
import ErrorBoundary from './components/ErrorBoundary';

// Observabilidad #4: captura errores JS no controlados y rechazos de promesa
// desde el arranque y los reporta al backend. Primero de todo, para no perder
// errores tempranos.
installGlobalErrorHandlers();

// Atribución de origen (capa A): captura first-touch lo antes posible, con la
// URL de aterrizaje aún intacta. No-op sin consentimiento de analítica o sin
// utm_source; idempotente (no sobrescribe una atribución ya guardada).
captureFirstTouch();

async function bootstrap() {
  const { default: App } = await import('./App');
  ReactDOM.render(
    <HelmetProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </HelmetProvider>,
    document.getElementById('root'),
  );
}

bootstrap();
