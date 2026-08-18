// Estilos del modal "Ver perfil completo" del modelo (Capa 2 Fase 4).
// Diseñado para superponerse sobre la vista de favoritos del cliente
// como ventana modal apilada via ModalBase.

import styled from 'styled-components';

const surface = '#ffffff';
const surfaceMuted = '#f8fafb';
const border = '#e6e7ea';
const borderSoft = '#dde3ea';
const textMain = '#1f2933';
const textMuted = '#5b6470';
const accent = '#354556';
const dangerBg = '#fbf1f1';
const dangerBorder = '#dbbcbc';
const dangerText = '#8f5b5b';

// Card 1 Fase 2: panel inline (no modal) que continúa la página bajo el chat
// en favoritos, a todo el ancho.
export const ProfilePanel = styled.section`
  width: 100%;
  background: ${surface};
  color: ${textMain};
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
`;

export const PanelHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid ${border};
`;

export const PanelTitle = styled.h2`
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: ${textMain};
`;

export const PanelClose = styled.button`
  border: 0;
  background: transparent;
  color: #9aa4ad;
  font-size: 1.2rem;
  line-height: 1;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 8px;

  &:hover { background: ${surfaceMuted}; color: ${textMain}; }
`;

export const PanelInner = styled.div`
  padding: 22px 24px;
`;

export const ProfileBody = styled.div`
  display: grid;
  gap: 18px;
  width: 100%;
`;

// ---- Card 1 Fase 2: bloque "Datos" (stat-tiles) ----
export const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;

  @media (max-width: 820px) { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 460px) { grid-template-columns: repeat(2, 1fr); }
`;

export const Stat = styled.div`
  background: ${surfaceMuted};
  border: 1px solid ${border};
  border-radius: 14px;
  padding: 14px 12px;
  text-align: center;
`;

export const StatValue = styled.div`
  font-size: 1.25rem;
  font-weight: 800;
  color: ${textMain};

  small { font-size: 0.72rem; font-weight: 600; color: #8a939c; }
`;

export const StatLabel = styled.div`
  font-size: 0.72rem;
  color: #7c8792;
  margin-top: 4px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
`;

// ---- Card 1 Fase 2: bloque "Suele estar en línea" (histograma) ----
export const AvailabilityHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;

export const DayNav = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.86rem;
  font-weight: 600;
  color: ${textMuted};
`;

export const DayNavBtn = styled.button`
  border: 1px solid ${border};
  background: ${surface};
  color: #5b6470;
  border-radius: 8px;
  width: 26px;
  height: 26px;
  cursor: pointer;
  font-size: 0.95rem;
  line-height: 1;

  &:hover { background: ${surfaceMuted}; }
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
  min-height: 2px;
  height: ${({ $h }) => `${$h}%`};
  background: ${({ $peak }) => ($peak ? '#ea1d1d' : '#aebfcd')};
`;

export const BarLabels = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 0.7rem;
  color: #93a0ac;
  padding-top: 6px;
`;

export const AvailabilityNote = styled.div`
  font-size: 0.75rem;
  color: #93a0ac;
  margin-top: 6px;
`;

export const ProfileHeaderRow = styled.header`
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 18px;
  align-items: flex-start;

  @media (max-width: 720px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

// Foto principal grande (cabecera)
export const HeaderPhotoFrame = styled.div`
  width: 220px;
  height: 220px;
  border-radius: 18px;
  overflow: hidden;
  background: linear-gradient(180deg, #eef2f5 0%, #dde4eb 100%);
  border: 1px solid ${borderSoft};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: ${({ $clickable }) => ($clickable ? 'pointer' : 'default')};

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  @media (max-width: 720px) {
    width: 100%;
    height: 240px;
  }
`;

export const HeaderEmptyPhoto = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #95a0ab;
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
  font-size: 1.4rem;
  line-height: 1.1;
  color: ${textMain};
  letter-spacing: -0.01em;
  word-break: break-word;
`;

// ADR-052 Superficie 2: tarifa "X.XX EUR/min" bajo el nickname en el
// header del modal "Ver perfil completo".
export const RateBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 999px;
  background: #fff7e6;
  border: 1px solid #f0c274;
  color: #7a4b00;
  font-size: 0.86rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  width: fit-content;
`;

export const Biography = styled.p`
  margin: 0;
  font-size: 0.96rem;
  line-height: 1.55;
  color: #404a55;
  white-space: pre-wrap;
  word-break: break-word;
`;

export const InterestsLine = styled.p`
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.45;
  color: ${textMuted};
`;

export const InterestsLabel = styled.span`
  text-transform: uppercase;
  font-weight: 700;
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  color: #67727e;
  margin-right: 6px;
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
  padding: 4px 9px;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  background: ${({ $primary }) => ($primary ? '#eef3f6' : surfaceMuted)};
  border: 1px solid ${({ $primary }) => ($primary ? '#cbd6df' : border)};
  color: #45525f;

  &::first-letter {
    text-transform: uppercase;
  }
`;

export const SectionDivider = styled.hr`
  margin: 0;
  border: 0;
  border-top: 1px solid ${border};
`;

export const SectionTitle = styled.h3`
  margin: 0 0 10px;
  font-size: 1.02rem;
  line-height: 1.2;
  color: ${textMain};
`;

export const GallerySection = styled.section`
  display: grid;
  gap: 8px;
`;

// Grid de fotos aprobadas (responsive 3 cols desktop, 2 mobile)
export const PhotosGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
`;

export const PhotoThumb = styled.button`
  width: 100%;
  aspect-ratio: 1 / 1;
  padding: 0;
  border: 1px solid ${borderSoft};
  border-radius: 14px;
  background: ${surfaceMuted};
  overflow: hidden;
  cursor: pointer;
  display: block;
  position: relative;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  &:hover {
    border-color: #b8c1cc;
  }
`;

// Lista de vídeos: grid 2 cols desktop, 1 col mobile
export const VideosGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
`;

export const VideoThumb = styled.button`
  width: 100%;
  aspect-ratio: 16 / 10;
  padding: 0;
  border: 1px solid ${borderSoft};
  border-radius: 14px;
  background: #0f1419;
  overflow: hidden;
  cursor: pointer;
  display: block;
  position: relative;

  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  &:hover {
    border-color: #b8c1cc;
  }
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
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.45);

  &::before {
    content: '▶';
  }
`;

export const EmptyGalleryMsg = styled.p`
  margin: 0;
  padding: 12px 14px;
  border-radius: 12px;
  background: ${surfaceMuted};
  border: 1px dashed #d5dce4;
  color: #6d7784;
  font-size: 0.9rem;
  line-height: 1.45;
`;

// Bloque "Modelo no disponible"
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

// Lightbox interno (segundo ModalBase apilado)
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

export const ACCENT = accent;
