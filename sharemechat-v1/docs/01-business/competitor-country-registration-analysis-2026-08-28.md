# Análisis de competencia: política de países en el registro (cliente vs modelo)

**Fecha:** 2026-08-28
**Autor:** estudio interno (asistente de desarrollo)
**Motivo:** decidir la expansión de la *allowlist* de países para el registro de **cliente**
(Problema B del frente de registro). Insumo para una decisión de negocio; **no** es asesoría
legal. El marco de sanciones cambia con frecuencia: antes de aplicar exclusiones por
sanción, contrastar con asesoría especializada.

> **Estado del código a fecha de este informe:** la *allowlist* de cliente y la de modelo
> son independientes (dos llaves distintas en `config.env`). Ver §5 para los valores vivos
> en PROD. El registro de cliente hoy exige cuenta + país en lista; el de modelo añade KYC.

---

## 1. Resumen ejecutivo

- **Ningún competidor publica una *allowlist* cerrada de países para el CLIENTE.** El patrón
  del sector es **registro global** + una cláusula genérica de sanciones que el usuario
  **autodeclara**, y el control real se aplica en el **procesador de pagos** (AML/CTF), no en
  el formulario de alta. Los operadores europeos (XCams, Luxemburgo; XloveCam, pagos en
  Países Bajos) siguen exactamente ese patrón.
- **La restricción por país fuerte vive en el lado MODELO**, no en el cliente: verificación
  de identidad, KYC y *payout*. Ahí sí hay listas y asimetría.
- **De todo el continente americano, solo Cuba obliga legalmente a bloquear** (embargo
  integral). Venezuela, Nicaragua y Haití son sanciones **selectivas** (contra gobiernos,
  funcionarios o bandas designadas), que **no** prohíben que un ciudadano use un servicio de
  consumo: excluirlos es una **decisión comercial** (fraude/lavado), no una obligación legal.
- **Aparece una segunda capa geográfica** que no estaba en el radar y que ya afecta al sector:
  la **verificación de edad por jurisdicción** (Reino Unido, Francia, +27 estados de EE. UU.
  en 2026). No es sanción; es responsabilidad legal. Encaja con **Didit**, que ya usamos.
- **Recomendación** (detalle en §6): abrir el registro de cliente a **prácticamente toda
  América**, excluyendo **Cuba** (bloqueo legal) y dejando **Venezuela y Haití** en espera por
  riesgo comercial (o admitiéndolos con fricción de pago reforzada). Esto es coherente con lo
  que hace la competencia y resuelve el caso del cliente de Colombia.

---

## 2. Qué hace la competencia (cliente)

Se investigaron 11 plataformas en cinco frentes. Fuentes y niveles de confianza al final de
cada bloque; muchas plataformas **no publican** su política país-por-país, de modo que buena
parte de lo relativo al cliente es **inferencia por ausencia de restricción**, marcada como tal.

### 2.1 Videochat 1-a-1 (competidores directos)

| Plataforma | Sede / ley | Registro de cliente | Bloqueo por país | LatAm cliente |
|---|---|---|---|---|
| **CooMeet** | Gartwell Ltd (Belice), ley de Chipre | Global; legalidad autodeclarada. **Sin** cláusula OFAC | Ninguno enumerado | Sin exclusión textual |
| **LuckyCrush** | Hello World SAS (Francia, s/reseñas) | Global **salvo sancionados OFAC** (autodeclarado) | Cláusula OFAC → Cuba, Irán, RPDC, Siria, Crimea | Sin exclusión salvo Cuba; **capta modelos en Colombia** |

Dato relevante: **CooMeet es el menos restrictivo** (ni siquiera incluye cláusula OFAC).
LuckyCrush sí, pero de forma autodeclarada. Ninguno usa *allowlist* de cliente. La asimetría
real de LuckyCrush está en el lado **modelo** (términos adicionales para cuentas femeninas,
verificación manual con fotos, KYC de *payout*), y **Colombia es zona de captación activa de
modelos** vía agencias/estudios.

### 2.2 Chat aleatorio estilo Omegle

