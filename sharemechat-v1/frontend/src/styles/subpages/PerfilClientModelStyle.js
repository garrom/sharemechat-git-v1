// src/styles/subpages/PerfilClientModelStyle.js
import styled from 'styled-components';
import { bp, colors, radius, space, shadow } from '../core/tokens';
import { inputBase, buttonBase } from '../core/mixins';

/* ================== LAYOUT PERFIL (CLIENTE / MODELO) ================== */

export const PageWrap = styled.div`
  max-width: 720px;
  margin: ${space.xl} auto;
  padding: 0 ${space.lg} calc(${space.xl} * 2);

  @media (max-width: ${bp.md}) {
    margin: ${space.lg} auto;
    padding: 0 ${space.md} ${space.xl};
  }
`;

export const Title = styled.h2`
  margin: 0 0 ${space.lg};
  font-weight: 600;
  color: #fff;
`;

export const Message = styled.p`
  margin: ${space.sm} 0;
  color: ${({ type }) =>
    type === 'error'
      ? colors.error
      : type === 'ok'
      ? colors.ok
      : colors.text};

  ${({ $muted }) =>
    $muted &&
    `
      margin: 0;
      color: ${colors.textMuted};
    `}
`;

export const Form = styled.form`
  display: grid;
  gap: ${space.md};
`;

export const FormRow = styled.div`
  display: grid;
  gap: ${space.xs};
`;

export const Label = styled.label`
  font-size: 0.95rem;
  color: #e0e0e0;
`;

export const Input = styled.input`
  ${inputBase}
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  background: #2a2a2a;
  border: 1px solid #444;
  color: #fff;

  &::placeholder {
    color: #888;
  }

  /* aspecto de campo no editable (email) */
  &:read-only,
  &:disabled {
    background: #1b1b1b;
    border-color: #333;
    color: #aaa;
    cursor: default;
  }
`;


export const Textarea = styled.textarea`
  ${inputBase}
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  resize: vertical;
  min-height: 110px;
  background: #2a2a2a;
  border: 1px solid #444;
  color: #fff;

  &::placeholder {
    color: #888;
  }
`;


/* ================== BOTONES PERFIL (LEGADO, AÚN USADOS EN OTRAS PÁGINAS) ================== */

