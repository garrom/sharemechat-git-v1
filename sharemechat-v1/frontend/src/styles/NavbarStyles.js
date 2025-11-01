// src/styles/NavbarStyles.js
import styled from 'styled-components';
import { colors, radius, space, shadow } from './core/tokens';

// === NAVBAR PRINCIPAL ===
export const StyledNavbar = styled.nav`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${space.md} ${space.lg};
  background: #1a1a1a; /* Fondo oscuro sólido */
  backdrop-filter: blur(8px);
  box-shadow: ${shadow.card};
  position: sticky;
  top: 0;
  z-index: 1000;
  flex-wrap: wrap;
  gap: ${space.sm};

  @media (max-width: 640px) {
    padding: ${space.sm} ${space.md};
    flex-direction: column;
    align-items: stretch;
  }
`;

export const StyledBrand = styled.a`
  display: block;
  width: 140px;
  height: 40px;
  background: url('/img/SharemeChat_white.svg') no-repeat center / contain;
  text-indent: -9999px;

  @media (max-width: 640px) {
    width: 120px;
    height: 36px;
  }
`;

// === BOTONES ===
export const StyledNavButton = styled.button`
  background: transparent;
  border: 1px solid ${colors.white}30;
  color: ${colors.white};
  padding: ${space.xs} ${space.md};
  border-radius: ${radius.md};
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;

  &:hover {
    background: ${colors.white}15;
    border-color: ${colors.white}50;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 640px) {
    flex: 1;
  }
`;

//=== StyledContainer ===
export const StyledContainer = styled.div`
  min-height: 100vh;
  background: #0f0f0f;
  color: #e0e0e0;
`;

// === TEXTO ===
export const NavText = styled.span`
  color: ${colors.white};
  font-weight: 500;
  font-size: 0.95rem;
  white-space: nowrap;

  &.me-3 {
    margin-right: 1rem;
  }

  @media (max-width: 640px) {
    font-size: 0.9rem;
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
  background: ${colors.success};
  color: white;
  padding: 4px 10px;
  border-radius: ${radius.full};
  font-weight: 600;
  font-size: 0.85rem;
  &.me-3 { margin-right: 1rem; }
`;

// === HAMBURGUESA ===
export const HamburgerButton = styled.button`
  display: none;
  background: none;
  border: none;
  color: ${colors.white};
  font-size: 1.8rem;
  cursor: pointer;
  padding: 8px;
  border-radius: ${radius.md};

  @media (max-width: 768px) {
    display: flex;
    align-items: center;
    justify-content: center;
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
  background: #1a1a1a;
  border-top: 1px solid #333;
  display: none;
  padding: ${space.sm} 0;
  z-index: 1000;

  @media (max-width: 768px) {
    display: flex;
    justify-content: space-around;
  }
`;

export const BottomNavButton = styled.button`
  background: ${props => props.active ? colors.primary : 'transparent'};
  color: ${colors.white};
  border: none;
  padding: ${space.md};
  border-radius: ${radius.lg};
  font-weight: 600;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  font-size: 0.85rem;

  &:hover { background: ${colors.primaryHover}; }
`;