| Plataforma | Modelo de acceso | Registro | País |
|---|---|---|---|
| **ChatSpin** | Freemium, cuenta opcional | No obligatorio | Global; solo cláusula sanciones autodeclarada |
| **Chatrandom** | Anónimo | No | Global "180+ países" (reseñas) |
| **CamSurf** | Anónimo, sin cuenta | No | Global "200+ países"; los bloqueos conocidos (China, Irán, Irak, EAU) son **censura de esos gobiernos, no del sitio** |

Estas plataformas apenas tienen "registro": se entra y se empareja. Perfil distinto al nuestro
(nosotros exigimos cuenta y KYC en el lado modelo).

### 2.3 Cam adulto — operadores europeos (los comparables legales más próximos)

| Plataforma | Sede | Cliente | Modelo (asimetría) |
|---|---|---|---|
| **XloveCam** | SNV (Curaçao) + pagos **ACW B.V., Países Bajos (UE)** | Sin restricción explícita; marketing a 15 países (UE + US/CA/AU). Control AML **en el pago** | ≥18 (o ≥21 si su país lo exige); foto + cuestionario + KYC del monedero |
| **XCams** | **DNX Network Sàrl, Luxemburgo (UE)** | Global de facto; foco UE + EE. UU. | ≥18; **escaneo de DNI**; *payout* mín. 100 $; geobloqueo **a nivel de modelo** |

Ambos son operadores **UE** y **ninguno publica lista negra de países**: trasladan al usuario
el deber de cumplir su ley local y aplican **AML/CTF en el procesador de pagos**. Es el
espejo más cercano a una empresa con sede en la UE (Estonia).

### 2.4 Cam adulto establecido (mercado US/global)

| Plataforma | Cliente | Modelo |
|---|---|---|
| **Streamate** | Global (patrón); restricción real = **verificación de edad** (UK + estados US), no país | *Allowlist* estricta: acepta **México, Argentina**; **excluye Brasil, Colombia, Venezuela**, Turquía, Rusia, Filipinas, India, China, Nigeria, Oriente Medio/África |
| **ImLive** | "Worldwide", +80 M miembros | 18+; pagos globales; sin lista pública |
| **CamContacts** | +170 países | 50 % al modelo; sin lista pública |
| **DirtyRoulette** | ~200 países, **sin cuenta**; *age-gate* de un clic | N/A (P2P) |

**Contraste importante:** Streamate **excluye a Colombia y Brasil como modelos**; SharemeChat
hoy **sí** los acepta como modelos. Es decir, en el lado modelo ya somos **más permisivos** que
un actor maduro del sector. La incoherencia actual es al revés: aceptamos a un colombiano como
**modelo** pero no como **cliente**.

**Límite de honestidad:** los Términos primarios de estas cuatro y de un par más son
inaccesibles al fetch automático (política de contenido adulto). Lo relativo al cliente se
apoya en el marco regulatorio y en reseñas; se marca como confianza media/baja. Para un
veredicto documental firme habría que abrir sus ToS y sus formularios de alta de modelo desde
un entorno sin bloqueo.

---

## 3. Marco de sanciones (la espina de la decisión)

Hay que separar tres cosas que se confunden:

1. **Bloqueo obligatorio (sanción DURA):** embargo *integral* sobre un territorio y sus
   residentes. Aquí procede geobloqueo total. Son **pocos** casos.
2. **Cribado por lista (sanción selectiva):** se congela a **personas y entidades concretas**
   (listas SDN de OFAC / listas UE). **No** prohíbe que un ciudadano de a pie use un servicio
   de consumo. Bloquear el país entero aquí es **elección**, no obligación.
3. **Riesgo comercial:** fraude, *chargebacks*, lavado, reputación. Lo gestiona el PSP.

Como empresa **de la UE (Estonia)**, la obligación primaria es el **régimen de sanciones de la
UE**; OFAC vincula de forma directa al tocar USD o infraestructura de pago sujeta a EE. UU.
(lo habitual con tarjeta). En la práctica se adopta el estándar OFAC porque **los procesadores
lo exigen**.

### 3.1 Bloqueo obligatorio (todos los sectores)

Cuba, Irán, Corea del Norte, Siria*, Crimea y las regiones ucranianas ocupadas (Donetsk,
Luhansk; la UE añade Zaporiyia y Jersón). *Siria está en transición desde 2025 (licencias
generales tras la caída del régimen); tratar como bloqueada por defecto hasta confirmar.

