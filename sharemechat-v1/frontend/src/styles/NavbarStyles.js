// src/styles/NavbarStyles.js
import styled from 'styled-components';
import { colors, radius, space, shadow } from './core/tokens';

// === NAVBAR PRINCIPAL ===
export const StyledNavbar = styled.nav`
  display: flex;
  justify-content: space-between;
  align-items: center;

  /* Desktop: navbar más alto */
  height: var(--navbar-height-desktop);

  padding: 0 ${space.lg};
  background:${colors.blacksolid};
  backdrop-filter: blur(8px);
  box-shadow: ${shadow.card};
  position: sticky;
  top: 0;
  z-index: 1000;
  flex-wrap: wrap;
  gap: ${space.sm};

  @media (max-width: 1024px) {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;

    /* Móvil: volvemos a la altura base */
    height: var(--navbar-height);
    padding: 0 ${space.md};
    position: sticky;


    .desktop-only,
    [data-nav-group] {
      display: none !important;
    }
  }

  @media (max-width: 640px) {
    padding: 0 ${space.md};
  }
`;

//Logotipo
export const StyledBrand = styled.a`
  display: block;
  width: 220px;
  height: 64px;
  background: url('/img/SharemeChat_white.svg') no-repeat center / contain;
  text-indent: -9999px;

  @media (max-width: 640px) {
    width: 180px;
    height: 52px;
  }
`;

//=== StyledContainer ===
export const StyledContainer = styled.div`
  min-height: 100vh;
  display: flex;           /* <- NUEVO */
  flex-direction: column;  /* <- NUEVO */
  background: #0f0f0f;
  color: #e0e0e0;
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

  @media (max-width: 1024px) {
    display: flex;
    align-items: center;
    justify-content: center;

    /* se alinea verticalmente dentro del navbar y se empuja a la derecha */
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

  &.hidden { display: none; }
`;

// === BOTTOM NAV MÓVIL (3 BOTONES) ===
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

  @media (max-width: 768px) {
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

  /* Misma tipografía que tabs de desktop */
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
