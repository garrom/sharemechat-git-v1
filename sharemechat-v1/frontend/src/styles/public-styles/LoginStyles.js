// src/styles/public-styles/LoginStyles.js
import styled from 'styled-components';
import { bp, colors, radius, space, shadow } from '../core/tokens';
import { buttonBase, focusRing } from '../core/mixins';

// 2026-08-08: StyledContainer eliminado por huérfano (cero consumidores;
// el login vive dentro del modal LoginModalContent, no en página aparte).
// Ver docs/04-operations/scroll-dashboard-favoritos-investigation-2026-08-08.md.

/* CARD LOGIN */
export const StyledForm = styled.form`
  position: relative;
  width: 100%;
  max-width: ${p => p.$wide ? '820px' : '520px'};
  padding: ${p => p.$wide ? '38px 44px 34px' : '28px 28px'};
  border-radius: 24px;
  background: ${colors.backsolid || '#020617'};
  border: 1px solid #0b1120;
  box-shadow: 0 32px 80px rgba(0,0,0,0.8);
  color: #e5e7eb;

  /* clave para la SIMETRÍA vertical */
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 14px; /* mismo espacio entre todos los elementos del form */

  /* ModalBase con hideChrome=true renderiza este form directo en el Dialog
     sin el <Body> con scroll. Para formularios largos (RegisterMasterModalContent
     con 7 campos + 3 checkboxes, o RegisterClientModalContent con Google Sign-In)
     hay que ceñirse a la viewport y scrollear el propio form cuando desborde.
     Usamos 100dvh (dynamic viewport) para que en iOS Safari/Chrome el modal
     no se corte bajo la barra URL: 100vh en iOS mide el viewport SIN la barra,
     100dvh se adapta cuando aparece/desaparece. */
  max-height: calc(100vh - 48px);
  max-height: calc(100dvh - 48px);
  overflow-y: auto;

  @media (max-width: ${bp.md}) {
    /* Dialog (padre) con hideChrome=true tiene width:auto — sin min-width
       aqui, el shrink-wrap del padre colapsa el form al ancho intrinseco
       del contenido, dejandolo enano. min(calc(100vw - 32px), 520/720) fuerza
       ancho util respetando el max-width del Dialog por size. Solo aplica
       en movil; desktop mantiene el layout original de auto-fit. */
    min-width: min(calc(100vw - 32px), ${p => p.$wide ? '720px' : '520px'});
    max-width: 100%;
    padding: ${p => p.$wide ? '26px 16px 24px' : '24px 20px'};
    border-radius: 20px;
    max-height: calc(100vh - 32px);
    max-height: calc(100dvh - 32px);
  }

`;

export const FormTitle = styled.h2`
  margin: 0;
  font-weight: 700;
  font-size: 1.7rem;
  text-align: left;
  color: #f9fafb;
`;

/* Bloque mensajes */
export const Status = styled.div`
  color: #9ca3af;
  font-size: 0.9rem;
`;

export const StyledError = styled.p`
  color: #f97373;
  font-size: 0.9rem;
  margin: 0;
`;

/* Wrapper campo (ya no usamos margin-bottom, lo controla gap del form) */
export const Field = styled.div`
  width: 100%;
`;

/* INPUTS: gris neutro, sin azules, con bordes suaves */
export const StyledInput = styled.input`
  width: 100%;
  box-sizing: border-box;
  font-size: 1rem;
  border-radius: 18px;

  background: #2a2a2a;
  border: 1px solid #3a3a3a;    /* gris medio */
  color: #f5f5f5;

  padding: 13px 16px;
  outline: none;

  transition: border-color .15s ease, box-shadow .15s ease, background-color .15s ease;

  &::placeholder {
    color: #9ca3af;
  }

  &:focus {
    border-color: #00f59d;
    box-shadow: 0 0 0 1px #00f59d;
    background: #232323;
  }

  &:disabled {
    opacity: .7;
    background: #1f1f1f;
    cursor: not-allowed;
  }
`;

export const FieldError = styled.div`
  color: #fca5a5;
  font-size: 0.78rem;
  margin-top: 4px;
`;

/* BOTÓN VERDE PASTILLA, TIPO AZAR */
export const StyledButton = styled.button`
  ${buttonBase}
  width: 100%;
  /* Alineado al ancho maximo permitido por Google GIS renderButton (400px).
     Sin este cap, en desktop el boton nativo era mas ancho que "Iniciar
     sesion con Google" (limite duro de Google) y se veian desalineados. */
  max-width: 400px;
  align-self: center;
  padding: 14px 18px;
  margin-top: 4px;
  border-radius: 999px;
  background: #00f59d;
  border: 0;
  color: #020617;
  font-size: 1rem;
  font-weight: 700;

  &:hover:not(:disabled) {
    background: #1bffac;
    transform: translateY(0);
    box-shadow: 0 18px 40px rgba(0,245,157,0.36);
  }

  &:disabled {
    opacity: .6;
    cursor: wait;
    box-shadow: none;
  }
`;

// Fila de pestañas Login / Regístrate
export const TabsRow = styled.div`
  display: flex;
  gap: 28px;              /* separación entre Login | Registrate */
  margin-bottom: 22px;   /* separación con el contenido de abajo */
  border-bottom: 1px solid #1f2933;
  padding-bottom: 6px;
`;


// Botón de pestaña aspecto de tab
export const TabButton = styled.button`
  ${buttonBase}
  background: transparent;
  border: 0;
  padding: 6px 0;
  margin: 0;
  border-radius: 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: #9ca3af;
  border-bottom: 2px solid transparent;
  justify-content: flex-start;
  text-transform: none;

  &[data-active='true'] {
    color: #f9fafb;
    border-bottom-color: #f9fafb;
  }

  &:hover:not(:disabled) {
    color: #e5e7eb;
  }
`;


/* LINKS DEBAJO (alineados y con mismo espacio gracias al gap) */
export const StyledLinkButton = styled.button`
  ${buttonBase}
  width: 100%;
  padding: 8px 4px;
  background: transparent;
  border: 0;
  color: #9ca3af;
  font-size: 0.9rem;
  justify-content: flex-start;
  text-decoration: underline;
  text-underline-offset: 2px;

  &:hover:not(:disabled) { color: #e5e7eb; }
  &:focus-visible { ${focusRing} }
`;

// 2026-08-08: StyledBrand eliminado por huérfano (Fase E limpieza). El
// logo vive solo en NavbarStyles.StyledBrand.

// X para cerrar
export const CloseBtn = styled.button`
  position: absolute;
  top: 12px;
  right: 12px;
  width: 40px;
  height: 40px;
  border-radius: 999px;
  border: none;
  background: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  box-shadow: 0 6px 18px rgba(0,0,0,0.5);
  transition: background .15s ease, transform .05s ease, box-shadow .15s ease;
  color: #f9fafb; /* <- X en blanco */

  svg {
    width: 22px;
    height: 22px;
  }

  &:hover {
    box-shadow: 0 10px 26px rgba(0,0,0,0.65);
  }

  &:active {
    transform: translateY(1px);
  }
`;

export const RegisterGenderRow = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  width: 100%;

  @media (max-width: ${bp.md}) {
    grid-template-columns: 1fr;
  }
`;