**Rusia y Bielorrusia NO son embargo integral:** sanciones **sectoriales** y por lista. La UE
aclaró que no se controla la nacionalidad transacción a transacción; las restricciones a
personas físicas afectan a depósitos > 100 000 € y a individuos **designados**. Legalmente
**no** hay obligación de bloquear a un ruso/bielorruso común; hacerlo es decisión comercial.

### 3.2 Foco América (país por país)

| País | ¿Bloqueo obligatorio? | Naturaleza | Recomendación |
|---|---|---|---|
| **Cuba** | **Sí (DURA)** | Embargo integral OFAC | **Bloquear** (único caso americano limpio) |
| **Venezuela** | No | Selectiva (Gobierno/PDVSA); el pueblo **no** está sancionado | Decisión comercial (riesgo de pago) |
| **Nicaragua** | No | Selectiva (funcionarios del régimen) | Decisión comercial (bajo) |
| **Haití** | No | Embargo de **armas** ONU + bandas designadas | Decisión comercial (riesgo de lavado) |
| Resto de América | No | — | Elegibles |

**Conclusión:** de toda América, **solo Cuba** obliga a bloquear. Lo demás es elección.

---

## 4. Dos capas que la tesis "abierto salvo OFAC" omitía

### 4.1 Riesgo de pago (comercial)

Adult/cam es categoría *high-risk* de partida, y todo el negocio es *card-not-present* (73 %
de las pérdidas por fraude). **Latinoamérica es la región de mayor riesgo de fraude en
e-commerce** del mundo: en Brasil 1 de cada 3 transacciones sufre un intento de fraude, el
fraude CNP supera el 60 % en Brasil y México, y el *card testing* es la amenaza top de la
región. En riesgo de lavado, Haití (1.º) y Venezuela (2.º) encabezan LatAm.

**Implicación:** conviene **abrir el registro** y aplicar **fricción escalonada en el pago**
(3-D Secure obligatorio, límites de gasto iniciales, *velocity checks*) para LatAm — sobre
todo Brasil, México y Venezuela — en lugar de bloquear países. Esto lo negocia el PSP; es
sintonización de riesgo, no sanción.

### 4.2 Verificación de edad (legal, no sanción)

Segunda capa geográfica crítica en 2024-2026: Reino Unido (Online Safety Act, desde
25-jul-2025), Francia (doble anonimato, desde 11-ene-2025) y **+27 estados de EE. UU.**
(constitucionalidad avalada por el Supremo en jun-2025). Varias plataformas **geobloquean
estados enteros** en vez de verificar. No prohíbe el servicio, pero incumplir = responsabilidad
legal.

**Implicación:** diseñar el *age gating* como capacidad **activable por jurisdicción** (UK, FR,
estados de EE. UU.), reutilizando **Didit** (ya integrado para KYC/estimación de edad del
cliente). No afecta a la decisión de América, pero condiciona la apertura futura a UK/FR/US.

---

## 5. Estado vivo en PROD (a 2026-08-28)

- **Registro de cliente** (`COUNTRY_ACCESS_CLIENT_REGISTRATION_ALLOWED_COUNTRIES`), 28 países:
  `GB, IE, CA, AU, NZ, US, DE, AT, CH, ES, PT, FR, IT, NL, BE, LU, SE, DK, FI, NO, AR, CL, UY,
  MX, CR, PA, DO, PR`. Americanos presentes: **US, CA, MX, AR, CL, UY, CR, PA, DO, PR** (10).
- **Registro de modelo** (`..._MODEL_REGISTRATION_...`) añade, entre otros: **CO, PE, BO, EC,
  PY, BR, GT, HN, SV** + Europa del Este + MG.
- `COUNTRY_ACCESS_BLOCK_WHEN_MISSING=true` (si el geo no resuelve, se bloquea).

**Asimetría actual a corregir:** un colombiano puede registrarse como **modelo** pero no como
**cliente**. Ese es el caso que motivó este estudio.

---

## 6. Recomendación (Problema B)

La competencia respalda ir **amplio** en el cliente. El único bloqueo americano obligatorio es
**Cuba**. Con eso, la propuesta —que respeta el "todos los de América salvo lista negra" del
operador— es:

### 6.1 Añadir al registro de cliente (América)

