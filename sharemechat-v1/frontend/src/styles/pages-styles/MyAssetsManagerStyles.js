// Estilos del gestor multi-asset (Capa 2): 5 fotos + 2 videos por modelo.
// Diseñado para integrarse dentro de PerfilModel.jsx como bloque.
// Sigue tokens y patrones visuales de PerfilClientModelStyle.

import styled from 'styled-components';

const surface = '#ffffff';
const surfaceMuted = '#f8fafb';
const border = '#e6e7ea';
const borderSoft = '#dde3ea';
const textMain = '#1f2933';
const textMuted = '#5b6470';
const accent = '#354556';
const cardShadow = '0 10px 30px rgba(17, 24, 39, 0.06)';

// Status colors
const okBg = '#edf6ef';
const okBorder = '#bfd6c6';
const okText = '#476755';
const warnBg = '#fdf6e3';
const warnBorder = '#e9d8a6';
const warnText = '#7a5a1f';
const dangerBg = '#fbf1f1';
const dangerBorder = '#dbbcbc';
const dangerText = '#8f5b5b';

export const ManagerSection = styled.section`
  margin-top: 18px;
  display: grid;
  gap: 18px;
`;

export const ManagerCard = styled.section`
  background: linear-gradient(180deg, #ffffff 0%, #fbfcfd 100%);
  border-radius: 24px;
  border: 1px solid ${border};
  box-shadow: ${cardShadow};
  padding: 22px;
  color: ${textMain};

  @media (max-width: 768px) {
    border-radius: 18px;
    padding: 18px;
  }
`;

export const ManagerCardHeader = styled.header`
  margin-bottom: 16px;
`;

export const ManagerCardTitle = styled.h3`
  margin: 0 0 6px;
  font-size: 1.06rem;
  line-height: 1.25;
  color: ${textMain};
`;

export const ManagerCardSubtitle = styled.p`
  margin: 0;
  font-size: 0.92rem;
  line-height: 1.62;
  color: ${textMuted};
`;

// Grid de slots: 5 fotos en flex-wrap, 2 vídeos en flex-wrap.
// Cada slot tiene tamaño fijo para evitar saltos de layout.
export const SlotsGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 8px;
`;

// Slot base (ocupado o vacío). Tamaño común.
const SLOT_PIC_SIZE = '140px';
const SLOT_VIDEO_SIZE = '200px';

export const SlotBase = styled.div`
  position: relative;
  width: ${({ $kind }) => ($kind === 'video' ? SLOT_VIDEO_SIZE : SLOT_PIC_SIZE)};
  height: ${SLOT_PIC_SIZE};
  border-radius: 16px;
  background: ${surfaceMuted};
  border: 1px solid ${borderSoft};
  /* Fase 7: SIN overflow:hidden aquí; el thumb hijo ya recorta su
     imagen al border-radius. Mantener overflow:hidden en el SlotBase
     cortaba el SlotMenuDropdown (180px) en slots PIC (140px), dejando
     el texto "Eliminar" cortado a "minar". En slots VIDEO (200px) no
     se notaba porque el dropdown sí cabía dentro del slot. */
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const SlotEmpty = styled.button`
  width: ${({ $kind }) => ($kind === 'video' ? SLOT_VIDEO_SIZE : SLOT_PIC_SIZE)};
  height: ${SLOT_PIC_SIZE};
  border-radius: 16px;
  border: 1px dashed #c5cdd6;
  background: ${surfaceMuted};
  color: #6d7784;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 0.86rem;
  font-weight: 600;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;

  &:hover:not(:disabled) {
    background: #eef2f6;
    border-color: #aab4c0;
    color: #3a4554;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
`;

export const SlotPlusIcon = styled.span`
  font-size: 1.8rem;
  line-height: 1;
  font-weight: 400;
  color: #889099;
`;

// Thumbnail del asset ocupado
export const SlotThumb = styled.div`
  position: absolute;
  inset: 0;
  background: #0f1419;
  cursor: pointer;
  overflow: hidden;
  border-radius: 16px;

  img,
  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
`;

// Estrella de "principal" sobreimpresa en la esquina superior izquierda
export const SlotPrincipalBadge = styled.span`
  position: absolute;
  top: 8px;
  left: 8px;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: rgba(255, 196, 0, 0.95);
  color: #5a3d00;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
  pointer-events: none;
`;

// Badge de estado (Aprobado / Pendiente / Rechazado), esquina inferior izquierda
export const SlotStatusBadge = styled.span`
  position: absolute;
  bottom: 8px;
  left: 8px;
  right: 40px;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  text-align: center;
  background: ${({ $variant }) =>
    $variant === 'approved' ? okBg : $variant === 'rejected' ? dangerBg : warnBg};
  color: ${({ $variant }) =>
    $variant === 'approved' ? okText : $variant === 'rejected' ? dangerText : warnText};
  border: 1px solid
    ${({ $variant }) =>
      $variant === 'approved' ? okBorder : $variant === 'rejected' ? dangerBorder : warnBorder};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
`;

// Botón "..." en esquina inferior derecha
export const SlotMenuButton = styled.button`
  position: absolute;
  bottom: 6px;
  right: 6px;
  width: 32px;
  height: 32px;
  border-radius: 999px;
  background: rgba(20, 26, 35, 0.78);
  color: #f6f8fa;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  font-weight: 700;
  line-height: 1;
  transition: background 0.15s ease;

  &:hover:not(:disabled) {
    background: rgba(20, 26, 35, 0.95);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

// Dropdown del menú "..." (posicionado sobre el slot)
export const SlotMenuDropdown = styled.div`
  position: absolute;
  bottom: 44px;
  right: 6px;
  background: ${surface};
  border: 1px solid ${border};
  border-radius: 12px;
  box-shadow: 0 6px 20px rgba(17, 24, 39, 0.16);
  min-width: 180px;
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
  font-size: 0.88rem;
  line-height: 1.62;
`;

export const ManagerMessage = styled.p`
  margin: 8px 0 0;
  padding: 10px 14px;
  border-radius: 14px;
  font-size: 0.9rem;
  line-height: 1.55;
  background: ${({ $type }) => ($type === 'error' ? dangerBg : okBg)};
  border: 1px solid ${({ $type }) => ($type === 'error' ? '#e7c7c7' : okBorder)};
  color: ${({ $type }) => ($type === 'error' ? dangerText : okText)};
`;

// Upload modal: contenido custom dentro de ModalBase
export const UploadBody = styled.div`
  display: grid;
  gap: 14px;
`;

export const UploadPickerRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
`;

export const UploadFileTag = styled.span`
  background: ${surfaceMuted};
  border: 1px solid ${border};
  padding: 6px 10px;
  border-radius: 10px;
  font-size: 0.82rem;
  color: ${textMain};
  max-width: 100%;
  word-break: break-all;
`;

export const UploadPreviewBox = styled.div`
  width: 100%;
  max-height: 320px;
  border-radius: 14px;
  overflow: hidden;
  background: ${surfaceMuted};
  border: 1px solid ${borderSoft};
  display: flex;
  align-items: center;
  justify-content: center;

  img,
  video {
    width: 100%;
    height: auto;
    max-height: 320px;
    object-fit: contain;
    display: block;
  }
`;

export const UploadNoticeBox = styled.p`
  margin: 0;
  padding: 10px 14px;
  background: #eef3f6;
  border: 1px solid #d9e0e7;
  color: #475668;
  border-radius: 12px;
  font-size: 0.86rem;
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
