# Ritmelo — concepto y decisiones (pivote, negocio activo)

> **2026-09-08.** Definición viva del negocio del pivote. **`Ritmelo`** es el **nombre elegido** del producto activo (app social de vídeo, no-adult) — de *ritmo* → sintonía, "estar en la misma onda"; cálido, transparente y bilingüe (ES/EN vía *rhythm*). **`ritmelo.com` LIBRE** (verificado por RDAP) y sin colisión de app/marca indexada. *(Nombre elegido tras 6 rondas de un pipeline de 3 agentes inventor→validador `.com`→analista, ~300 candidatos; "Vibra" fue working-name descartado por colisión con apps/radios "Vibra" en LatAm.)* **`Charla`** sigue como working-name del segundo negocio (idiomas por vídeo), **aparcado hasta terminar Ritmelo** (un frente cada vez). Contexto del pivote: [`pivote-2026-09.md`](pivote-2026-09.md). Investigación de la referencia (Azar): [`pivote-opcion5-azar-sonda.md`](pivote-opcion5-azar-sonda.md).
>
> **Pendiente de blindaje de marca** (no bloquea construir): comprar `ritmelo.com`, reservar `@ritmelo` (IG/TikTok/X), y búsqueda formal de marca (EUIPO + LatAm, clases 9/45) por el ruido de la familia "Ritm-" (existe una app "Ritmo: Social Music Streaming"; no hay "Ritmelo" exacto).

## Qué es Ritmelo
App **social/de citas por vídeo, no-adult**: personas normales conocen a otras por vídeo 1-a-1 (ligar o hacer amigos). **Todos son usuarios iguales y gratis** (no modelo/cliente). Diferencial: saltar rápido a **vídeo** en vez de chatear semanas, con **traductor en vivo** que permite ángulo internacional. Sustituye al vertical adult (muerto por exigir liquidez sincrónica bilateral + publicidad perpetua, imposible sin capital).

## Los dos modos de Ritmelo
- **social-ligue** (NÚCLEO, el que lidera y arranca): perfil-primero tipo Tinder, **ASÍNCRONO**. Ves perfiles → like → **match**; la videollamada es el **paso entre dos que ya han hecho match**, por aviso/cita, **no una lotería en vivo**. No necesita a nadie conectado a la vez.
- **videochat-random** (SECUNDARIO, **apagado al inicio**): vídeo aleatorio en directo estilo Azar. Necesita densidad → se enciende cuando haya masa. **Apple lo restringe** (App Store Guideline 1.2 lista "Chatroulette-style / random or anonymous chat" como "may be removed"; endurecido feb-2026 con oleada de rechazos): **NO está prohibido de plano** — se permite **solo con moderación proactiva del vídeo en vivo** (IA anti-desnudos/abuso en tiempo real) + report/block + contacto + age assurance (por eso Azar y Chatroulette siguen; Monkey/OmeTV fueron expulsados por no tenerlo). → este modo va **web-only al inicio** (barato) o **nativo más tarde** si montamos la moderación en vivo.

## Decisión de núcleo: ASÍNCRONO (debate 2026-09-07, resuelto)
El núcleo asíncrono es lo que hace viable todo lo demás: **registrarse ≠ estar presente**; un producto en vivo puede tener 10.000 registrados y la sala vacía a las 21:00. Con match asíncrono (tipo Tinder), **el valor existe aunque no haya nadie conectado**, así que la "sala vacía" desaparece del bucle principal. Corolario: **no hace falta ventana/horario** (*"si necesitas ventana, tienes un problema"*), y la captura de datos + re-engagement pasan a ser válidas porque hay algo real que notificar (*"tienes un match esperando"*), no un genérico "vuelve".

## Estrategia de cold-start (debate resuelto)
- **Concentración por NICHO** (filtros de interés tipo Tinder), **no** por geografía ni por ventana. El nicho es el único eje de concentración que queda → tiene que ser bueno: garantiza que la poca gente que hay **comparte algo** y por eso conecta.
- **Daño de sala vacía bajo**: sin cobro, sin marca grande, sin sistema de reseñas propio → un usuario descontento no tumba nada. *(Caveat futuro: en app stores sí hay reseñas públicas y una app vacía se hunde en ranking → web-first protege al arranque.)*
- **Captura de datos con CONSENTIMIENTO DE MARKETING** (casilla en el registro; obligatorio para poder enviar promos legalmente en la UE) → re-engagement cuando haya match/movimiento. Es herramienta de **recuperación**, no de **creación** de la primera masa.
- **Adquisición barata y continua**: TikTok (ahora **abierto**, por ser no-adult) + comunidades (Discord/Facebook/Reddit) + invitar amigos. Es el trabajo real de Ritmelo: **arranque de comunidad y contenido**, no solo construir la app.
- **"Modo un jugador"** (dar valor sin otra persona presente): el propio **swipe ya lo da**. Si acaso, un **feed ligero de clips de presentación** de miembros. **NO tienda** (floja como retención; vale solo como monetización) y **NO integrar idiomas** dentro de Ritmelo (= dispersión de foco + es Charla; no fusionar).