- **Nivel 1 — inmediato (ya de confianza como modelos):** `CO, PE, EC, BO, PY, BR, GT, HN, SV`.
  Coherente con lo que ya aceptamos en el lado modelo; cubre los mercados hispanohablantes y
  Brasil; **resuelve el caso de Colombia**.
- **Nivel 2 — completar América (sin problema de sanción, menor volumen):** `NI, JM, TT, BZ,
  GY, SR, BS, BB` (y, si se quiere cobertura total, las microislas del Caribe oriental
  `AG, DM, GD, KN, LC, VC`).

### 6.2 Dejar fuera

- **Bloqueo legal (no negociable):** **Cuba (CU)**.
- **Espera por riesgo comercial (decisión del operador):** **Venezuela (VE)** y **Haití (HT)**
  — máximo riesgo de fraude/lavado de la región. Recomendación: **no** incluirlos ahora, o
  incluirlos **solo** cuando el PSP tenga activada la fricción de pago reforzada (3-DS + límites).

### 6.3 Valor propuesto para la llave de cliente (Nivel 1 + Nivel 2, sin microislas)

```
COUNTRY_ACCESS_CLIENT_REGISTRATION_ALLOWED_COUNTRIES=GB,IE,CA,AU,NZ,US,DE,AT,CH,ES,PT,FR,IT,NL,BE,LU,SE,DK,FI,NO,AR,CL,UY,MX,CR,PA,DO,PR,CO,PE,EC,BO,PY,BR,GT,HN,SV,NI,JM,TT,BZ,GY,SR,BS,BB
```

Excluidos deliberadamente: **CU** (legal), **VE** y **HT** (comercial). Aplicar primero en
**TEST**, verificar el registro de un cliente de país nuevo (p. ej. Colombia), y luego a
**AUDIT/PROD** por la vía habitual (`config.env` + `systemctl restart`; PRELAUNCH intacto).

### 6.4 Trabajo futuro relacionado (no bloquea B)

- **Fricción de pago por país** en el PSP antes de abrir revenue (LatAm alto fraude).
- **Age gating por jurisdicción** (UK/FR/US) con Didit antes de abrir esos mercados.
- Revisar **Siria** y los paquetes UE con asesoría antes de tocar exclusiones fuera de América.

---

## 7. Fuentes

Primarias (confianza alta): OFAC/US Treasury, Consilium UE (sanciones Rusia/Bielorrusia y
regiones ocupadas), Ofcom (UK Online Safety Act), ARCOM/IAPP (Francia), ONU/SIPRI (Haití).
ToS leídos directamente: CooMeet (`coomeet.com/agreement`), XloveCam
(`xlovecam.com/en/support/terms`). Secundarias (confianza media/baja): recopilatorios de
bufetes de sanciones, prensa de PSP (chargebacks911, biocatch), reseñas de plataformas y
páginas de estudios/afiliados (Streamate country list, CrakRevenue, etc.). Los ToS de
LuckyCrush, XCams, Streamate, ImLive, CamContacts y DirtyRoulette **no** fueron accesibles al
fetch automático; sus datos de cliente son inferencia marcada como tal.

> Para una decisión vinculante sobre exclusiones por sanción, contrastar el listado vigente con
> asesoría legal de sanciones: el régimen sirio y los paquetes de la UE cambian con frecuencia.

---

## 8. Anexo — Compliance específico de EEUU (cliente)

Revisión motivada por la duda del operador: EEUU **ya está** en la allowlist de cliente (hoy ya
aceptamos clientes de EEUU); ¿cumplimos? Resumen de la revisión (fuentes en el cuerpo; no es
asesoría legal — el punto más incierto merece opinión de un despacho adult/First Amendment).

### 8.1 Veredicto: MANEJABLE, no bloqueador — pero con un hueco real

Aceptar clientes de EEUU es un problema **moderado y gestionable**, no un impedimento. De hecho,
en **pagos EEUU MEJORA** nuestro perfil frente a Latinoamérica (chargeback EEUU ~0,47 % vs Brasil
~3,48 %, México ~2,81 %). El coste real está en el **cumplimiento regulatorio adult**, no en el
fraude.

### 8.2 Reencuadre clave para la decisión de países

