import React from 'react';
import { reportClientError } from '../utils/clientErrorReporter';

// Observabilidad #4 (2026-08-22) — atrapa errores de render de React (los que
// hoy dejaban la pantalla en blanco sin que nos enterásemos), reporta al backend
// y muestra una pantalla de recuperación. Textos en ES hardcodeados a propósito:
// es el último recurso, no debe depender de i18n (que podría ser lo que falló).
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    reportClientError({
      message: (error && error.message) ? error.message : 'render error',
      source: 'react-error-boundary',
      stack: `${(error && error.stack) || ''}${(info && info.componentStack) || ''}`,
    });
  }

  handleReload = () => {
    if (typeof window !== 'undefined') window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            minHeight: '60vh', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12,
            textAlign: 'center', padding: 24, color: '#e7ddd5',
          }}
        >
          <h1 style={{ fontSize: 22, margin: 0 }}>Algo ha ido mal</h1>
          <p style={{ opacity: 0.8, maxWidth: 420, margin: 0 }}>
            Ha ocurrido un error inesperado. Recarga la página para continuar.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            style={{
              marginTop: 8, background: '#ea1d1d', color: '#fff', border: 'none',
              borderRadius: 8, padding: '10px 20px', fontWeight: 700, cursor: 'pointer',
            }}
          >
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
