import styled from 'styled-components';

// Contenedor principal
export const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #f0f2f5;
`;

// Navbar
export const StyledNavbar = styled.nav`
  background-color: #355C7D;
  color: white;
  padding: 15px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

// Botón de la Navbar
export const StyledNavButton = styled.button`
  background: none;
  border: 1px solid white;
  color: white;
  padding: 8px 15px;
  border-radius: 5px;
  margin-left: 10px;
  cursor: pointer;
  transition: background-color 0.3s;
  &:hover {
    background-color: #495057;
  }
`;

// Contenido principal
export const StyledMainContent = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
`;

// Columna izquierda
export const StyledLeftColumn = styled.aside`
  width: 20%;
  background-color: #ffffff;
  padding: 20px;
  box-shadow: 2px 0 5px rgba(0, 0, 0, 0.1);
  overflow-y: auto;

  @media (max-width: 768px) {
    display: none;
  }

  @media (min-width: 769px) and (max-width: 1024px) {
    width: 25%;
  }
`;

// Área central
export const StyledCenter = styled.main`
  flex: 1;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 60%;
  min-width: 640px;
  min-height: 480px;
  max-width: 90%;
  position: relative;

  @media (max-width: 768px) {
    width: 100%;
    padding: 10px;
    min-width: 0;
  }

  @media (min-width: 769px) and (max-width: 1024px) {
    width: 50%;
  }
`;

// Columna derecha
export const StyledRightColumn = styled.aside`
  width: 20%;
  background-color: #ffffff;
  padding: 20px;
  box-shadow: -2px 0 5px rgba(0, 0, 0, 0.1);
  overflow-y: auto;

  @media (max-width: 768px) {
    display: none;
  }

  @media (min-width: 769px) and (max-width: 1024px) {
    width: 25%;
  }
`;

// Botón de acción
export const StyledActionButton = styled.button`
  background-color: #28a745;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.3s;
  &:hover {
    background-color: #218838;
  }
  &[style*='backgroundColor: #dc3545'] {
    background-color: #dc3545;
    &:hover {
      background-color: #c82333;
    }
  }
`;

// Estilo para íconos
export const StyledIconWrapper = styled.span`
  margin-right: 8px;
  font-size: 18px;
`;

// Contenedor para cámara local
export const StyledLocalVideo = styled.div`
  position: absolute;
  top: 10px;
  right: 10px;
  width: 10%;
  z-index: 2;
`;

// Contenedor para cámara remota
export const StyledRemoteVideo = styled.div`
  width: 100%;
  height: 100%;
  z-index: 1;
`;

// Contenedor para el chat
export const StyledChatContainer = styled.div`
  position: absolute;
  bottom: 10px;
  left: 10px;
  width: clamp(220px, 42vw, 320px);
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 10px;
  border-radius: 5px;
  z-index: 2;
  @media (max-width: 480px) {
    left: 5px;
    right: 5px;
    width: auto;
  }
`;

/** Botón de icono (sidebar izquierda) */
export const StyledIconBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
  border-radius: 8px;
  transition: background .2s ease;
  &:hover { background: #f1f3f5; }
`;

/** Fila de acciones bajo "activar cámara" */
export const StyledTopActions = styled.div`
  margin-bottom: 10px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
`;

/** Título flotante encima del video remoto */
export const StyledVideoTitle = styled.h5`
  position: absolute;
  top: 10px;
  left: 10px;
  color: white;
  z-index: 2;
  margin: 0;
`;

/** Grupo de acciones a la derecha de la navbar */
export const StyledNavGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

/** Avatar en la navbar */
export const StyledNavAvatar = styled.img`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid rgba(255, 255, 255, 0.45);
  box-shadow: 0 0 0 2px rgba(0,0,0,0.05);
  cursor: pointer;
`;

