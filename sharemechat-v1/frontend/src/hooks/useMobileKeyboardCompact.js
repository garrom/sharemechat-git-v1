// Fase B fix chat mobile (2026-07-19).
//
// iOS Safari, cuando abre el teclado por focus en un input, NO cambia
// window.innerHeight — solo visualViewport.height. El layout HTML sigue
// pensando que la altura es la "grande" y el teclado tapa fisicamente
// contenido. En el chat de favoritos concretamente:
//   - StyledChatWhatsApp es flex column: Scroller (flex:1) + Composer.
//   - Con el teclado abierto, el auto-scroll de focus lleva el input a
//     la vista, pero el Scroller queda con altura casi 0 y los mensajes
//     recientes quedan por encima del input, fuera de la pantalla.
//
// Este hook detecta cuando el teclado esta abierto en movil y lo
// marca en <body> con la clase 'kbd-open'. El CSS puede reaccionar
// compactando el layout (por ejemplo escondiendo el video-area del
// chat de favoritos cuando el teclado sube y el usuario esta escribiendo,
// asi el Scroller respira). Reglas concretas en videochat/favorites
// styles.
//
// Detalles:
//   - Solo actua si visualViewport esta disponible (Safari 13+).
//   - Solo actua si window.innerWidth <= 768 (chat mobile).
//   - Umbral: keyboard = innerHeight - visualViewport.height > 150px.
//     Descarta pequenas variaciones (barra de URL de Safari, etc).
//   - Se registra en resize del visualViewport (dispara al abrir/cerrar
//     teclado y al rotar).
//   - Cleanup completo en unmount.

import { useEffect } from 'react';

const KBD_THRESHOLD_PX = 150;
const MOBILE_BREAKPOINT = 768;

export default function useMobileKeyboardCompact() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const vv = window.visualViewport;
    if (!vv) return;

    const body = document.body;
    if (!body) return;

    const root = document.documentElement;

    const update = () => {
      const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
      if (!isMobile) {
        if (body.classList.contains('kbd-open')) {
          body.classList.remove('kbd-open');
        }
        root.style.setProperty('--kbd-inset', '0px');
        return;
      }
      const diff = window.innerHeight - vv.height;
      const open = diff > KBD_THRESHOLD_PX;
      if (open) {
        if (!body.classList.contains('kbd-open')) {
          body.classList.add('kbd-open');
        }
        // Altura fisica del teclado — util para elementos que necesitan
        // pegarse al top del teclado (composer del chat). Si el usuario
        // ha hecho scroll para poner el input en la vista, la offsetTop
        // del visualViewport tambien afecta; incluimos ese offset.
        const kbd = Math.max(0, diff - (vv.offsetTop || 0));
        root.style.setProperty('--kbd-inset', `${kbd}px`);
      } else {
        if (body.classList.contains('kbd-open')) {
          body.classList.remove('kbd-open');
        }
        root.style.setProperty('--kbd-inset', '0px');
      }
    };

    // Llamada inicial (por si el hook monta con teclado ya abierto).
    update();

    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    // Rotacion / resize normal.
    window.addEventListener('resize', update);

    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      // Limpiar la clase para no dejar estado "colgado" tras unmount.
      if (body.classList.contains('kbd-open')) {
        body.classList.remove('kbd-open');
      }
      root.style.setProperty('--kbd-inset', '0px');
    };
  }, []);
}
