import React from 'react';
import ReactDOM from 'react-dom';

async function bootstrap() {
  // Activar MSW solo en desarrollo y cuando REACT_APP_MOCK=1
  if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_MOCK === '1') {
    const { worker } = await import('./mocks/browser');
    await worker.start({ onUnhandledRequest: 'bypass' });
    // Si la app requiere token en localStorage para montar:
    localStorage.setItem('token', 'dev-jwt-mock');
  }

  const { default: App } = await import('./App');
  ReactDOM.render(<App />, document.getElementById('root'));
}

bootstrap();
