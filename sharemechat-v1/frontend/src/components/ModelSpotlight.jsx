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

import React, { useCallback, useEffect, useState } from 'react';
import styled from 'styled-components';
import i18n from '../i18n';
import { initialOf } from '../utils/defaultAvatar';
import { apiFetch } from '../config/http';
import RoyaltyBadge from './RoyaltyBadge';
import GiftIcon from './gifts/GiftIcon';
import {
  StyledGiftConfirmOverlay,
  StyledGiftConfirmCard,
  StyledGiftConfirmActions,
} from '../styles/pages-styles/VideochatStyles';

const t = (k, o) => i18n.t(k, o);
const badgeName = (code) => (code ? t(`modelProfileExpanded.badgeValues.${code}`, { defaultValue: code }) : null);

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
    object-position: 50% 20%;
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

// Sin foto (2026-09-02): inicial del nickname sobre círculo degradado (misma
// familia que LetterAvatar de la lista). La silueta negra queda SOLO para el
// avatar propio del navbar; cualquier OTRO usuario sin foto muestra su inicial.
const NoPhoto = styled.div`
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #ff5c8a, #a78bfa);
  color: #fff;
  font-weight: 800;
  font-size: 96px;
  line-height: 1;
  text-transform: uppercase;
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
  .l2 .warn { color: #ffd778; font-weight: 700; }
  .l2 .danger { color: #ffe0e0; font-weight: 700; }
  &:disabled .l2 { color: #7c8792; }
  &:disabled .l2 .warn, &:disabled .l2 .danger { color: #7c8792; font-weight: 400; }
  .arrow { position: absolute; right: 16px; top: 50%; transform: translateY(-50%); font-size: 18px; }
`;

const Rep = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 14px;
  padding: 12px 14px;
