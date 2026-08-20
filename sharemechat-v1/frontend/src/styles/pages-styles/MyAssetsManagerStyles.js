// Estilos del gestor multi-asset (Capa 2): 5 fotos + 2 videos por modelo.
// Diseñado para integrarse dentro de PerfilModel.jsx como bloque.
// Rediseño UX perfil (2026-08-20): SOLO ASPECTO. La lógica del gestor
// (endpoints, validación, límites, revisión, principal, modal, lightbox) NO se
// toca; aquí solo se restylea a la estética del mock (foto 3/4, vídeo 16/9,
// badges de estado con color, estrella principal roja, "+" rojo, título con
// barra de acento roja).

import styled from 'styled-components';

const surface = '#ffffff';
const surfaceMuted = '#f8fafb';
const border = '#e6e7ea';
const borderSoft = '#dde3ea';
const textMain = '#1b2027';
const textMuted = '#8b93a1';
const accent = '#354556';
const cardShadow = '0 1px 2px rgba(16,20,30,0.04), 0 8px 24px rgba(16,20,30,0.05)';

// Marca
const red = '#ea1d1d';
const redSoft = '#fbeaea';
const redLine = 'rgba(234,29,29,0.28)';

// Status colors (badge con relleno de color, sobre el thumbnail)
const okBg = 'rgba(31,157,87,0.95)';
const okText = '#ffffff';
const warnBg = 'rgba(224,176,49,0.97)';
const warnText = '#3a2a02';
const dangerBgSolid = 'rgba(176,64,47,0.97)';
const dangerTextSolid = '#ffffff';
// Nota de rechazo (bloque bajo el slot): tono claro legible
const dangerBg = '#fbf1f1';
const dangerBorder = '#dbbcbc';
const dangerText = '#8f5b5b';

export const ManagerSection = styled.section`
  margin-top: 0;
  display: grid;
  gap: 16px;
`;

export const ManagerCard = styled.section`
  background: ${surface};
  border-radius: 14px;
  border: 1px solid ${border};
  box-shadow: ${cardShadow};
  padding: 18px 20px;
  color: ${textMain};

  @media (max-width: 768px) {
    border-radius: 14px;
    padding: 16px;
  }
`;

export const ManagerCardHeader = styled.header`
  margin-bottom: 14px;
`;

/* Título con barra de acento roja (coherente con las secciones del perfil). */
export const ManagerCardTitle = styled.h3`
  margin: 0 0 3px;
  font-size: 0.98rem;
  font-weight: 800;
  letter-spacing: -0.01em;
  line-height: 1.25;
  color: ${textMain};
  display: flex;
  align-items: center;
  gap: 9px;

  &::before {
    content: '';
    width: 3px;
    height: 15px;
    border-radius: 2px;
    background: ${red};
    flex-shrink: 0;
  }
`;

export const ManagerCardSubtitle = styled.p`
  margin: 0 0 0 12px;
  font-size: 0.8rem;
  line-height: 1.55;
  color: ${textMuted};
`;

/* Grid de slots: flex-wrap; cada slot se dimensiona por ancho (5 fotos / 2
   vídeos por fila) y su alto lo marca el aspect-ratio. */
export const SlotsGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
`;

/* Slot base (ocupado). 5 fotos por fila (aspect 3/4) o 2 vídeos (aspect 16/9). */
export const SlotBase = styled.div`
  position: relative;
  flex: 0 0 auto;
  width: ${({ $kind }) => ($kind === 'video' ? 'calc((100% - 10px) / 2)' : 'calc((100% - 40px) / 5)')};
  aspect-ratio: ${({ $kind }) => ($kind === 'video' ? '16 / 9' : '3 / 4')};
  border-radius: 12px;
  background: ${surfaceMuted};
  border: 1px solid ${borderSoft};
  display: flex;
  align-items: center;
  justify-content: center;

  @media (max-width: 640px) {
    width: ${({ $kind }) => ($kind === 'video' ? 'calc((100% - 10px) / 2)' : 'calc((100% - 20px) / 3)')};
  }
