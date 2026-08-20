// Estilos del "Ver perfil completo" del modelo (Card 1).
// Card 1 Fase 2 (2026-08-18): rediseño OSCURO para casar con el mock
// (tarjeta oscura, texto claro, acentos rojos), renderizado dentro de un
// ModalBase con hideChrome (header propio con ✕, sin el chrome azul).

import styled from 'styled-components';

const panel = '#17191f';
const panelHeader = '#1c2027';
const surfaceMuted = '#20242b';
const line = 'rgba(255,255,255,0.08)';
const lineSoft = 'rgba(255,255,255,0.12)';
const textMain = '#e8ebef';
const textSoft = '#c4cad2';
const textMuted = '#98a1ad';
const red = '#ea1d1d';
const green = '#22c55e';
const amber = '#e2b03e';
const dangerBg = '#2a1c1c';
const dangerBorder = '#5a2f2f';
const dangerText = '#f0b4b4';

// Panel oscuro auto-contenido (dentro de ModalBase hideChrome).
export const ProfilePanel = styled.section`
  width: min(960px, 94vw);
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  background: ${panel};
  color: ${textMain};
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid ${line};
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
`;

export const PanelHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  background: ${panelHeader};
  border-bottom: 1px solid ${line};
  flex-shrink: 0;
`;

export const PanelTitle = styled.h2`
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: ${textMain};
`;

export const PanelClose = styled.button`
  border: 1px solid ${lineSoft};
  background: rgba(255, 255, 255, 0.06);
  color: ${textSoft};
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  width: 30px;
  height: 30px;
  border-radius: 50%;

  &:hover { background: rgba(255, 255, 255, 0.12); color: #fff; }
`;

export const PanelInner = styled.div`
  padding: 20px 22px 26px;
  overflow-y: auto;
`;

export const ProfileBody = styled.div`
  display: grid;
  gap: 18px;
  width: 100%;
`;

// Card 1 (2026-08-20): la cabecera pasa a ser un "cover" a lo ancho (misma
// presentación que el spotlight de favoritos: foto grande con nombre/presencia
// superpuestos sobre un velo degradado), y debajo los detalles. Antes era una
// fila de 2 columnas (foto cuadrada | info).
export const ProfileHeaderRow = styled.header`
  display: grid;
  gap: 16px;
`;

// Cover: foto principal a todo el ancho con velo inferior y datos encima.
export const Cover = styled.div`
  position: relative;
  width: 100%;
  height: 340px;
  border-radius: 16px;
  overflow: hidden;
  background: #0d1015;
  border: 1px solid ${line};
  cursor: ${({ $clickable }) => ($clickable ? 'pointer' : 'default')};

  img { width: 100%; height: 100%; object-fit: cover; display: block; }

  /* Velo inferior para legibilidad del nombre/presencia superpuestos. */
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(15,18,23,0) 40%, rgba(15,18,23,0.55) 72%, rgba(15,18,23,0.92) 100%);
    pointer-events: none;
  }

  @media (max-width: 720px) { height: 300px; }
`;

// Avatar de letra cuando el modelo no tiene foto principal aprobada.
export const CoverNoPhoto = styled.div`
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  font-size: 96px;
  font-weight: 800;
  color: #fff;
  background: linear-gradient(135deg, #ff5c8a, #a78bfa);
  user-select: none;
`;

export const CoverInfo = styled.div`
  position: absolute;
  left: 20px;
  right: 20px;
  bottom: 16px;
  z-index: 2;
`;

export const CoverName = styled.h2`
  margin: 0;
  font-size: 1.6rem;
  font-weight: 800;
  color: #fff;
  letter-spacing: -0.01em;
  line-height: 1.1;
  word-break: break-word;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.45);
`;

export const CoverPresence = styled.div`
  margin-top: 5px;
  font-size: 0.84rem;
  font-weight: 600;
  color: ${({ $online }) => ($online ? '#d7f7e3' : '#dfe4ea')};
  display: flex;
  align-items: center;
  gap: 7px;

  i {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
    flex: 0 0 auto;
    background: ${({ $online }) => ($online ? green : '#9aa4b0')};
    box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.18);
  }
