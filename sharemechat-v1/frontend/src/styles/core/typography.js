// styles/core/typography.js
import { createGlobalStyle } from 'styled-components';

/**
 * TIPOGRAFÍA GLOBAL
 */
export const GlobalTypography = createGlobalStyle`

  :root{
    /* Sans general y marca: ajústalas a tu gusto */
    --font-sans: 'Inter', system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans",
                 "Helvetica Neue", Arial, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";

    --font-brand: "Nixie One", var(--font-sans);  /* si no cargas Nixie, heredará sans */

    /* Tipografía específica navbar/botones (look tipo Azar) */
    --font-nav: "Poppins", var(--font-sans);
  }


  html, body, #root { height: 100%; }

  body {
    font-family: var(--font-nav);
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
