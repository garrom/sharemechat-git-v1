import './polyfills';
import './index.css';
import React from 'react';
import ReactDOM from 'react-dom';
import { HelmetProvider } from 'react-helmet-async';
import { captureFirstTouch } from './utils/attribution';

// Atribución de origen (capa A): captura first-touch lo antes posible, con la
// URL de aterrizaje aún intacta. No-op sin consentimiento de analítica o sin
// utm_source; idempotente (no sobrescribe una atribución ya guardada).
captureFirstTouch();

async function bootstrap() {
  const { default: App } = await import('./App');
  ReactDOM.render(
    <HelmetProvider>
      <App />
    </HelmetProvider>,
    document.getElementById('root'),
  );
}

bootstrap();
