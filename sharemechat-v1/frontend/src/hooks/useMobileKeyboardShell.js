import { useEffect } from 'react';

// #D-61 — Fix del teclado virtual en móvil para el shell app-like del chat.
//
// Problema: en iOS Safari el teclado encoge SOLO el "visual viewport", no el
// "layout viewport", así que un shell `height:100dvh; overflow:hidden` sigue
// midiendo la pantalla entera por detrás del teclado → el composer queda tapado
// y, al cerrar, la vista queda desplazada. (En Chrome/Firefox lo cubre el meta
// `interactive-widget=resizes-content`; iOS lo ignora, de ahí este hook.)
//
// Solución: mientras haya teclado abierto en móvil, fijamos la altura real
// disponible en la CSS var `--kb-shell-h` del elemento del shell; DashboardShell
// usa `height/min-height: var(--kb-shell-h, 100dvh)`, así que sin teclado el CSS
// es EXACTAMENTE el de hoy (la var cae al default) y con teclado el shell encoge
// al hueco visible sobre el teclado. Al cerrar (blur/resize) se retira la var.
//
// - ref: ref al nodo DOM del DashboardShell.
// - enabled: solo en el tab de chat/llamada (app-like); en el resto no aplica.
export default function useMobileKeyboardShell(ref, enabled) {
  useEffect(() => {
    const el = ref && ref.current;
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!enabled || !el || !vv) return undefined;

    // Solo móvil: en desktop el teclado no aplica y no tocamos la altura.
    const isMobile = () => window.matchMedia('(max-width: 768px)').matches;

    const clear = () => el.style.removeProperty('--kb-shell-h');

    const apply = () => {
      if (!isMobile()) { clear(); return; }
      // Alto del teclado = lo que el visual viewport ha "perdido" respecto al
      // layout viewport. Umbral 80px para ignorar barras del navegador.
      const kb = window.innerHeight - vv.height - vv.offsetTop;
      if (kb > 80) {
        el.style.setProperty('--kb-shell-h', `${Math.round(vv.height)}px`);
      } else {
        clear();
      }
    };

    apply();
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    return () => {
      vv.removeEventListener('resize', apply);
      vv.removeEventListener('scroll', apply);
      clear();
    };
  }, [ref, enabled]);
}
