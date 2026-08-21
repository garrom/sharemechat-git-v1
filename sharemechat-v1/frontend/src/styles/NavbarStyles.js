// src/styles/NavbarStyles.js
//
// ATENCIÓN — módulo con nombre histórico que exporta MÁS de lo que sugiere:
//
//   1. Componentes del navbar propiamente (StyledNavbar, StyledBrand,
//      NavText, QueueText, SaldoText, StyledNavActionsRow, StyledNavAvatar,
//      StyledNavIconButton, LocaleSwitch, LocaleButton, HamburgerButton,
//      MobileMenu, MobileBottomNav, BottomNavButton, StyledNavTab).
//   2. **PageShell** (línea ~57, wrapper de página de CONTENIDO con
//      min-height:100vh + scroll de body tradicional). Consumido por
//      PerfilClient/PerfilMaster/PerfilModel. Es primo de DashboardShell
//      (VideochatStyles.js), que es la variante app-like con altura fija
//      y sin scroll de body. Ver docs/04-operations/scroll-dashboard-
//      favoritos-investigation-2026-08-08.md y auditoría en el mismo
//      directorio.
//
// Renombrar el archivo a algo tipo "NavbarAndPageStyles.js" o mover
// PageShell a un módulo LayoutShells.js dedicado es deuda cosmética
// (Fase F-full del refactor 2026-08-08, no ejecutada por relación
// coste/beneficio). Antes de editar exports aquí: verificar unicidad del
// nombre con grep (ver memory/feedback_styled_components_verify_uniqueness).
import styled from 'styled-components';
import { colors, radius, space, shadow } from './core/tokens';

const NAV_COLLAPSE_BP = '1360px';

// === NAVBAR PRINCIPAL ===
export const StyledNavbar = styled.nav`
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: var(--navbar-height-desktop);
  padding: 0 ${space.lg};
  background: ${p => p.$bg || '#111418'};
  backdrop-filter: none;
  box-shadow: none;
  position: sticky;
  top: 0;
  z-index: 1000;
  flex-wrap: nowrap;
  gap: ${space.sm};

  & > * {
    flex-shrink: 0;
    min-width: 0;
  }

  @media (max-width: ${NAV_COLLAPSE_BP}) {
    height: var(--navbar-height);
    padding: 0 ${space.md};

    .desktop-only,
    [data-nav-group] {
      display: none !important;
    }
  }

  @media (max-width: 640px) {
    padding: 0 ${space.md};
  }
`;

// Logotipo
export const StyledBrand = styled.a`
  display: block;
  width: 220px;
  height: 64px;
  background: url('/img/SharemeChat_white.svg') no-repeat center / contain;
  text-indent: -9999px;
  flex: 0 0 auto;

  @media (max-width: 640px) {
    width: 180px;
    height: 52px;
  }
`;

// === PageShell ===
// Wrapper de página de contenido con scroll de body tradicional. Crece
// con el contenido; el viewport hace scroll cuando el contenido excede
// 100vh. Se usa en páginas informativas: Perfil (Client/Master/Model),
// legal, coming-soon, KYC steps. Para páginas app-like con chat/streaming
// interno usa DashboardShell (VideochatStyles.js), que garantiza
// height:100vh + overflow:hidden y delega scroll a los scrollers hijos.
//
// Renombrado desde StyledContainer 2026-08-08 tras investigación
// (docs/04-operations/scroll-dashboard-favoritos-investigation-2026-08-08.md):
// coexistían dos StyledContainer con semántica distinta (este + el de
// VideochatStyles) y JavaScript resolvía imports por orden sin warning,
// causando confusión de diagnóstico.
export const PageShell = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  /* Rediseño UX perfil (2026-08-20, D1): marco claro (antes #111418 oscuro).
     Solo lo usan las páginas de perfil; el navbar tiene su propio fondo oscuro. */
  background: #eef0f4;
  color: #1b2027;
`;

// === TEXTO ===
export const NavText = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding-block: 9px;
  padding-inline: 18px;
  border-radius: ${radius.pill};
  border: 1px solid rgba(148, 163, 184, 0.45);
  background: #020617;
  font-family: var(--font-nav);
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  text-transform: none;
  color: #e5e7eb;
  white-space: nowrap;
  opacity: 0.9;

  &.me-3 {
    margin-right: 1rem;
  }

  @media (max-width: 640px) {
    font-size: 0.9rem;
    padding-inline: 12px;
  }
`;

