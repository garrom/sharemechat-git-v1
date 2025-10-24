// src/styles/ModelDocumentStyles.js
import styled from 'styled-components';

/* CONTENEDOR PRINCIPAL
   - Importante: NO forzar height:100vh para permitir que crezca
     y haga scroll de página cuando el contenido sea largo. */
export const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;   /* en vez de height:100vh */
  background-color: #f0f2f5;
  min-width: 48px;
`;

/* NAVBAR */
export const StyledNavbar = styled.nav`
  background-color: #2B2F33;
  color: white;
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(180deg, #2B2F33 0%, #272B30 100%);
`;

/* Botón Navbar */
export const StyledNavButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  padding: 0 14px;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 500;
  line-height: 1;
  border-radius: 8px;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.85);
  color: #fff;
  gap: 8px;
  margin: 0;
  cursor: pointer;
  transition: background-color .2s ease, border-color .2s ease, color .2s ease;

  &:hover {
    background-color: rgba(255, 255, 255, 0.12);
    border-color: #fff;
  }

  & > svg { width: 16px; height: 16px; display: block; }
  & > span { margin: 0; font-size: inherit; }
`;

export const StyledIconWrapper = styled.span`
  margin-right: 8px;
  font-size: 18px;
`;

export const StyledNavGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: nowrap;          /* evita que los botones salten a otra línea */

  /* Asegura que los hijos no fuercen wrap por texto */
  & > * {
    white-space: nowrap;
  }

  /* En pantallas muy pequeñas, si quieres permitir wrap, descomenta:
  @media (max-width: 420px) {
    flex-wrap: wrap;
    justify-content: flex-end;
    row-gap: 8px;
  }
  */
`;

/* LAYOUT PRINCIPAL
   - Importante: NO usar overflow:hidden aquí para no recortar el contenido. */
export const StyledMainContent = styled.div`
  display: flex;
  flex: 1;
  gap: 12px;
  padding: 12px 12px 16px;
  box-sizing: border-box;
`;

/* Columnas laterales (opcionales) */
export const StyledLeftColumn = styled.aside`
  flex: 0 0 22%;
  max-width: 320px;
  min-width: 220px;
  background-color: #ffffff;
  padding: 16px;
  border: 1px solid #e9ecef;
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0,0,0,.04);
  overflow-y: auto;

  @media (max-width: 1024px) { display: none; }
`;

export const StyledRightColumn = styled.aside`
  flex: 0 0 22%;
  max-width: 320px;
  min-width: 220px;
  background-color: #ffffff;
  padding: 16px;
  border: 1px solid #e9ecef;
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0,0,0,.04);
  overflow-y: auto;

  @media (max-width: 1024px) { display: none; }
`;

/* Área central (contenido) */
export const StyledCenter = styled.main`
  flex: 1 1 auto;
  min-width: 0;
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  position: relative;

  background-color: #f7f8fa;
  background-image: url('/img/patterns/paper-1.png');
  background-repeat: repeat;
  background-size: auto;

  border: 1px solid #e9ecef;
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0,0,0,.04);

  /* Permitimos que el contenido crezca y la página haga scroll */
  overflow: visible;

  @media (max-width: 768px) {
    width: 100%;
    padding: 10px;
    min-width: 0;
  }

  @media (min-width: 769px) and (max-width: 1024px) {
    width: 50%;
  }
`;

/* Marca/Logo */
export const StyledBrand = styled.a`
  display: inline-block;
  width: 200px;
  height: 36px;
  background-image: url('/img/SharemeChat.svg');
  background-repeat: no-repeat;
  background-position: left center;
  background-size: contain;

  text-indent: -9999px;
  overflow: hidden;
  white-space: nowrap;

  outline: none;
  border-radius: 6px;
  &:focus-visible {
    box-shadow: 0 0 0 3px rgba(13,110,253,.35);
  }

  @media (max-width: 1024px) { width: 136px; height: 26px; }
  @media (max-width: 768px)  { width: 120px; height: 24px; }
`;