## Plataformas
- **iOS + Android nativos en paralelo + web** (decisión del operador 2026-09-07).
- **Recomendación técnica**: un solo código **cross-platform** (React Native o similar) para sacar iOS+Android sin triplicar trabajo; reutiliza lógica del front React actual.
- **Caveat Apple (Guideline 1.2), preciso**: **social-ligue** NO es random/anonymous chat (perfil → match → vídeo con un match) → **nativo en ambas tiendas sin problema** (como Tinder/Bumble), solo con los controles UGC estándar (filtrar/reportar/bloquear/contacto). **videochat-random** SÍ cae en la cláusula → **web-only al inicio**, o nativo cuando montemos moderación proactiva de vídeo en vivo.
- **Nota crítica registrada** (no bloqueante): existe argumento para **validar en web primero** (barato, sin gatekeepers) antes de abrir el frente móvil, dado que el cold-start no está probado. El operador elige **paralelo**; se deja dicho como decisión consciente.

## Seguridad y edad
18+ estricto · **escaneo de edad pasivo invisible** (API headless de Didit sobre el primer frame, estilo capa global de Azar) + **step-up selfie solo en el borde** · verificación por teléfono (SMS) · report/block · **consentimiento biométrico declarado** en ToS. Detalle: [`pivote-opcion5-azar-sonda.md`](pivote-opcion5-azar-sonda.md) §8.

## Reutilización del stack SharemeChat (~70%)
Motor de vídeo 1-a-1 · matching · **traductor P2P en vivo** · i18n · sistema de gifts (base de la economía de gemas) · Didit (age estimation) · moderación/denuncia · máquina de despliegue. Nuevo proyecto/dominio/EC2/BD, pero el conocimiento y el código base se aprovechan → semanas, no meses.

## Monetización
**Gratis al arrancar**; ganchos tipo **gemas diseñados pero apagados** (filtro de género/país, reconectar, "quién te dio like", boosts de visibilidad, vídeo más largo); publicidad si escala.

## Aparcado (no tocar hasta que toque)
- **videochat-random** hasta que haya densidad · **tienda** · **integración de idiomas** (= Charla) · **app stores para el modo random**.
- **Charla** (negocio de idiomas) — no se toca hasta terminar Ritmelo.

## Arranque técnico y principios de ingeniería (decisión 2026-09-07)

**Método = Opción B: repo NUEVO `ritmelo` + cosecha disciplinada** del fuente de SharemeChat (referencia de solo lectura). **NO clonar-y-refactorizar** (heredaría el dominio adult —`master/`, `payout/`, `psp/`, `accountingaudit/`, `content/`, tarifas, KYC documental— y 57 migraciones de lastre; 77 entidades/128 servicios en gran parte no aplican). Reutilización ~70% **por módulos levantados a propósito**, no por herencia del monolito. Reparto cosechar/rehacer/tirar detallado en la sección de plataformas y modos de arriba. Stack: **Spring Boot/Java** en backend (maximiza cosecha) + **React Native (iOS+Android) + web** en frontend. Nuevo proyecto/dominio/EC2/BD.

**Principios de ingeniería — criterio de ACEPTACIÓN, no opcional:**
1. **Backend package-by-DOMAIN desde el día 1.** SharemeChat arrancó *por capas* (top-level `controller/`,`service/`,`entity/`,`repository/`) y solo los frentes tardíos son por dominio. Ritmelo: **cada dominio es su paquete** (`profile/`, `matching/`, `chat/`, `videosession/`, `identity/`, `moderation/`…) con controller+service+repository+entity+dto dentro. **Nada de paquetes por capa.**
2. **Código conciso y óptimo.** Preferir lo corto y expresivo —aunque sea algo más complejo— a miles de líneas de boilerplate. DRY, clases/métodos pequeños y enfocados, features modernas del lenguaje. Guardarraíl: mantenible en solitario (óptimo ≠ ilegible).
3. **Testing desde el día 1** (unit + integración, CI verde como juez; disciplina de ADR-059).
4. **Best practices por defecto**: arquitectura limpia, inversión de dependencias, validación, manejo de errores, seguridad por defecto, **vendor-agnostic en el dominio** (vendor solo en adapters HTTP + `@ConfigurationProperties`).

## Estado y siguiente paso
Nombre (**Ritmelo**), concepto, cold-start, plataformas, seguridad y **método de construcción (Opción B) + principios de ingeniería** decididos. **Siguiente:** crear el proyecto — decisiones de setup (ubicación/carpeta `ritmelo`, quién scaffolda el esqueleto Spring Boot, repo remoto, Java 21 + Lombok) y luego el diseño de "Ritmelo por dentro" — **modelo de datos por dominios** (User peer, Profile, Interest/filtro, Like, Match, Conversation, VideoSession), estructura de paquetes, pantallas de social-ligue y orden de cosecha.
