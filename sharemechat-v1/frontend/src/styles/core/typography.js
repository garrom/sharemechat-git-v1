// styles/core/typography.js
import { createGlobalStyle } from 'styled-components';

/**
 * TIPOGRAFÍA GLOBAL
 * - Define variables de fuentes
 * - Carga @font-face opcional (si subes .woff2 a /public/fonts)
 * - Aplica familia por defecto a todo el sitio
 */
export const GlobalTypography = createGlobalStyle`
  /* (Opcional) Ejemplo de @font-face local
     - Copia tus .woff2 a: /public/fonts
     - Cambia los nombres de archivo si usas otra familia (p.ej. Inter, Nixie One, etc.)
  */
  /*@font-face {
    font-family: 'Nixie One';
    src: url('/fonts/NixieOne-Regular.woff2') format('woff2');
    font-weight: 400;
    font-style: normal;
    font-display: swap;
  }*/

  :root{
    /* Sans general y marca: ajústalas a tu gusto */
    --font-sans: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans",
                 "Helvetica Neue", Arial, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
    --font-brand: "Nixie One", var(--font-sans);  /* si no cargas Nixie, heredará sans */
  }

  html, body, #root { height: 100%; }

  body {
    font-family: var(--font-sans);
    color: #222;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  h1,h2,h3,h4,h5,h6,.heading {
    font-family: var(--font-brand);
    letter-spacing: .2px;
  }

  button, input, select, textarea {
    font-family: inherit;
  }
`;