`;

export const SlotEmpty = styled.button`
  flex: 0 0 auto;
  width: ${({ $kind }) => ($kind === 'video' ? 'calc((100% - 10px) / 2)' : 'calc((100% - 40px) / 5)')};
  aspect-ratio: ${({ $kind }) => ($kind === 'video' ? '16 / 9' : '3 / 4')};
  border-radius: 12px;
  border: 1.5px dashed ${redLine};
  background: ${redSoft};
  color: ${red};
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  font-size: 0.78rem;
  font-weight: 700;
  text-align: center;
  padding: 4px;
  transition: filter 0.15s ease, border-color 0.15s ease;

  &:hover:not(:disabled) {
    filter: brightness(0.99);
    border-color: rgba(234,29,29,0.5);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  @media (max-width: 640px) {
    width: ${({ $kind }) => ($kind === 'video' ? 'calc((100% - 10px) / 2)' : 'calc((100% - 20px) / 3)')};
  }
`;

export const SlotPlusIcon = styled.span`
  font-size: 1.5rem;
  line-height: 1;
  font-weight: 400;
  color: ${red};
`;

// Thumbnail del asset ocupado
export const SlotThumb = styled.div`
  position: absolute;
  inset: 0;
  background: #0f1419;
  cursor: pointer;
  overflow: hidden;
  border-radius: 12px;

  img,
  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
`;

// Estrella "principal" (esquina superior izquierda) — roja de marca
export const SlotPrincipalBadge = styled.span`
  position: absolute;
  top: 6px;
  left: 6px;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: rgba(234,29,29,0.92);
  color: #ffffff;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  pointer-events: none;
  z-index: 2;
`;

// Badge de estado (Aprobado / Pendiente / Rechazado) — esquina superior derecha,
// relleno de color sobre el thumbnail.
export const SlotStatusBadge = styled.span`
  position: absolute;
  top: 6px;
  right: 6px;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 0.56rem;
  font-weight: 800;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  background: ${({ $variant }) =>
    $variant === 'approved' ? okBg : $variant === 'rejected' ? dangerBgSolid : warnBg};
  color: ${({ $variant }) =>
    $variant === 'approved' ? okText : $variant === 'rejected' ? dangerTextSolid : warnText};
  white-space: nowrap;
  pointer-events: none;
  z-index: 2;
`;

// Botón "..." en esquina inferior derecha
export const SlotMenuButton = styled.button`
  position: absolute;
  bottom: 6px;
  right: 6px;
  width: 26px;
  height: 26px;
  border-radius: 999px;
  background: rgba(15, 20, 25, 0.6);
  color: #f6f8fa;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1;
  z-index: 2;
  transition: background 0.15s ease;

  &:hover:not(:disabled) {
    background: rgba(15, 20, 25, 0.85);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

// Dropdown del menú "..." (posicionado sobre el slot)
export const SlotMenuDropdown = styled.div`
  position: absolute;
  bottom: 38px;
  right: 6px;
  background: ${surface};
  border: 1px solid ${border};
  border-radius: 12px;
  box-shadow: 0 6px 20px rgba(17, 24, 39, 0.16);
  min-width: 170px;
  z-index: 10;
  overflow: hidden;
`;

export const SlotMenuItem = styled.button`
  width: 100%;
  padding: 10px 14px;
  border: none;
  background: transparent;
  color: ${({ $danger }) => ($danger ? dangerText : textMain)};
  text-align: left;
  cursor: pointer;
  font-size: 0.88rem;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background 0.12s ease;

  &:hover:not(:disabled) {
    background: ${({ $danger }) => ($danger ? dangerBg : surfaceMuted)};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  & + & {
    border-top: 1px solid ${borderSoft};
  }
`;

// Mensaje pequeño bajo el grid (motivo de rechazo, etc.)
export const SlotRejectionNote = styled.div`
  width: 100%;
  margin-top: 4px;
  padding: 10px 12px;
  background: ${dangerBg};
  border: 1px solid ${dangerBorder};
  color: ${dangerText};
  border-radius: 12px;
  font-size: 0.84rem;
  line-height: 1.5;

  strong {
    font-weight: 700;
  }
`;

export const ManagerHint = styled.p`
  margin: 10px 0 0;
  color: ${textMuted};
  font-size: 0.8rem;
  line-height: 1.55;
`;

export const ManagerMessage = styled.p`
  margin: 8px 0 0;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 0.9rem;
  line-height: 1.55;
  background: ${({ $type }) => ($type === 'error' ? dangerBg : '#edf6ef')};
  border: 1px solid ${({ $type }) => ($type === 'error' ? '#e7c7c7' : '#bfd6c6')};
  color: ${({ $type }) => ($type === 'error' ? dangerText : '#476755')};
`;

/* ---- Modal de subida (contenido dentro de ModalBase) — restyle ---- */
export const UploadBody = styled.div`
  display: grid;
  gap: 14px;
`;

// Zona "elegir archivo": dropzone clara, punteada, con acento rojo al hover.
export const UploadPickerRow = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 20px 16px;
  border: 1.5px dashed ${redLine};
  background: ${redSoft};
  border-radius: 14px;
  text-align: center;

  button {
    ${''}
  }
`;

export const UploadFileTag = styled.span`
  background: ${surface};
  border: 1px solid ${border};
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 0.82rem;
  color: ${textMain};
  max-width: 100%;
  word-break: break-all;
`;

export const UploadPreviewBox = styled.div`
  width: 100%;
  max-height: 340px;
  border-radius: 14px;
  overflow: hidden;
  background: #0f1419;
  border: 1px solid ${borderSoft};
  display: flex;
  align-items: center;
  justify-content: center;

  img,
  video {
    width: 100%;
    height: auto;
    max-height: 340px;
    object-fit: contain;
    display: block;
  }
`;

// Aviso de revisión: discreto, con barra de acento roja.
export const UploadNoticeBox = styled.p`
  margin: 0;
  padding: 10px 12px 10px 14px;
  background: ${surfaceMuted};
  border: 1px solid ${border};
  border-left: 3px solid ${red};
  color: ${textMuted};
  border-radius: 10px;
  font-size: 0.82rem;
  line-height: 1.55;
`;

// Hidden file input
export const HiddenFileInput = styled.input`
  position: absolute;
  left: -9999px;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
`;

// Lightbox content (asset viewer ampliado)
export const LightboxFrame = styled.div`
  width: min(82vw, 720px);
  max-width: 100%;
  max-height: 80vh;
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
    max-height: 80vh;
    object-fit: contain;
    display: block;
  }
`;

// Accent re-export for inline usage
export const ACCENT = accent;
