# Vibra — concepto y decisiones (pivote, negocio activo)

> **2026-09-07.** Definición viva del negocio del pivote. **Vibra** es el nombre de trabajo del producto activo (app social de vídeo, no-adult); **Charla** es el nombre de trabajo del segundo negocio (idiomas por vídeo), **aparcado hasta terminar Vibra** (decisión del operador: un frente cada vez). Contexto y por qué se pivota: [`pivote-2026-09.md`](pivote-2026-09.md). Investigación de la referencia (Azar): [`pivote-opcion5-azar-sonda.md`](pivote-opcion5-azar-sonda.md).
>
> Nombres = **de trabajo**, no marca final. Dominios pendientes: `vibra.com` y `vera.com` **ocupados**; `vibravera.com` **libre** (anotado como candidato). Barrido en condiciones (dominios multi-TLD + handles de redes + marca) al ir a producción.

## Qué es Vibra
App **social/de citas por vídeo, no-adult**: personas normales conocen a otras por vídeo 1-a-1 (ligar o hacer amigos). **Todos son usuarios iguales y gratis** (no modelo/cliente). Diferencial: saltar rápido a **vídeo** en vez de chatear semanas, con **traductor en vivo** que permite ángulo internacional. Sustituye al vertical adult (muerto por exigir liquidez sincrónica bilateral + publicidad perpetua, imposible sin capital).

## Los dos modos de Vibra
- **social-ligue** (NÚCLEO, el que lidera y arranca): perfil-primero tipo Tinder, **ASÍNCRONO**. Ves perfiles → like → **match**; la videollamada es el **paso entre dos que ya han hecho match**, por aviso/cita, **no una lotería en vivo**. No necesita a nadie conectado a la vez.
- **videochat-random** (SECUNDARIO, **apagado al inicio**): vídeo aleatorio en directo estilo Azar. Necesita densidad → se enciende cuando haya masa. **Apple lo prohíbe** (App Store Guideline 1.2, "random/anonymous chat") → este modo va **solo web** al principio.

## Decisión de núcleo: ASÍNCRONO (debate 2026-09-07, resuelto)
El núcleo asíncrono es lo que hace viable todo lo demás: **registrarse ≠ estar presente**; un producto en vivo puede tener 10.000 registrados y la sala vacía a las 21:00. Con match asíncrono (tipo Tinder), **el valor existe aunque no haya nadie conectado**, así que la "sala vacía" desaparece del bucle principal. Corolario: **no hace falta ventana/horario** (*"si necesitas ventana, tienes un problema"*), y la captura de datos + re-engagement pasan a ser válidas porque hay algo real que notificar (*"tienes un match esperando"*), no un genérico "vuelve".

## Estrategia de cold-start (debate resuelto)
- **Concentración por NICHO** (filtros de interés tipo Tinder), **no** por geografía ni por ventana. El nicho es el único eje de concentración que queda → tiene que ser bueno: garantiza que la poca gente que hay **comparte algo** y por eso conecta.
- **Daño de sala vacía bajo**: sin cobro, sin marca grande, sin sistema de reseñas propio → un usuario descontento no tumba nada. *(Caveat futuro: en app stores sí hay reseñas públicas y una app vacía se hunde en ranking → web-first protege al arranque.)*
- **Captura de datos con CONSENTIMIENTO DE MARKETING** (casilla en el registro; obligatorio para poder enviar promos legalmente en la UE) → re-engagement cuando haya match/movimiento. Es herramienta de **recuperación**, no de **creación** de la primera masa.
- **Adquisición barata y continua**: TikTok (ahora **abierto**, por ser no-adult) + comunidades (Discord/Facebook/Reddit) + invitar amigos. Es el trabajo real de Vibra: **arranque de comunidad y contenido**, no solo construir la app.
- **"Modo un jugador"** (dar valor sin otra persona presente): el propio **swipe ya lo da**. Si acaso, un **feed ligero de clips de presentación** de miembros. **NO tienda** (floja como retención; vale solo como monetización) y **NO integrar idiomas** dentro de Vibra (= dispersión de foco + es Charla; no fusionar).

## Plataformas
- **iOS + Android nativos en paralelo + web** (decisión del operador 2026-09-07).
- **Recomendación técnica**: un solo código **cross-platform** (React Native o similar) para sacar iOS+Android sin triplicar trabajo; reutiliza lógica del front React actual.
- **Caveat Apple (Guideline 1.2)**: **social-ligue** va nativo en ambas tiendas (Tinder está en las dos); **videochat-random** queda **web-only** al inicio.
- **Nota crítica registrada** (no bloqueante): existe argumento para **validar en web primero** (barato, sin gatekeepers) antes de abrir el frente móvil, dado que el cold-start no está probado. El operador elige **paralelo**; se deja dicho como decisión consciente.

## Seguridad y edad
18+ estricto · **escaneo de edad pasivo invisible** (API headless de Didit sobre el primer frame, estilo capa global de Azar) + **step-up selfie solo en el borde** · verificación por teléfono (SMS) · report/block · **consentimiento biométrico declarado** en ToS. Detalle: [`pivote-opcion5-azar-sonda.md`](pivote-opcion5-azar-sonda.md) §8.

## Reutilización del stack SharemeChat (~70%)
Motor de vídeo 1-a-1 · matching · **traductor P2P en vivo** · i18n · sistema de gifts (base de la economía de gemas) · Didit (age estimation) · moderación/denuncia · máquina de despliegue. Nuevo proyecto/dominio/EC2/BD, pero el conocimiento y el código base se aprovechan → semanas, no meses.

## Monetización
**Gratis al arrancar**; ganchos tipo **gemas diseñados pero apagados** (filtro de género/país, reconectar, "quién te dio like", boosts de visibilidad, vídeo más largo); publicidad si escala.

## Aparcado (no tocar hasta que toque)
- **videochat-random** hasta que haya densidad · **tienda** · **integración de idiomas** (= Charla) · **app stores para el modo random**.
- **Charla** (negocio de idiomas) — no se toca hasta terminar Vibra.

## Estado y siguiente paso
Análisis de concepto y cold-start **cerrado**. Nombres, modos, núcleo asíncrono, cold-start, plataformas y seguridad decididos. **Siguiente:** diseño de "Vibra por dentro" (modelo de datos, pantallas de social-ligue, plan de desarrollo y arranque cross-platform).
