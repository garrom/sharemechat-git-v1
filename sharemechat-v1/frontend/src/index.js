import './polyfills';
import './index.css';
import React from 'react';
import ReactDOM from 'react-dom';
import { HelmetProvider } from 'react-helmet-async';

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
