// src/components/ModelSpotlight.jsx
//
// Rediseño Favoritos Fase 3: columna derecha "spotlight" de la modelo que el
// cliente está viendo/chateando. Se monta en StyledRightColumn (favoritos,
// desktop). Contenido en construcción por pasos:
//   Paso 1 (este): COVER — foto grande (o avatar de letra si no hay) + nombre +
//                  presencia + edad. El resto (CTA videollamada, reputación,
//                  datos físicos, regalos, ver perfil) llega en pasos siguientes.
//
// Datos:
//   GET /api/models/{id}/public-profile → ModelPublicProfileDTO (age, físicos,
//                                         tarifa, disponibilidad...)
//   GET /api/users/avatars?ids={id}     → foto (misma que la lista/cabecera)
//   La presencia llega por prop (misma fuente Redis que el punto del listado).

import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import i18n from '../i18n';
import { apiFetch } from '../config/http';

const t = (k, o) => i18n.t(k, o);

const Panel = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 0;
`;

const Cover = styled.div`
  position: relative;
  height: 230px;
  flex: 0 0 auto;
  background: #0d1015;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  /* Velo inferior para fundir la foto con el cuerpo oscuro y dar legibilidad al
     nombre/presencia superpuestos. */
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(15,18,23,0) 35%, rgba(15,18,23,0.55) 70%, #14171d 100%);
    pointer-events: none;
  }
`;

const NoPhoto = styled.div`
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  font-size: 72px;
  font-weight: 800;
  color: #fff;
  background: linear-gradient(135deg, #ff5c8a, #a78bfa);
  user-select: none;
`;

const CoverInfo = styled.div`
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: 12px;
  z-index: 2;
`;

const Name = styled.div`
  font-size: 21px;
  font-weight: 800;
  color: #fff;
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Presence = styled.div`
  font-size: 12.5px;
  color: #d7f7e3;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 3px;

  i {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    display: inline-block;
    flex: 0 0 auto;
    background: ${({ $c }) => $c || '#8891a0'};
  }
`;

const Body = styled.div`
  padding: 14px 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
`;

// CTA "Iniciar videollamada" (acción principal del spotlight).
const Cta = styled.button`
  display: block;
  width: 100%;
  border: 0;
  cursor: pointer;
  text-align: left;
  position: relative;
  border-radius: 14px;
  padding: 13px 16px;
  color: #fff;
  background: linear-gradient(180deg, #ea1d1d, #b91212);
  box-shadow: 0 10px 24px rgba(234,29,29,0.28);

  &:hover:not(:disabled) { filter: brightness(1.08); }
  &:disabled {
    background: rgba(255,255,255,0.06);
    color: #7c8792;
    box-shadow: none;
    border: 1px solid rgba(255,255,255,0.08);
    cursor: not-allowed;
  }

  .l1 { font-size: 15.5px; font-weight: 800; display: flex; align-items: center; gap: 9px; }
  .l2 { font-size: 12px; color: rgba(255,255,255,0.82); margin-top: 2px; }
  &:disabled .l2 { color: #7c8792; }
  .arrow { position: absolute; right: 16px; top: 50%; transform: translateY(-50%); font-size: 18px; }
`;

const ModelSpotlight = ({ userId, nickname, presence, onStartCall, canCall = false, fmtEUR, saldo }) => {
  const [profile, setProfile] = useState(null);
  const [photo, setPhoto] = useState(null);

  useEffect(() => {
    if (!userId) { setProfile(null); setPhoto(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const p = await apiFetch(`/models/${userId}/public-profile`);
        if (!cancelled) setProfile(p || null);
      } catch { if (!cancelled) setProfile(null); }
      try {
        const map = await apiFetch(`/users/avatars?ids=${encodeURIComponent(userId)}`);
        if (!cancelled) setPhoto((map && map[userId]) || null);
      } catch { if (!cancelled) setPhoto(null); }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const pres = String(presence || 'offline').toLowerCase();
  const presMeta = pres === 'online'
    ? { c: '#22c55e', label: t('common.presence.online', 'en línea') }
    : pres === 'busy'
    ? { c: '#f59e0b', label: t('common.presence.busy', 'ocupado') }
    : { c: '#8891a0', label: t('common.presence.offline', 'desconectado') };

  const name = nickname || profile?.nickname || '';
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  const age = profile?.age;

  const rate = profile?.chosenRateEurPerMin != null ? Number(profile.chosenRateEurPerMin) : null;
  const rateTxt = rate != null
    ? (typeof fmtEUR === 'function' ? fmtEUR(rate) : `${rate.toFixed(2)} €`)
    : null;
  const saldoNum = saldo != null ? Number(saldo) : null;
  const balanceOk = (rate != null && saldoNum != null) ? saldoNum >= rate : null;

  return (
    <Panel>
      <Cover>
        {photo ? <img src={photo} alt="" /> : <NoPhoto aria-hidden="true">{initial}</NoPhoto>}
        <CoverInfo>
          <Name>{name}</Name>
          <Presence $c={presMeta.c}>
            <i />
            {presMeta.label}{age ? ` · ${age} ${t('modelSpotlight.yearsSuffix', 'años')}` : ''}
          </Presence>
        </CoverInfo>
      </Cover>
      <Body>
        <Cta
          type="button"
          disabled={!canCall}
          onClick={() => { if (canCall && onStartCall) onStartCall(); }}
          title={!canCall ? t('modelSpotlight.callDisabled', 'Debéis ser favoritos aceptados para poder llamar') : ''}
        >
          <span className="l1">📹 {t('modelSpotlight.videocall', 'Iniciar videollamada')}</span>
          {rateTxt && (
            <span className="l2">
              {rateTxt} / min
              {balanceOk === true ? ` · ${t('modelSpotlight.balanceOk', 'saldo suficiente')}`
                : balanceOk === false ? ` · ${t('modelSpotlight.balanceLow', 'saldo insuficiente')}`
                : ''}
            </span>
          )}
          <span className="arrow">›</span>
        </Cta>

        {/* Paso 3+: reputación/likes, datos físicos, regalos, ver perfil completo. */}
      </Body>
    </Panel>
  );
};

export default ModelSpotlight;
