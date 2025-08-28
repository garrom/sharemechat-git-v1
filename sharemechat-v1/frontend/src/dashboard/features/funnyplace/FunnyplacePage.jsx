import React, { useEffect, useState, useRef } from 'react';

const FunnyplacePage = ({ videoUrl: propVideoUrl }) => {
  const [loading, setLoading] = useState(!propVideoUrl);
  const [error, setError] = useState('');
  const [videoUrl, setVideoUrl] = useState(propVideoUrl || '');
  const [modelInfo, setModelInfo] = useState(null); // { name, avatar }
  const videoRef = useRef(null);

  const fetchRandomVideo = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Sesión expirada. Inicia sesión de nuevo.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Ajusta esta ruta/propiedades a tu backend
      const res = await fetch('/api/funnyplace/random', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Error ${res.status}`);
      }
      const data = await res.json();
      // Se espera algo tipo: { videoUrl, modelName, avatarUrl }
      setVideoUrl(data.videoUrl || '');
      setModelInfo({
        name: data.modelName || 'Modelo',
        avatar: data.avatarUrl || '',
      });
    } catch (e) {
      console.error(e);
      setError(e.message || 'No se pudo cargar un video.');
      setVideoUrl('');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!propVideoUrl) {
      fetchRandomVideo();
    } else {
      setLoading(false);
    }
    // Limpieza: pausa el video al desmontar
    return () => {
      try {
        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.src = '';
        }
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNext = () => {
    // “Otro video”
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.src = '';
      } catch {}
    }
    fetchRandomVideo();
  };

  const canPlayHlsNativo = () => {
    const v = document.createElement('video');
    return v.canPlayType('application/vnd.apple.mpegurl') !== '';
  };

  const isHls = typeof videoUrl === 'string' && videoUrl.endsWith('.m3u8');

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {/* Encabezado sencillo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {modelInfo?.avatar ? (
          <img
            src={modelInfo.avatar}
            alt={modelInfo.name}
            style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              width: 40, height: 40, borderRadius: '50%',
              background: '#e9ecef', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, color: '#6c757d'
            }}
          >
            M
          </div>
        )}
        <div style={{ fontWeight: 600 }}>{modelInfo?.name || 'Modelo'}</div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={handleNext}
            style={{
              padding: '6px 10px', border: 'none', borderRadius: 8, cursor: 'pointer',
              background: '#0d6efd', color: 'white'
            }}
            disabled={loading}
          >
            Otro video
          </button>
        </div>
      </div>

      {/* Estado */}
      {loading && <div style={{ color: '#6c757d' }}>Cargando video…</div>}
      {error && <div style={{ color: '#dc3545' }}>{error}</div>}

      {/* Video */}
      {!loading && !error && videoUrl && (
        <>
          {/* Aviso si es HLS y el navegador no lo soporta nativo */}
          {isHls && !canPlayHlsNativo() && (
            <div style={{ color: '#6c757d', fontSize: 14 }}>
              Tu navegador no reproduce HLS de forma nativa. Abre el enlace directamente:
              {' '}
              <a href={videoUrl} target="_blank" rel="noreferrer">{videoUrl}</a>
            </div>
          )}

          <video
            ref={videoRef}
            style={{
              width: '100%',
              maxHeight: 480,
              background: 'black',
              borderRadius: 12,
              border: '1px solid #222',
              objectFit: 'contain'
            }}
            src={videoUrl}
            controls
            playsInline
            muted
            autoPlay
          />
        </>
      )}

      {/* Fallback si no hay video */}
      {!loading && !error && !videoUrl && (
        <div style={{ color: '#6c757d' }}>
          No se recibió ninguna URL de video. Pulsa “Otro video” para reintentar.
        </div>
      )}
    </div>
  );
};

export default FunnyplacePage;