`;

const RepNum = styled.div`
  flex: 1;
  min-width: 0;
  .k { font-size: 18px; font-weight: 800; color: #fff; line-height: 1; }
  .s { font-size: 11.5px; color: #8b94a1; text-transform: uppercase; letter-spacing: .03em; margin-top: 2px; }
`;

const LikeBtn = styled.button`
  flex: 0 0 auto;
  border: 1px solid rgba(234,29,29,0.34);
  background: ${({ $liked }) => ($liked ? 'rgba(234,29,29,0.20)' : 'rgba(234,29,29,0.10)')};
  color: ${({ $liked }) => ($liked ? '#ff8a8a' : '#c3cad3')};
  border-radius: 11px;
  padding: 8px 13px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  white-space: nowrap;
  transition: background .16s ease, border-color .16s ease, color .16s ease, transform .16s ease, box-shadow .16s ease;

  .h { font-size: 15px; line-height: 1; transition: transform .16s ease; }

  &:hover:not(:disabled) {
    background: rgba(234,29,29,0.24);
    border-color: rgba(234,29,29,0.60);
    color: #ffb3b3;
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(234,29,29,0.22);
  }
  &:hover:not(:disabled) .h { transform: scale(1.22); }
  &:active:not(:disabled) { transform: translateY(0) scale(.97); }
  &:disabled { opacity: .6; cursor: default; }
`;

const Sec = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const SecH = styled.div`
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .05em;
  text-transform: uppercase;
  color: #8b94a1;
`;

const Facts = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
`;

const Fact = styled.div`
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 11px;
  padding: 9px 11px;
  .fl { font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: #8b94a1; font-weight: 700; }
  .fv { font-size: 13.5px; color: #e6eaef; margin-top: 2px; }
`;

// "ver perfil" discreto: texto (no botón) junto a la presencia, en el cover.
const VerPerfil = styled.button`
  appearance: none;
  border: 0;
  background: none;
  padding: 0;
  margin: 0;
  font: inherit;
  color: #e2e7ec;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
  text-decoration-color: rgba(255,255,255,0.4);
  &:hover { color: #fff; text-decoration-color: #fff; }
`;

const QGifts = styled.div`
  display: flex;
  gap: 7px;
  flex-wrap: wrap; /* varias filas si hace falta (el catálogo de pago son 8) */
`;

const QChip = styled.button`
  position: relative;
  flex: 0 0 auto;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.08);
  background: radial-gradient(circle at 50% 32%, rgba(255,255,255,0.09), rgba(255,255,255,0.02));
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: transform .12s ease, border-color .12s ease;
  &:hover:not(:disabled) { transform: translateY(-3px); border-color: rgba(255,255,255,0.28); }
  &:disabled { opacity: .5; cursor: not-allowed; }

  .pr {
    position: absolute;
    bottom: -5px;
    right: -5px;
    font-size: 8px;
    font-weight: 800;
    color: #2a1c04;
    background: linear-gradient(180deg, #ffd778, #f5b942);
    padding: 1px 5px;
    border-radius: 999px;
    white-space: nowrap;
  }
`;

// Chip de "escaparate" de regalos de pago en la columna del MODELO: NO es
// enviable (el modelo no envía regalos), es puramente informativo — muestra
// el catálogo de pago que el cliente puede enviarle, con su precio.
const ShowChip = styled.div`
  position: relative;
  flex: 0 0 auto;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border: 1px solid rgba(234,29,29,0.45);
  background: radial-gradient(circle at 50% 32%, rgba(234,29,29,0.18), rgba(234,29,29,0.05));
  display: grid;
  place-items: center;

  .pr {
    position: absolute;
    bottom: -5px;
    right: -5px;
    font-size: 8px;
    font-weight: 800;
    color: #2a1c04;
    background: linear-gradient(180deg, #ffd778, #f5b942);
    padding: 1px 5px;
    border-radius: 999px;
    white-space: nowrap;
  }
`;

const enumLabel = (kind, code) =>
  code ? t(`modelProfileExpanded.${kind}Values.${String(code).toUpperCase()}`, { defaultValue: String(code) }) : '';

const ModelSpotlight = ({ userId, nickname, presence, onStartCall, canCall = false, fmtEUR, saldo, onOpenProfile, onSendGift, gifts = [], giftSendEnabled = false, simple = false, giftShowcase = [] }) => {
  const [profile, setProfile] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [likes, setLikes] = useState(null);
  const [busyLike, setBusyLike] = useState(false);
  const [confirmGift, setConfirmGift] = useState(null);

  useEffect(() => {
    if (!userId) { setProfile(null); setPhoto(null); setLikes(null); return; }
    let cancelled = false;
    (async () => {
      // Foto/avatar siempre (cliente y modelo).
      try {
        const map = await apiFetch(`/users/avatars?ids=${encodeURIComponent(userId)}`);
        if (!cancelled) setPhoto((map && map[userId]) || null);
      } catch { if (!cancelled) setPhoto(null); }
      // Perfil público + likes SOLO para modelos (el cliente no los tiene).
      if (simple) { setProfile(null); setLikes(null); return; }
      try {
        const p = await apiFetch(`/models/${userId}/public-profile`);
        if (!cancelled) setProfile(p || null);
      } catch { if (!cancelled) setProfile(null); }
      try {
        const l = await apiFetch(`/models/${userId}/likes`);
        if (!cancelled) setLikes(l || null);
      } catch { if (!cancelled) setLikes(null); }
    })();
    return () => { cancelled = true; };
  }, [userId, simple]);

  const toggleLike = useCallback(async () => {
    if (!userId || busyLike) return;
    setBusyLike(true);
    try {
      const s = await apiFetch(`/models/${userId}/likes/toggle`, { method: 'POST' });
      setLikes(s);
    } catch { /* silencioso */ } finally { setBusyLike(false); }
  }, [userId, busyLike]);

  const pres = String(presence || 'offline').toLowerCase();
  const presMeta = pres === 'online'
    ? { c: '#22c55e', label: t('common.presence.online', 'en línea') }
    : pres === 'busy'
    ? { c: '#f59e0b', label: t('common.presence.busy', 'ocupado') }
    : { c: '#8891a0', label: t('common.presence.offline', 'desconectado') };

  const name = nickname || profile?.nickname || '';

  const rate = profile?.chosenRateEurPerMin != null ? Number(profile.chosenRateEurPerMin) : null;
  const rateTxt = rate != null
    ? (typeof fmtEUR === 'function' ? fmtEUR(rate) : `${rate.toFixed(2)} €`)
    : null;
  const saldoNum = saldo != null ? Number(saldo) : null;
  // Aviso de saldo en el CTA: umbral plano de 3 € (no se compara con la tarifa,
  // que resultaba engañoso: una llamada se cobra por minuto y se corta sola).
  // saldo >= 3 € -> sin coletilla; 0 < saldo < 3 € -> "saldo bajo" (ámbar);
  // saldo <= 0 -> "recarga para llamar".
  const LOW_BALANCE_EUR = 3;
  const balanceHint = saldoNum == null
    ? null
    : saldoNum <= 0
    ? { txt: t('modelSpotlight.rechargeToCall', 'recarga para llamar'), tone: 'danger' }
    : saldoNum < LOW_BALANCE_EUR
    ? { txt: t('modelSpotlight.lowBalance', 'saldo bajo'), tone: 'warn' }
    : null;

  // Datos físicos (los que la modelo haya rellenado) + idioma.
  const langTxt = (profile?.languages || [])
    .map((l) => String(l?.langCode || '').toUpperCase())
    .filter(Boolean)
    .join(' · ');
  // Orden de prioridad: los 2 primeros son los que se muestran en el spotlight
  // (fijados a Idioma + Cuerpo); el resto queda para "ver perfil".
  const facts = [];
  if (langTxt) facts.push({ l: t('modelProfileExpanded.labels.languages', 'Idioma'), v: langTxt });
  if (profile?.bodyType) facts.push({ l: t('modelProfileExpanded.labels.body', 'Cuerpo'), v: enumLabel('body', profile.bodyType) });
  if (profile?.heightCm != null) facts.push({ l: t('modelProfileExpanded.labels.height', 'Altura'), v: `${profile.heightCm} cm` });
  if (profile?.bustSize) facts.push({ l: t('modelProfileExpanded.labels.bust', 'Pecho'), v: enumLabel('bust', profile.bustSize) });

  // Regalos del spotlight: los de PAGO (premium). Se envían con modal de
  // confirmación (coste). Los gratis viven en la barra 🎁 del chat.
  const paidGifts = (gifts || []).filter((g) => String(g?.tier || '').toUpperCase() === 'PREMIUM');
  const fmt = (v) => (typeof fmtEUR === 'function' ? fmtEUR(v) : `${Number(v || 0).toFixed(2)} €`);

  return (
    <Panel>
      <Cover>
        {photo ? <img src={photo} alt="" /> : (
          <NoPhoto aria-hidden="true">{initialOf(name)}</NoPhoto>
        )}
        <CoverInfo>
          <Name>{name}</Name>
          <Presence $c={presMeta.c}>
            <i />
            <span>
              {presMeta.label}
              {onOpenProfile && (
                <>
                  {' · '}
                  <VerPerfil
                    type="button"
                    onClick={() => onOpenProfile({ id: userId, nickname: name, presence: pres })}
                  >
                    {t('modelSpotlight.viewProfile', 'ver perfil')}
                  </VerPerfil>
                </>
              )}
            </span>
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
              {balanceHint && <> · <span className={balanceHint.tone}>{balanceHint.txt}</span></>}
            </span>
          )}
          <span className="arrow">›</span>
        </Cta>

        {likes && (
          <Rep>
            <RoyaltyBadge code={likes.badgeCode || 'TIARA'} size={38} title={badgeName(likes.badgeCode) || ''} />
            <RepNum>
              <div className="k">{Number(likes.count || 0).toLocaleString('es-ES')}</div>
              <div className="s">{likes.badgeCode ? badgeName(likes.badgeCode) : t('modelReputation.noBadge', 'Aún sin insignia')}</div>
            </RepNum>
            <LikeBtn
              type="button"
              $liked={!!likes.hasLiked}
              disabled={busyLike}
              onClick={toggleLike}
              aria-label={t(likes.hasLiked ? 'modelProfileExpanded.likes.unlike' : 'modelProfileExpanded.likes.like', 'Like')}
            >
              <span className="h">{likes.hasLiked ? '❤' : '🤍'}</span> {t('modelSpotlight.like', 'Like')}
            </LikeBtn>
          </Rep>
        )}

        {facts.length > 0 && (
          <Sec>
            <SecH>{t('modelProfileExpanded.sections.data', 'Datos')}</SecH>
            <Facts>
              {/* Solo 2 datos en el spotlight; el resto en "ver perfil". Por
                  ahora los 2 primeros por prioridad (Altura, Cuerpo); pendiente
                  hacerlo elegible por la modelo. */}
              {facts.slice(0, 2).map((f, i) => (
                <Fact key={i}>
                  <div className="fl">{f.l}</div>
                  <div className="fv">{f.v}</div>
                </Fact>
              ))}
            </Facts>
          </Sec>
        )}

        {paidGifts.length > 0 && (
          <Sec>
            <SecH>{t('modelSpotlight.giftTitle', 'Enviar un regalo')}</SecH>
            <QGifts>
              {paidGifts.map((g) => (
                <QChip
                  key={g.id}
                  type="button"
                  disabled={!giftSendEnabled}
                  title={g.name}
                  aria-label={g.name}
                  onClick={() => { if (giftSendEnabled) setConfirmGift(g); }}
                >
                  <GiftIcon code={g.code} alt={g.name || ''} size={22} />
                  <span className="pr">{fmt(g.cost)}</span>
                </QChip>
              ))}
            </QGifts>
          </Sec>
        )}

        {/* Escaparate de regalos de pago (lado MODELO). Informativo: el
            catálogo de pago que el cliente puede enviarle, con su precio. */}
        {giftShowcase.length > 0 && (
          <Sec>
            <SecH>{t('modelSpotlight.showcaseTitle', 'Regalos disponibles por el cliente')}</SecH>
            <QGifts>
              {giftShowcase.map((g) => (
                <ShowChip
                  key={g.id}
                  title={`${g.name || ''} · ${fmt(g.cost)}`}
                  aria-label={`${g.name || ''} · ${fmt(g.cost)}`}
                >
                  <GiftIcon code={g.code} alt={g.name || ''} size={22} />
                  <span className="pr">{fmt(g.cost)}</span>
                </ShowChip>
              ))}
            </QGifts>
          </Sec>
        )}
      </Body>

      {confirmGift && (() => {
        const cost = Number(confirmGift.cost || 0);
        const saldoN = Number(saldo || 0);
        const insufficient = cost > saldoN;
        const close = () => setConfirmGift(null);
        const confirm = () => { if (insufficient) return; if (onSendGift) onSendGift(confirmGift.id); close(); };
        return (
          <StyledGiftConfirmOverlay onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
            <StyledGiftConfirmCard>
              <GiftIcon code={confirmGift.code} alt={confirmGift.name || ''} size={92} />
              <h3>{confirmGift.name}</h3>
              <div className="gift-confirm__price">{fmt(confirmGift.cost)}</div>
              <div className="gift-confirm__to">
                {t('dashboardClient.videoChatFavoritosCliente.gifts.to', 'Para')} <strong>{name}</strong>
              </div>
              <div className="gift-confirm__bal" data-insufficient={insufficient}>
                {insufficient
                  ? t('dashboardClient.videoChatFavoritosCliente.gifts.insufficient', 'Saldo insuficiente')
                  : `${t('dashboardClient.videoChatFavoritosCliente.gifts.balance', 'Saldo')} ${fmt(saldoN)} · ${t('dashboardClient.videoChatFavoritosCliente.gifts.remaining', 'te quedarán')} ${fmt(saldoN - cost)}`}
              </div>
              <StyledGiftConfirmActions>
                <button type="button" data-role="cancel" onClick={close}>
                  {t('common.cancel', 'Cancelar')}
                </button>
                <button type="button" data-role="confirm" disabled={insufficient} onClick={confirm}>
                  {t('dashboardClient.videoChatFavoritosCliente.gifts.send', 'Enviar regalo')}
                </button>
              </StyledGiftConfirmActions>
            </StyledGiftConfirmCard>
          </StyledGiftConfirmOverlay>
        );
      })()}
    </Panel>
  );
};

export default ModelSpotlight;