`;

export const HeaderPhotoFrame = styled.div`
  width: 220px;
  height: 220px;
  border-radius: 16px;
  overflow: hidden;
  background: linear-gradient(180deg, #2a2f37 0%, #1d2128 100%);
  border: 1px solid ${line};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: ${({ $clickable }) => ($clickable ? 'pointer' : 'default')};

  img { width: 100%; height: 100%; object-fit: cover; display: block; }

  @media (max-width: 720px) {
    width: 100%;
    height: 260px;
  }
`;

export const HeaderEmptyPhoto = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${textMuted};
  font-size: 0.92rem;
  text-align: center;
  padding: 12px;
`;

export const HeaderInfo = styled.div`
  display: grid;
  gap: 10px;
  min-width: 0;
`;

export const Nickname = styled.h2`
  margin: 0;
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1.15;
  color: ${textMain};
  letter-spacing: -0.01em;
  word-break: break-word;
  display: flex;
  align-items: center;
  gap: 9px;
  flex-wrap: wrap;
`;

export const OnlineBadge = styled.span`
  font-size: 0.8rem;
  font-weight: 600;
  color: ${({ $online }) => ($online ? green : textMuted)};
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;

  &::before {
    content: '●';
    font-size: 0.7rem;
  }
`;

// Tarifa en granate suave (como el mock), no rojo fuerte.
export const RateBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 13px;
  border-radius: 999px;
  background: #3c151b;
  border: 1px solid rgba(234, 29, 29, 0.32);
  color: #e39098;
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  width: fit-content;
`;

// ---- Card 1 Fase 3: bloque de likes + insignia ----
export const LikesRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
`;

// Card 1 (2026-08-20): mismo diseño y hover que el "Like" del spotlight de
// favoritos (borde/relleno rojos por estado, elevación + escala del corazón).
export const LikeButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(234, 29, 29, 0.34);
  background: ${({ $on }) => ($on ? 'rgba(234,29,29,0.20)' : 'rgba(234,29,29,0.10)')};
  color: ${({ $on }) => ($on ? '#ff8a8a' : '#c3cad3')};
  border-radius: 11px;
  padding: 8px 15px;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.16s ease, border-color 0.16s ease, color 0.16s ease,
    transform 0.16s ease, box-shadow 0.16s ease;

  .heart { font-size: 1rem; line-height: 1; transition: transform 0.16s ease; }

  &:hover:not(:disabled) {
    background: rgba(234, 29, 29, 0.24);
    border-color: rgba(234, 29, 29, 0.60);
    color: #ffb3b3;
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(234, 29, 29, 0.22);
  }
  &:hover:not(:disabled) .heart { transform: scale(1.22); }
  &:active:not(:disabled) { transform: translateY(0) scale(0.97); }
  &:disabled { opacity: 0.6; cursor: default; }
`;

export const RankChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: ${surfaceMuted};
  border: 1px solid ${line};
  border-radius: 999px;
  padding: 5px 12px 5px 8px;
  font-size: 0.82rem;
  font-weight: 700;
  color: ${textMain};
`;

export const RankNone = styled.span`
  font-size: 0.82rem;
  color: ${textMuted};
`;

export const Biography = styled.p`
  margin: 0;
  font-size: 0.92rem;
  line-height: 1.55;
  color: ${textSoft};
  white-space: pre-wrap;
  word-break: break-word;
`;

export const InterestsLine = styled.div`
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.5;
  color: ${textSoft};
`;

export const InterestsLabel = styled.div`
  text-transform: uppercase;
  font-weight: 600;
  font-size: 0.66rem;
  letter-spacing: 0.06em;
  color: ${textMuted};
  margin-bottom: 6px;
`;

export const LanguageChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 2px;
`;

export const LanguageChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 11px;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 500;
  letter-spacing: 0.01em;
  background: ${surfaceMuted};
  border: 1px solid ${lineSoft};
  color: ${textSoft};

  &::first-letter { text-transform: uppercase; }
`;

// Chip de intereses: RELLENO granate oscuro (como el mock), no negro.
export const InterestChip = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 4px 11px;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 500;
  background: #3a1620;
  border: 1px solid rgba(234, 29, 29, 0.35);
  color: #e6c3c8;
`;

export const SectionDivider = styled.hr`
  margin: 0;
  border: 0;
  border-top: 1px solid ${line};
`;

export const SectionTitle = styled.h3`
  margin: 0 0 12px;
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.2;
  color: ${textMain};
`;

export const GallerySection = styled.section`
  display: grid;
  gap: 10px;
`;

// ---- Bloque "Datos" (stat-tiles oscuros) ----
export const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px 16px;

  @media (max-width: 560px) { grid-template-columns: repeat(2, 1fr); }
`;

// Transparente (como el mock): sin caja ni borde, solo valor + etiqueta.
export const Stat = styled.div`
  padding: 0;
`;

export const StatValue = styled.div`
  font-size: 1.08rem;
  font-weight: 700;
  color: ${textMain};

  small { font-size: 0.7rem; font-weight: 500; color: ${textMuted}; }
`;

export const StatLabel = styled.div`
  font-size: 0.72rem;
  color: ${textMuted};
  margin-top: 4px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

// ---- Bloque "Suele estar en línea" (histograma oscuro) ----
export const AvailabilityHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;

export const DayNav = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.86rem;
  font-weight: 600;
  color: ${textSoft};
`;

export const DayNavBtn = styled.button`
  border: 1px solid ${lineSoft};
  background: rgba(255, 255, 255, 0.05);
  color: ${textSoft};
  border-radius: 8px;
  width: 26px;
  height: 26px;
  cursor: pointer;
  font-size: 0.95rem;
  line-height: 1;

  &:hover { background: rgba(255, 255, 255, 0.12); }
`;

export const DayNavLabel = styled.span`
  min-width: 78px;
  text-align: center;
  color: ${textMain};
`;

export const Bars = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 120px;
  padding: 6px 2px 0;
`;

export const Bar = styled.span`
  flex: 1;
  border-radius: 4px 4px 0 0;
  min-height: 3px;
  height: ${({ $h }) => `${$h}%`};
  background: ${({ $peak }) => ($peak ? amber : '#3a4250')};
`;

export const BarLabels = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 0.7rem;
  color: ${textMuted};
  padding-top: 6px;
`;

export const AvailabilityNote = styled.div`
  font-size: 0.75rem;
  color: ${textMuted};
  margin-top: 6px;
`;

// ---- Galerías ----
export const PhotosGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
`;

export const PhotoThumb = styled.button`
  width: 100%;
  aspect-ratio: 1 / 1;
  padding: 0;
  border: 1px solid ${line};
  border-radius: 12px;
  background: ${surfaceMuted};
  overflow: hidden;
  cursor: pointer;
  display: block;
  position: relative;

  img { width: 100%; height: 100%; object-fit: cover; display: block; }
  &:hover { border-color: ${lineSoft}; }
`;

export const VideosGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
`;

export const VideoThumb = styled.button`
  width: 100%;
  aspect-ratio: 16 / 10;
  padding: 0;
  border: 1px solid ${line};
  border-radius: 12px;
  background: #0f1216;
  overflow: hidden;
  cursor: pointer;
  display: block;
  position: relative;

  video { width: 100%; height: 100%; object-fit: cover; display: block; }
  &:hover { border-color: ${lineSoft}; }
`;

export const PlayOverlay = styled.span`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  color: #ffffff;
  font-size: 2.2rem;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);

  &::before { content: '▶'; }
`;

export const EmptyGalleryMsg = styled.p`
  margin: 0;
  padding: 12px 14px;
  border-radius: 12px;
  background: ${surfaceMuted};
  border: 1px dashed ${lineSoft};
  color: ${textMuted};
  font-size: 0.9rem;
  line-height: 1.45;
`;

export const UnavailableBox = styled.div`
  padding: 18px;
  border-radius: 14px;
  background: ${dangerBg};
  border: 1px solid ${dangerBorder};
  color: ${dangerText};
  font-size: 0.96rem;
  line-height: 1.55;
  text-align: center;
`;

export const LoadingBox = styled.p`
  margin: 0;
  padding: 18px;
  color: ${textMuted};
  font-size: 0.9rem;
  text-align: center;
`;

export const LightboxFrame = styled.div`
  width: min(86vw, 800px);
  max-width: 100%;
  max-height: 82vh;
  border-radius: 16px;
  overflow: hidden;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;

  img,
  video {
    width: 100%;
    height: auto;
    max-height: 82vh;
    object-fit: contain;
    display: block;
  }
`;

export const ACCENT = red;