export const QueueText = styled.span`
  color: #6c757d;
  font-size: 0.9rem;
  white-space: nowrap;

  &.me-3 {
    margin-right: 1rem;
  }
`;

export const SaldoText = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding-block: 9px;
  padding-inline: 18px;
  border-radius: ${radius.pill};
  border: 1px solid rgba(148, 163, 184, 0.45);
  background: #020617;
  font-family: var(--font-nav);
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  text-transform: none;
  color: #e5e7eb;
  white-space: nowrap;
  opacity: 0.9;

  &.me-3 {
    margin-right: 1rem;
  }

  @media (max-width: 640px) {
    font-size: 0.9rem;
    padding-inline: 12px;
  }
`;

export const StyledNavActionsRow = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
  min-width: 0;
  min-height: 40px;
`;

export const StyledNavAvatarWrap = styled.div`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
`;

export const StyledNavIconButton = styled.button`
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  min-width: 40px;
  min-height: 40px;
  padding: 0;
  border-radius: ${radius.pill};
  border: 1px solid rgba(15, 23, 42, 0.9);
  background: #ffffff;
  color: #020617;
  cursor: pointer;
  font-size: 0.95rem;
  transition: transform .05s ease, filter .15s ease, background-color .15s ease, border-color .15s ease, color .15s ease;

  &:hover:not(:disabled) {
    background: ${colors.backsolid};
    color: #f9fafb;
    border-color: transparent;
  }

  &:active {
    transform: translateY(1px);
  }

  &:disabled {
    opacity: .6;
    cursor: not-allowed;
    filter: grayscale(.2);
  }
`;

export const LocaleSwitch = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border-radius: ${radius.pill};
  border: 1px solid rgba(148, 163, 184, 0.45);
  background: #020617;
`;

export const LocaleButton = styled.button`
  appearance: none;
  border: none;
  background: ${props => props.$active ? '#ffffff' : 'transparent'};
  color: ${props => props.$active ? '#020617' : '#e5e7eb'};
  border-radius: ${radius.pill};
  padding: 6px 10px;
  min-width: 42px;
  cursor: pointer;
  font-family: var(--font-nav);
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  line-height: 1;
  transition: background-color .15s ease, color .15s ease, opacity .15s ease;

  &:hover:not(:disabled) {
    opacity: 0.9;
  }

  &:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }
`;

// === SELECTOR DE IDIOMA (dropdown, Fase 1 i18n 2026-08-20) ===
// Disparador de ancho fijo: no crece al cambiar de idioma y escala a N idiomas.
export const LocaleWrap = styled.div`
  position: relative;
  display: inline-flex;
`;

export const LocaleTrigger = styled.button`
  appearance: none;
  width: 148px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #020617;
  color: #e5e7eb;
  border: 1px solid rgba(148, 163, 184, 0.45);
  border-radius: ${radius.pill};
  padding: 7px 12px;
  cursor: pointer;
  font-family: var(--font-nav);
  font-size: 0.82rem;
  line-height: 1;
  transition: border-color .15s ease, background-color .15s ease;

  &:hover { border-color: rgba(148, 163, 184, 0.85); }

  /* Badge de código (ES/EN/FR/DE): texto real estilado, no emoji-bandera
     (que degrada a letras desalineadas en Windows). Centrado con el nombre. */
  .code {
    flex: 0 0 auto;
    font-size: 0.62rem;
    font-weight: 800;
    letter-spacing: 0.03em;
    line-height: 1;
    color: #0b0d11;
    background: #e5e7eb;
    border-radius: 5px;
    padding: 2px 5px;
  }
  .lbl { flex: 1; text-align: left; font-weight: 800; letter-spacing: 0.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .chev { font-size: 0.7rem; opacity: .8; transition: transform .15s ease; }
  &[aria-expanded="true"] .chev { transform: rotate(180deg); }
`;

export const LocaleMenu = styled.div`
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 232px;
  background: #171a20;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 12px;
  padding: 6px;
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.5);
  z-index: 1200;
  display: ${props => (props.$open ? 'block' : 'none')};
