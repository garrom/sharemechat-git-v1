import React from 'react';
import { useHistory } from 'react-router-dom';

const Unauthorized = () => {
  const history = useHistory();

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f8f9fa',
      textAlign: 'center',
      padding: '20px'
    }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#dc3545' }}>
        401 - No autorizado
      </h1>
      <p style={{ marginBottom: '2rem', color: '#6c757d' }}>
        No tienes permisos para acceder a esta página.
      </p>
      <button
        onClick={() => history.push('/')}
        style={{
          padding: '10px 16px',
          backgroundColor: '#007bff',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer'
        }}
      >
        Ir al login
      </button>
    </div>
  );
};

export default Unauthorized;
