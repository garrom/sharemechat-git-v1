# ADR-034: Metodología de social-ops (pipeline Cowork para X/Reddit)

## Estado
Aceptada — 2026-06-10

## Contexto
SharemeChat necesita presencia orgánica en X y Reddit como parte de la estrategia de crecimiento pre-launch (ver ADR-031, beachhead). El fundador opera en solitario y necesita maximizar la automatización. Ya existe un pipeline editorial (ADR-010, ADR-014, ADR-023) que, a partir de 4 campos en el CMS, genera artículos bilingües vía Cowork (orquestador + agentes). Surge la pregunta de si replicar ese patrón para gestionar las redes.

Dos restricciones marcan el diseño:
1. Las redes son relación, no artefacto. Un post no se persiste ni se renderiza en el producto; vive en plataformas externas.
2. Reddit y X prohíben o limitan la automatización de acciones (manipulación de votos, posteo scriptado, multicuenta). Automatizar el posteo o la interacción arriesga el baneo de cuentas que cuesta semanas calentar; y además, lo que evita el baneo (participación genuina, leer la sala, ratio aporte/promo) exige juicio humano.

## Decisión
Construir un pipeline de social-ops como gemelo del pipeline editorial, con tres decisiones de fondo:

1. Automatizar el pensar, no el publicar. Cowork genera contenido, comprueba cumplimiento y produce un plan; el humano publica e interactúa. Cowork = fábrica de contenido + compliance + plan; humano = ejecución + conversación + persistir estado.
2. Fuera del producto. A diferencia del blog (que tiene clases de backend y UI porque el artículo es un artefacto persistido y renderizado), social-ops vive solo como skills de Cowork más un fichero de estado, en `docs/social/`. Sin entidades ni pantallas: no hay artefacto de producto que justifique superficie de runtime, y añadirla en pre-launch (con deuda de seguridad y due-diligence de PSP abierta) sería coste innecesario.
3. Sistema con estado (ledger). A diferencia del blog (one-shot por artículo), las redes son continuas: el sistema necesita recordar edad de cuenta, karma, fase y el ratio aporte/promo. Se materializa en `social-state.json`, análogo a los manifests de deploy-state, inyectado en cada sesión y devuelto actualizado por el packager (Cowork no tiene memoria entre sesiones).

El pipeline son 7 skills: `social-orchestrator` (director) más `social-phase-gate`, `social-platform-rules`, `social-draft-writer`, `social-brand-legal-review`, `social-translate-en` y `social-packager`. Reutiliza `sharemechat-voice` y la salida bilingüe ES+EN del pipeline editorial.

Reglas de fase y ratio (aplicadas por el gate): Reddit `warmup` -> `building` (edad >=7d, karma >=20) -> `promo-allowed` (edad >=21d, karma total >=50), ratio 10% por sub; X `warmup` -> `promo-allowed` (edad >=7d, >=5 aportes), ratio 25% global. La seguridad (18+, menores) y los ToS de plataforma se validan en el review como barrera dura: bloqueo, no edición.

## Opciones consideradas
- Integrar en el producto (entidades + UI), como el blog. Descartada: social no produce artefacto persistible; añadiría superficie de runtime y riesgo de deploy sin beneficio, especialmente en pre-launch.
- Automatizar también el posteo (bots o scheduling sobre Reddit/X). Descartada: exprime o viola los ToS, arriesga baneos y elimina el juicio humano que evita el baneo. El coste (perder la cuenta) supera con creces el ahorro.
- Alojar en el repo company-docs (ops). Descartada: fragmenta la documentación en dos raíces; el corpus de skills, ADRs y datos de dominio ya vive en `docs/` del repo de producto. Se mantiene una sola raíz.

## Consecuencias
Positivas:
- Replica un patrón ya probado (editorial), abaratando la curva de aprendizaje del operador.
- Cero superficie de runtime nueva; cero riesgo de deploy.
- El núcleo (skills + ledger + contrato) es reutilizable: si el volumen llegara a justificar una UI en el producto, migrarlo es trivial.
- Seguridad y cumplimiento (18+, menores, DSA/GDPR, ToS) quedan como barrera explícita y trazable.

Negativas / asumidas:
- El operador rellena 4 campos por sesión y ejecuta el posteo a mano (no hay UI ni auto-post). Es deliberado: protege el activo.
- El ledger se mantiene a mano (métricas de karma/followers y reglas curadas por sub). El historial de git del fichero sirve de auditoría.
- El sistema no fuerza el cumplimiento de su propio plan: depende de que el humano publique lo planeado y persista el estado.

## ADRs relacionados
- ADR-010, ADR-014, ADR-023, ADR-026: pipeline editorial (patrón de origen).
- ADR-028, ADR-029: clasificación adult y verificación de edad (contexto de seguridad 18+).
- ADR-031: estrategia geográfica / beachhead (crecimiento orgánico que esto sirve).
