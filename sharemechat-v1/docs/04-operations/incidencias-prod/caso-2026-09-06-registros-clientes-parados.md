# Caso 2026-09-06 — "Se dejaron de registrar clientes tras los cambios de finales de agosto"

- **Severidad**: P3 (síntoma de negocio, no fallo técnico; no hay servicio roto)
- **Duración**: n/a (no es una caída) · impacto: registros de clientes reales ≈ 0/día desde ~22-ago
- **Entorno**: PROD

## Síntoma

Reporte del operador: en julio y agosto se registraban clientes; a finales de
agosto, **después de varios cambios que hicimos**, dejaron de registrarse (salvo
un amigo de Colombia, que no cuenta porque vino por contacto directo, no por la
web). Sospecha del operador: **rompimos algo en el registro** con esos cambios.

## Investigación

Objetivo: distinguir "rompimos el flujo de registro" de "no llega tráfico
humano". Se atacó por los dos lados.

**Lado técnico (¿está roto el registro?):**

- **Endpoint** `POST /api/users/register/client`: responde sano — 400 ante body
  inválido (validación), no 500. No está caído.
- **`EmailDomainValidator`** (validación DNS de dominio de email, añadida en el
  periodo sospechoso): **cero** líneas `[EMAIL-DOMAIN] ... rechazado` en los logs
  de PROD desde su despliegue → nunca rechazó a un usuario real. Además es
  *fail-open* (ante error DNS, acepta), luego no puede ser la causa de un bloqueo.
- **Frontend**: carga limpio, sin errores de consola; bundle servido.
- **"Picos" de registro** de finales de agosto / principios de septiembre en los
  contadores (113 el 26-ago, 105 el 2-sep, 88 el 3-sep): **NO son humanos**. Son
  un bot POSTeando a `/register` desde IPs de datacenter (45.148.10.x,
  195.178.110.x) y recibiendo 403/404. Ruido de ataque, no demanda.

**Lado tráfico (¿llega gente real?) — GA4 (prop. 525890409), sesiones vs.
sesiones con interacción (= humano real):**

| Fecha | Sesiones | Con interacción |
|---|---|---|
| 20-ago | 243 | 0 |
| 21-ago | 149 | 5 |
| 22-ago | 265 | 3 |
| 23-ago | 304 | 1 |
| 24-ago | 1 | 1 |
| 27→31-ago | 34–92/día | 0–1 |
| **1–6 sep (total)** | **194** | **1** |

Origen de septiembre: de 194 sesiones, **193 bot** (185 "United States / direct",
firma de bot de datacenter: un país, direct/none, sin interacción) y **1 humana
real** (España, directo).

## Causa raíz

**No se rompió nada en el registro.** La causa es **colapso del tráfico humano
real**: desde ~22-ago las sesiones con interacción cayeron a 0–1/día. Con 0–1
humanos entrando al día, que no haya registros es lo estadísticamente esperado,
no un bug. Los 3 registros del contacto colombiano vinieron por aviso directo del
operador, no por la web — coherente con tráfico externo espontáneo ≈ 0.

La correlación temporal que disparó la sospecha ("dejó de funcionar justo tras
nuestros cambios") es **espuria**: los cambios de registro coinciden en el
calendario con el corte del hilo de visitas humanas, pero no lo causan (las pocas
visitas de jul-ago tampoco venían del registro ni de los cambios).

## Actuación

Ninguna correctiva sobre el código: no hay defecto que arreglar. La acción real
es de captación/tráfico (fuera del alcance de esta ficha; frente de negocio del
operador).

## Verificación

- `EmailDomainValidator`: 0 rechazos en logs → descartado como bloqueante.
- Endpoint responde 400 (no 500) ante entrada inválida → sano.
- GA4 confirma humanos reales ≈ 0/día en septiembre → causa = ausencia de demanda.

## Prevención / seguimiento

- **Bing (0 impresiones / 0 clics)**: tema **distinto** e independiente de esta
  incidencia. Mide *descubrimiento en buscador*; que siga en 0 confirma que no
  llegamos a buscadores, pero los registros de jul-ago tampoco venían de Bing.
- **Técnica reutilizable**: para "¿por qué no se registra nadie?", mirar
  **`engagedSessions` (con interacción) en GA4**, no `sessions` a secas — el grueso
  de `sessions` es bot y enmascara la señal. Firma de bot: métricas idénticas +
  `direct/none` + un solo país + desktop + no convierte (ver
  `reference_ga4_acceso_datos` en memoria del agente).
- **Enlace**: análisis de captación con datos reales en
  `project_captacion_datos_reales_2026-08-30` (memoria) — el cuello es la OFERTA
  y la falta de tráfico, no el SEO ni el registro.
- **Deuda**: no hay alerta que avise de "tráfico humano ≈ 0"; hoy solo se detecta
  por reporte manual del operador.
