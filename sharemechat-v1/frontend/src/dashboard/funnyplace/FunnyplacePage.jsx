import React, { useEffect, useState, useRef } from 'react';
import {
  Wrap, Header, Avatar, AvatarFallback, Title, Spacer,
  Actions, Button, Status, VideoNote, VideoBox, VideoEl,
} from '../../styles/FunnyplaceStyles';

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
      const res = await fetch('/api/funnyplace/random', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Error ${res.status}`);
      }
      const data = await res.json();
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
    // Limpieza al desmontar
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
  const initial = (modelInfo?.name || 'M').trim().charAt(0).toUpperCase();

  return (
    <Wrap>
      {/* Encabezado */}
      <Header>
        {modelInfo?.avatar ? (
          <Avatar
            src={modelInfo.avatar}
            alt={modelInfo.name}
            onError={(e) => { e.currentTarget.src = ''; }}
          />
        ) : (
          <AvatarFallback aria-hidden>{initial || 'M'}</AvatarFallback>
        )}
        <Title>{modelInfo?.name || 'Modelo'}</Title>
        <Spacer />
        <Actions>
          <Button type="button" onClick={handleNext} disabled={loading}>
            {loading ? 'Cargando…' : 'Otro video'}
          </Button>
        </Actions>
      </Header>

      {/* Estado */}
      {loading && <Status $muted>Cargando video…</Status>}
      {error && <Status $error role="alert">{error}</Status>}

      {/* Video */}
      {!loading && !error && videoUrl && (
        <>
          {isHls && !canPlayHlsNativo() && (
            <VideoNote>
              Tu navegador no reproduce HLS de forma nativa. Abre el enlace directamente:{' '}
              <a href={videoUrl} target="_blank" rel="noreferrer">{videoUrl}</a>
            </VideoNote>
          )}

          <VideoBox>
            <VideoEl
              ref={videoRef}
              src={videoUrl}
              controls
              playsInline
              muted
              autoPlay
            />
          </VideoBox>
        </>
      )}

      {/* Fallback si no hay video */}
      {!loading && !error && !videoUrl && (
        <Status $muted>
          No se recibió ninguna URL de video. Pulsa “Otro video” para reintentar.
        </Status>
      )}
    </Wrap>
  );
};

export default FunnyplacePage;