La carga de compliance que motivó la filosofía restrictiva **se concentra en EEUU, Reino Unido y
Francia** (leyes de verificación de edad), **no en Latinoamérica**. LatAm es **fácil** en el lado
regulatorio; su único problema es el **fraude de pago** (comercial, y no activo en PRELAUNCH). Es
decir: **ser permisivos con clientes de LatAm es de bajo riesgo de compliance**; el compliance
difícil es justo el mercado (EEUU) que ya teníamos dentro.

### 8.3 Las cuatro cargas de EEUU

1. **Verificación de edad por estado (la novedad 2024-2026).** ~27 estados con ley en vigor; el
   Supremo la avaló en *Free Speech Coalition v. Paxton* (jun-2025, escrutinio intermedio). Aplican
   a webs donde >1/3 del contenido es "sexual material harmful to minors" (Kansas 25 %, Tennessee
   "substantial portion"). **Zona gris real:** las leyes se escribieron para *tube sites*
   pregrabados; **no está resuelto** si un videochat 1-a-1 en vivo entra. Señal práctica: Texas
   **ya demandó a Chaturbate** (cam en directo). **Prudente asumir que aplica.** `self-attestation`
   ("soy mayor") **no** cumple; hace falta ID, digital ID o **estimación facial por IA** de tercero.
2. **18 U.S.C. §2257 (record-keeping).** Aplica a productores de contenido sexual explícito real;
   la industria trata a los cam sites como productores. Obliga a verificar edad de las **modelos**
   con ID y conservar registros (custodian con dirección física). Mitigación **ya en marcha vía
   Didit/KYC** — mantenerla y documentarla. Enforcement extraterritorial contra una OÜ estonia:
   incierto/poco litigado.
3. **FOSTA-SESTA.** Un videochat en vivo sin encuentros presenciales no es el objetivo; el riesgo
   surge si el chat se usa para pactar prostitución presencial. Mitigación: ToS que lo prohíban +
   moderación activa + KYC de modelos.
4. **PSP high-risk (VIRP).** Adult es categoría high-risk (~3-4 % chargeback; el umbral de
   monitorización Visa/MC es 1 %). Exige acquirer especializado (Segpay/Vendo/CCBill…), registro
   **VIRP** (~950 $ + fees) y — contractualmente — **verificación de edad de usuarios y modelos**.
   El corte de pagos es el vector de enforcement **más real** contra un operador offshore.

### 8.4 Exposición del operador extranjero (UE/Estonia)

No estamos inmunes: las leyes de AV se aplican por **accesibilidad**, no por presencia (Texas
congeló el dominio de un porn site extranjero). Vectores realistas: *private right of action*,
multas de AG (Louisiana 5-10 k$/día), bloqueo de dominio por estado y, sobre todo, **presión sobre
los pagos**. El riesgo **penal-personal** es bajo en la práctica **salvo** aparición de contenido
con menores (ahí el riesgo es serio y global, sin tolerancia).

### 8.5 ¿Cumplimos hoy? (honesto)

- **Sí:** KYC/verificación de edad de **modelos** vía Didit (cubre 2257/VIRP/anti-trata en el lado
  modelo). ✓
- **No / parcial:** **no** hay verificación de edad de **clientes** por estado en EEUU. En
  PRELAUNCH no hay usuarios reales, así que **no hay incumplimiento activo**, pero **antes de abrir
  EEUU en modo OPEN** hay que resolverlo. ✗

### 8.6 Medidas mínimas antes de abrir EEUU (modo OPEN)

**Obligatorio:** (1) age-gating de cliente por estado (ID / estimación facial de tercero — encaja
con **Didit**, que ya hace age estimation de cliente) **o** geobloqueo de los estados con ley;
(2) KYC de modelos (ya está); (3) ToS + moderación anti-FOSTA; (4) PSP high-risk registrado en
VIRP; (5) health warnings donde la ley estatal los exija. **Prudente:** opinión legal específica
sobre si el 1-a-1 en vivo cae bajo las AV, y confirmar requisitos con el PSP.

**Conclusión operativa:** EEUU no bloquea la expansión de clientes de LatAm (son decisiones
independientes). La expansión de **LatAm es de bajo riesgo** y puede hacerse ya; **EEUU** conviene
tratarlo como un **frente aparte** (age-gating por estado con Didit) **antes** de pasar el cliente
de EEUU a OPEN. En PRELAUNCH no corre prisa, pero es deuda a saldar antes del lanzamiento público
en EEUU.