`;

export const LocaleOption = styled.button`
  appearance: none;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  background: ${props => (props.$active ? 'rgba(234,29,29,0.14)' : 'transparent')};
  color: ${props => (props.$active ? '#ffffff' : '#cfd4db')};
  border: none;
  border-radius: 9px;
  padding: 9px 11px;
  cursor: pointer;
  text-align: left;
  font-family: var(--font-nav);
  font-size: 0.86rem;
  line-height: 1.2;
  transition: background-color .12s ease, color .12s ease;

  &:hover:not(:disabled) { background: rgba(255, 255, 255, 0.05); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Badge de código: prominente (claro) en la opción activa, sutil en el resto. */
  .code {
    flex: 0 0 auto;
    font-size: 0.62rem;
    font-weight: 800;
    letter-spacing: 0.03em;
    line-height: 1;
    border-radius: 5px;
    padding: 2px 5px;
    color: ${props => (props.$active ? '#0b0d11' : '#cfd4db')};
    background: ${props => (props.$active ? '#e5e7eb' : 'rgba(255,255,255,0.10)')};
  }
  .name { flex: 1; font-weight: 600; }
  .check { color: #ea1d1d; font-weight: 800; }
`;

// === HAMBURGUESA ===
export const HamburgerButton = styled.button`
  display: none;
  background: none;
  border: none;
  color: ${colors.white};
  font-size: 2.2rem;
  cursor: pointer;
  padding: 8px;
  border-radius: ${radius.md};
  flex: 0 0 auto;

  @media (max-width: ${NAV_COLLAPSE_BP}) {
    display: flex;
    align-items: center;
    justify-content: center;
    position: static;
    margin-left: auto;
  }
`;

export const MobileMenu = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #1a1a1a;
  border-top: 1px solid #333;
  padding: ${space.md};
  display: flex;
  flex-direction: column;
  gap: ${space.sm};
  z-index: 999;
  box-shadow: ${shadow.card};

  &.hidden {
    display: none;
  }
`;

export const MobileMenuTabs = styled.div`
  display: none !important;
`;

export const MobileMenuTabButton = styled.button`
  display: none !important;
`;

// === BOTTOM NAV MÓVIL / TABLET COLAPSADO (3 BOTONES) ===
export const MobileBottomNav = styled.div`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: var(--bottom-nav-height);
  background: #1a1a1a;
  border-top: 1px solid #333;
  display: none;
  padding: 0;
  z-index: 1000;

  @media (max-width: ${NAV_COLLAPSE_BP}) {
    display: flex;
    justify-content: space-around;
    align-items: center;
  }
`;

export const BottomNavButton = styled.button`
  appearance: none;
  background: transparent;
  border: none;
  border-bottom: 3px solid ${props => (props.active ? '#f97316' : 'transparent')};
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 4px;
  font-family: var(--font-nav);
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: none;
  color: ${props => (props.active ? colors.white : 'rgba(255,255,255,0.65)')};
  cursor: pointer;

  &:hover {
    color: ${colors.white};
  }
`;

export const StyledNavAvatar = styled.img`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid rgba(255, 255, 255, 0.35);
  /* Aro alrededor de la foto (mismo patrón que el avatar de "Perfil": gap +
     anillo) pero en rojo de marca vivo, no el rosa suave del perfil. El gap usa
     el color del navbar para leerse como separación limpia. */
  box-shadow: 0 0 0 2px #111418, 0 0 0 4px rgba(234, 29, 29, 0.9);
  cursor: pointer;
  transition: box-shadow 0.15s ease;

  &:hover {
    box-shadow: 0 0 0 2px #111418, 0 0 0 4px #ea1d1d,
      0 4px 12px rgba(234, 29, 29, 0.35);
  }
`;

export const StyledNavTab = styled.button`
  appearance: none;
  background: transparent;
  border: none;
  padding: 4px 0 10px;
  margin: 0 14px;
  cursor: pointer;
  font-family: var(--font-nav);
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: 0.01em;
  text-transform: none;
  color: #9ca3af;
  position: relative;
  white-space: nowrap;
  line-height: 1;

  &::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 3px;
    border-radius: 999px;
    background: transparent;
  }

  &[data-active="true"] {
    color: #f9fafb;
  }

  &[data-active="true"]::after {
    background: #f9fafb;
  }

  &:hover {
    color: #e5e7eb;
  }

  @media (max-width: ${NAV_COLLAPSE_BP}) {
    display: none !important;
  }
`;
