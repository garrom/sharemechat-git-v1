# Plan de rediseño — Tab Favoritos (cliente) — 2026-08-19

**Estado:** DISEÑO EN CURSO. Concepto de layout **aprobado por el operador** (mock
de 3 columnas). Pendiente: cerrar 3 detalles abiertos, luego plan de
implementación y ejecución. **Nada implementado aún.**

**Origen:** el tab Favoritos ("el más difícil", varios rediseños previos). El
estado actual mezcla 5 grises/beige inconexos (izquierda oscura, cabecera gris
inline, canvas beige `#e9e3db`, gift bar gris, composer gris) → sensación de
"varios mundos". El operador pidió rediseñar **desde cero respetando solo el
navbar**.

**Mock de referencia (aprobado):** `favoritos-redesign-assets/mocks/favoritos-nuevo.html`.
Los mocks de scratchpad son efímeros; este es la fuente de verdad.

---

## 1. Andamiaje actual (fuente ya leída)

Árbol real (desktop) — `DashboardClient.jsx:3229` + `VideoChatFavoritosCliente.jsx:602`:

```
StyledMainContent[data-tab=favoritos]   flex row · gap0 · overflow hidden · fuerza hijos radius0 + sin sombra
├─ StyledLeftColumn[favorites-premium]   flex 0 0 22% · degradado OSCURO #161a20→#111418
│    └─ FavoritesClientList → List → ItemCard*  (avatar38 + StatusDot · Name · Badges · chevron)
└─ StyledCenter                          flex 1 · var(--c-surface)
     └─ StyledFavoritesShell→Columns→CenterPanel→CenterBody
          └─ StyledChatWhatsApp          3 ZONAS fijas:
               ├─ renderFavChatHeader()   ⚠ ESTILOS INLINE · degradado gris · avatar+nombre+presencia+"Ver perfil"+"Ver original"
               ├─ StyledChatScroller      ← ÚNICO con overflow · fondo BEIGE #e9e3db · SupportMessageBubble (P2P_ME/PEER)
               └─ bloque inferior: renderGiftBar() (barra gris fija) + StyledChatDockMessageComposer (emoji+input+llamar)
```

Reglas estructurales a respetar en implementación:
- Centro = 3 zonas verticales; **el scroller es el único con `overflow-y:auto`**
  (capa la altura; arregla el bug histórico del historial largo). No romper.
- La burbuja es `SupportMessageBubble` (compartida con Soporte) → cualquier
  restyle de burbuja se **condiciona a las variantes `P2P_ME/P2P_PEER`** para no
  tocar Soporte.