export const ButtonPrimary = styled.button`
  ${buttonBase}
  background: ${colors.success};
  color: ${colors.white};

  &:hover {
    background: ${colors.successHover};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

export const ButtonDangerOutline = styled.button`
  ${buttonBase}
  border: 1px solid ${colors.danger};
  background: ${colors.white};
  color: ${colors.danger};

  &:hover {
    background: #fff5f5;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

export const ButtonRow = styled.div`
  display: flex;
  gap: ${space.sm};
  align-items: center;
  flex-wrap: wrap;
`;

/* ================== ARCHIVOS (INPUT / LABEL / NOMBRE) ================== */

export const FileInput = styled.input`
  position: absolute;
  left: -9999px;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
`;

// OJO: ya no se usa como “botón” en PerfilClient, solo como helper legacy.
export const FileLabel = styled.label`
  ${buttonBase}
  border: 1px solid ${colors.border};
  background: ${colors.white};

  &:hover {
    background: #fafafa;
  }
`;

export const FileNameWrapper = styled.div`
  margin-top: ${space.xs};
  font-size: 0.9rem;
  color: ${colors.textMuted};
  word-break: break-all;
`;

/* ================== SECCIONES / TARJETAS (LEGADO) ================== */

export const Hr = styled.hr`
  margin: ${space.xl} 0;
  border: 0;
  border-top: 1px solid ${colors.borderSoft};
`;

export const SectionCard = styled.section`
  border: 1px solid ${colors.borderSoft};
  border-radius: ${radius.lg};
  padding: ${space.lg};
  box-shadow: ${shadow.card};
  background: ${colors.white};
  color: #333;
`;

export const SubSectionCard = styled.section`
  border-radius: ${radius.lg};
  padding: ${space.md};
  background: #f8f9fa;
  border: 1px solid ${colors.borderSoft};
`;

export const SectionTitle = styled.h3`
  margin: 0 0 ${space.md};
  font-weight: 600;
`;

/* ================== IMAGEN / VÍDEO (LEGADO) ================== */

export const Photo = styled.img`
  max-width: 220px;
  width: 100%;
  height: auto;
  border-radius: ${radius.lg};
  display: block;
  background: #eee;
`;

export const PhotoBlock = styled.div`
  margin-bottom: ${space.md};
`;

export const Video = styled.video`
  max-width: 100%;
  max-height: 300px;
  display: block;
  border-radius: ${radius.lg};
  background: #000;
  margin-bottom: ${space.sm};
`;

/* ================== TEXTOS AUXILIARES ================== */

export const Hint = styled.p`
  margin-top: ${space.sm};
  color: ${colors.textMuted};
  font-size: 0.95rem;
`;

/* ================== BOTÓN VOLVER NAVBAR (LEGADO) ================== */

export const BackButton = styled.button`
  ${buttonBase}
  border: 1px solid ${colors.white}40;
  background: transparent;
  color: ${colors.white};
  margin-left: ${space.sm};

  &:hover {
    background: ${colors.white}15;
  }

  @media (max-width: ${bp.md}) {
    margin-left: 0;
  }
`;

/* ================== LAYOUTS REUTILIZABLES (LEGADO, USADO POR OTRAS PÁGINAS) ================== */

export const CenteredMain = styled.main`
  flex: 1;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: ${space.lg} ${space.lg} calc(${space.xl} * 2);

  @media (max-width: ${bp.md}) {
    padding: ${space.md};
  }
`;

/* Tarjeta de onboarding genérica (para DashboardUserModel) */
export const OnboardingCard = styled.section`
  width: 100%;
  max-width: 720px;
  border-radius: ${radius.lg};
  padding: ${space.lg};
  margin: 0 auto;
  background: ${colors.white};
  box-shadow: ${shadow.card};
  color: #333;
  a {
    color: #000 !important;
  }

  a:visited {
    color: #000 !important;
  }

`;

/* =====================================================================
 * NUEVO LAYOUT PERFIL (MÁS ANCHO, ESTILO AZAR/COOMEET) PARA PERFILCLIENT
 * ===================================================================== */

export const ProfileMain = styled.main`
  flex: 1;
  max-width: 1100px;
  margin: ${space.xl} auto ${space.xl};
  padding: 0 ${space.lg} ${space.xl};

  @media (max-width: ${bp.md}) {
    margin-top: ${space.lg};
    padding: 0 ${space.md} ${space.lg};
  }
`;

/* CABECERA PERFIL */

export const ProfileHeader = styled.section`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: ${space.md};
  align-items: center;
  margin-bottom: ${space.md};

  @media (max-width: ${bp.md}) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

export const ProfileHeaderAvatar = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;

  @media (max-width: ${bp.md}) {
    justify-content: flex-start;
  }
`;

export const Avatar = styled.div`
  width: 86px;
  height: 86px;
  border-radius: 999px;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at top, #1f2937, #020617);
  border: 2px solid rgba(148, 163, 184, 0.5);
`;

export const AvatarImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`;

export const ProfileHeaderInfo = styled.div`
  min-width: 0;
`;

export const ProfileHeaderTitleRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${space.xs};
  margin-bottom: 4px;
`;

export const ProfileHeaderName = styled.h1`
  font-size: 1.3rem;
  margin: 0;
  color: #f8f9fa;
`;

export const ChipRole = styled.span`
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border: 1px solid rgba(56, 189, 248, 0.4);
  background: rgba(13, 110, 253, 0.12);
  color: #4dabff;
`;

export const ProfileHeaderSubtitle = styled.p`
  margin: 0;
  margin-bottom: 8px;
  font-size: 0.9rem;
  color: colors.textMuted || '#90949f';
`;

export const ProfileHeaderMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${space.md};
  font-size: 0.8rem;
`;

export const MetaItem = styled.span`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

export const MetaLabel = styled.span`
  color: ${colors.textMuted};
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.7rem;
`;

export const MetaValue = styled.span`
  color: #e5e7eb;
`;

export const MetaValueOk = styled(MetaValue)`
  color: #4ade80;
`;

/* GRID PRINCIPAL (2 COLUMNAS) */

export const ProfileGrid = styled.section`
  margin-top: ${space.lg};
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(0, 1.1fr);
  gap: ${space.lg};
  align-items: flex-start;

  @media (max-width: ${bp.md}) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

export const ProfileColMain = styled.div`
  min-width: 0;
`;

export const ProfileColSide = styled.div`
  min-width: 0;
`;

/* CARDS */

export const ProfileCard = styled.section`
  background: rgba(15, 23, 42, 0.98);
  border-radius: ${radius.lg};
  border: 1px solid ${colors.borderSoft};
  box-shadow: 0 18px 45px rgba(0, 0, 0, 0.55);
  padding: ${space.md} ${space.md} ${space.sm};
  color: #f8f9fa;
`;


export const MediaCard = styled(ProfileCard)`
  background: linear-gradient(135deg, #020617, #0f172a);
`;

export const SecurityCard = styled(ProfileCard)`
  background: linear-gradient(145deg, #020617, #111827);
`;

export const CardHeader = styled.header`
  margin-bottom: ${space.sm};
`;

export const CardTitle = styled.h2`
  margin: 0 0 4px;
  font-size: 1rem;
`;

export const CardSubtitle = styled.p`
  margin: 0;
  font-size: 0.86rem;
  color: ${colors.textMuted};
`;

export const CardBody = styled.div`
  margin-top: 4px;
`;

export const CardFooter = styled.footer`
  margin-top: ${space.sm};
  display: flex;
  justify-content: flex-end;
`;

/* FORM LAYOUT */
export const FormGridNew = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${space.sm};
  width: 100%;
`;

export const FormFieldNew = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

/* BLOQUE FOTO PERFIL */

export const PhotoPreview = styled.div`
  width: 100%;
  max-width: 230px;
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid ${colors.borderSoft};
  background: radial-gradient(circle at top, #111827, #020617);
`;

export const PhotoImg = styled.img`
  width: 100%;
  height: auto;
  object-fit: cover;
  display: block;
`;

export const PhotoEmpty = styled.p`
  font-size: 0.9rem;
  color: ${colors.textMuted};
`;

export const PhotoActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${space.xs};
  margin-top: ${space.xs};
`;

/* SEGURIDAD CUENTA */

export const SecurityActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${space.xs};
  margin-bottom: ${space.xs};
`;
