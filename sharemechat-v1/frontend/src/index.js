import './polyfills';
import React from 'react';
import ReactDOM from 'react-dom';

async function bootstrap() {
  const { default: App } = await import('./App');
  ReactDOM.render(<App />, document.getElementById('root'));
}

bootstrap();