- La gift bar es data-driven (catálogo `gifts`, quick/premium, precio + modal).
- El **modo llamada** (`StyledCallCardDesktop`: vídeo + columna chat lateral) es
  OTRO árbol; el mock no lo cubre (ver decisión abierta #22).
- La **tercera columna se había eliminado** ("favoritos puro"); el mock la
  reintroduce con otro propósito (spotlight).

---

## 2. Concepto aprobado — 3 columnas con propósito

Favoritos no es solo "chatear con contactos": es donde el cliente **escala a
videollamada de pago y envía regalos**. El layout empuja hacia esa acción.

- **Izquierda — Conversaciones** (bandeja tipo messenger).
- **Centro — Chat** limpio y enfocado, fondo oscuro (un solo mundo).
- **Derecha — Spotlight de la modelo** (NUEVA): foto grande, reputación/likes,
  datos físicos, y la **videollamada + regalos** como acción principal.

Paleta unificada: navbar + 3 columnas en la misma familia oscura; **rojo de
marca `#ea1d1d`** como único acento (selección, CTA, enviar, like).

---

## 3. Listado de cambios vs. estado actual (APROBADO por el operador)

Etiquetas: **[Nuevo]** no existe · **[Restyle]** existe, cambia aspecto ·
**[Mover]** existe, cambia de sitio.

### Columna izquierda — Conversaciones
1. **[Nuevo]** Buscador de contactos arriba de la lista.
2. **[Nuevo]** Agrupación "En línea" / "Desconectadas" con etiquetas de sección.
3. **[Nuevo]** Preview del último mensaje bajo el nombre ("Tú:", emoji/regalo).
4. **[Nuevo]** Hora del último mensaje a la derecha del nombre.
5. **[Restyle]** No-leídos como badge numérico rojo (hoy punto azul sin número).
6. **[Restyle]** Avatar mayor (44px) + selección con tinte rojo de marca (hoy rosa).
7. **[Restyle]** Chevron del menú visible en hover (no en primer plano); acciones intactas.

### Columna centro — Chat
8. **[Restyle]** Fondo del chat pasa a oscuro (se elimina el beige `#e9e3db`).
9. **[Restyle]** Cabecera: de degradado gris inline → barra fina oscura con tokens (mantiene avatar+nombre+presencia+"Ver original").
10. **[Mover]** "Ver perfil completo" sale de la cabecera → columna derecha (spotlight). Cabecera más limpia.
11. **[Nuevo]** Separador de día ("Hoy") en el hilo.
12. **[Restyle]** Burbujas: propia grafito, de ella tarjeta oscura elevada (mantiene avatar+timestamp+traducción).
13. **[Mover]** Regalos salen del bloque inferior → botón 🎁 en composer + acceso en la derecha. Se elimina la barra de regalos gris fija.
14. **[Restyle]** Composer oscuro: emoji + 🎁 + input + enviar (rojo). El botón de **llamar (vídeo) se mueve** al CTA de la derecha.

### Columna derecha — Spotlight (nueva entera)
15. **[Nuevo]** Se reintroduce una tercera columna.
16. **[Nuevo]** Foto grande de la modelo con degradado + nombre + corona.
17. **[Nuevo]** CTA "Iniciar videollamada" con tarifa €/min como acción principal.
18. **[Nuevo]** Bloque de reputación: corona + nº de likes + botón "Dar like" (reutiliza sistema de likes/insignias existente).
19. **[Nuevo]** Datos físicos (altura, cuerpo, pecho, idioma) — los del perfil ya construido.
20. **[Nuevo]** Regalos rápidos en la derecha.

### Transversal
21. **[Restyle]** Paleta unificada (navbar + 3 columnas oscuras, rojo de marca único acento).
22. **[Nota/Decisión abierta]** El modo llamada es otro árbol; el mock no lo cubre. Decidir si se rediseña también o se deja.

---

## 4. Decisiones abiertas (a cerrar antes de implementar)

- **D1 — Ver perfil completo desde el spotlight.** La columna derecha no cabe el
  perfil entero. Falta ubicar un acceso discreto a "Ver perfil completo" (el
  `ModelProfileExpanded` que ya existe). Propuesta pendiente.
- **D2 — Carga de la columna derecha.** Confirmado: se puebla al pulsar el
  contacto en la lista (mismo disparo que abre el chat central). Reutiliza el
  `getPublicProfile` + likes/reputación ya existentes.
- **D3 — Fondo del chat.** Debe ser oscuro, pero se busca romper la monotonía del
  negro plano (textura/patrón oscuro muy sutil). Explorar opciones.
- **D22 — Modo llamada** (ver punto 22).

---

## 5. Viabilidad (nota preliminar, sin cerrar)

- Puntos 1–14 y 21: CSS + reordenación de JSX sobre el andamiaje existente
  (bajo riesgo). El fondo, cabecera y burbujas condicionadas a `P2P_*`.
- Columna derecha (15–20): lo más nuevo. Datos que ya existen (perfil físico,
  likes/reputación, tarifa €/min, catálogo de regalos); el trabajo es de
  cableado + un componente nuevo de panel. Requiere reintroducir la tercera
  columna en `DashboardClient` (que hoy solo monta izquierda+centro en favoritos).
- El plan de implementación detallado se redactará tras cerrar D1/D3/D22.
