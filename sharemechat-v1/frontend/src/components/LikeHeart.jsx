// src/components/LikeHeart.jsx
//
// Card 1 Fase B: corazón-LIKE reutilizable (cliente → modelo). Autocontenido:
// pide su estado al montar (GET /models/{id}/likes) y hace toggle (POST).
// Pensado para superponerse sobre el vídeo de la modelo (random / 1-a-1) o
// sobre las tarjetas blur del tab videochat. El backend ya soporta el toggle.
//
// Props:
//   - modelUserId (number): la modelo a la que se da like. Sin él, no renderiza.
//   - stopPropagation (bool): si true, corta el click para no disparar el
//     onClick del contenedor (p. ej. la tarjeta que abre el perfil).

import React, { useCallback, useEffect, useState } from 'react';
import styled from 'styled-components';
import i18n from '../i18n';
import { apiFetch } from '../config/http';

const HeartBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(0, 0, 0, 0.48);
  color: #fff;
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  backdrop-filter: blur(4px);
  white-space: nowrap;

  &:disabled { opacity: 0.6; cursor: default; }

  .h {
    font-size: 15px;
    line-height: 1;
    color: ${({ $liked }) => ($liked ? '#ea1d1d' : '#fff')};
  }
`;

const LikeHeart = ({ modelUserId, stopPropagation = true }) => {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!modelUserId) return;
    let cancelled = false;
    (async () => {
      try {
        const s = await apiFetch(`/models/${modelUserId}/likes`);
        if (!cancelled) setState(s);
      } catch (e) {
        if (!cancelled) setState(null);
      }
    })();
    return () => { cancelled = true; };
  }, [modelUserId]);

  const toggle = useCallback(async (e) => {
    if (stopPropagation && e) { e.stopPropagation(); e.preventDefault(); }
    if (!modelUserId || busy) return;
    setBusy(true);
    try {
      const s = await apiFetch(`/models/${modelUserId}/likes/toggle`, { method: 'POST' });
      setState(s);
    } catch (err) {
      // silencioso: si falla, el estado no cambia
    } finally {
      setBusy(false);
    }
  }, [modelUserId, busy, stopPropagation]);

  if (!modelUserId) return null;

  const liked = !!state?.hasLiked;
  const count = state?.count ?? 0;

  return (
    <HeartBtn
      type="button"
      onClick={toggle}
      disabled={busy}
      $liked={liked}
      aria-label={i18n.t(liked ? 'modelProfileExpanded.likes.unlike' : 'modelProfileExpanded.likes.like')}
      title={i18n.t('modelProfileExpanded.likes.label')}
    >
      <span className="h">{liked ? '❤' : '🤍'}</span>
      {Number(count).toLocaleString('es-ES')}
    </HeartBtn>
  );
};

export default LikeHeart;
