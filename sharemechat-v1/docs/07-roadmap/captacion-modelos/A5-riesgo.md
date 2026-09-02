# A5 — Riesgo de trata/explotación por país (informativo, no filtro)

> **Propósito**: dimensionar de forma FACTUAL y proporcionada el riesgo de trata/explotación
> sexual asociado a la captación de modelos de webcam, por país candidato. Uso INFORMATIVO.
> **NO es un filtro** que descarte países — el filtro es la legalidad (otro agente).
> Distinguimos **riesgo-PAÍS** (entorno/prevalencia) de **riesgo-CANAL** (cómo reclutas).
>
> Fuente principal: informes **TIP (Trafficking in Persons)** del Depto. de Estado de EE.UU.
> El informe más reciente es el **TIP Report 2025** (publicado sept. 2025; cubre 188 países).
> Complemento con prensa. KYC obligatorio (verificación de identidad + edad) mitiga el riesgo
> individual; aquí se mide riesgo-país vs riesgo-canal.
>
> Nota de fetch: las páginas de state.gov devuelven binario/imagen no parseable por WebFetch;
> los datos se recuperaron vía búsqueda web sobre esas mismas páginas oficiales (URL citada por
> país). Tiers cruzados con notas de prensa del lanzamiento del informe 2025.

## Marco de lectura (importante, no alarmista)

- **El Tier TIP mide al GOBIERNO, no a la población ni el riesgo para un reclutador.** Refleja
  cuánto cumple el Estado los estándares mínimos de la TVPA para *combatir* la trata, no la
  probabilidad de que una modelo concreta sea víctima. Tier 2/3 alto suele significar Estado
  débil o cómplice, no que reclutar de forma legítima sea peligroso.
- **El riesgo real casi nunca es la persecución de la adulta voluntaria.** El trabajo de cam
  adulto y consentido no es trata, y **ningún** informe TIP de estos 25 países describe la
  persecución de trabajadoras sexuales adultas voluntarias como problema de trata. El riesgo
  relevante y recurrente es el **reclutamiento organizado engañoso**: redes sociales con
  ofertas de empleo falsas, "agencias" fraudulentas, relaciones románticas fingidas, servidumbre
  por deuda, retención de documentos. Eso es **riesgo-CANAL**: depende de CÓMO reclutas
  (directo y verificado con KYC vs. vía intermediarios/"agencias" opacas).
- **Patrón transversal 2025**: en casi todos los países el TIP dice que los tratantes reclutan
  "increasingly via social media / fake job ads / online platforms". Es la MISMA vía que usaría
  un reclutador legítimo si va por intermediarios opacos → por eso el KYC directo y la ausencia
  de intermediarios de captación es la mitigación central.
- **Mención webcam / OSEC** (Online Sexual Exploitation of Children / cybersex): cuando el TIP
  lo cita, casi siempre es **menores** o coacción, no adultas voluntarias. Señala que existe
  infraestructura de explotación en línea en el país → relevante para reforzar verificación de
  edad/identidad en el canal, NO para descartar el país.

---

## Tabla resumen

| País | Tier TIP 2025 | Riesgo reclutador legítimo | ¿País o canal? | Mención webcam/OSEC | Fuente URL |
|---|---|---|---|---|---|
| Colombia | Tier 2 (bajó de T1) | MEDIO | Canal (redes/ofertas falsas a migrantes VE) | Reclutamiento online sí; webcam no específico | https://www.state.gov/reports/2025-trafficking-in-persons-report/colombia/ |
| Venezuela | **Tier 3** | ALTO | **País + canal** (Estado permisivo/cómplice) | Reclutamiento online sí; webcam no específico | https://www.state.gov/reports/2025-trafficking-in-persons-report/venezuela/ |
| Perú | Tier 2 | MEDIO | Canal (redes, ofertas falsas; migrantes VE) | Reclutamiento vía redes sí; webcam no específico | https://www.state.gov/reports/2025-trafficking-in-persons-report/peru/ |
| Bolivia | Tier 2 Watch List | MEDIO | Canal (redes = herramienta principal) | Reclutamiento vía redes sí; webcam no específico | https://www.state.gov/reports/2025-trafficking-in-persons-report/bolivia/ |
| Ecuador | Tier 2 | MEDIO | Canal (redes; migrantes VE) | Reclutamiento online sí; webcam no específico | https://www.state.gov/reports/2025-trafficking-in-persons-report/ecuador/ |
| Brasil | Tier 2 Watch List (bajó) | MEDIO | Canal (anuncios online, redes) | **Sí** — live-streaming de CSAM tipificado (Ley 4224); OSEC infantil | https://www.state.gov/reports/2025-trafficking-in-persons-report/brazil/ |
| México | Tier 2 | MEDIO | Canal (online: redes, videojuegos, apps, webs) | Reclutamiento online muy destacado; webcam no específico | https://www.state.gov/reports/2025-trafficking-in-persons-report/mexico/ |
| Rep. Dominicana | Tier 2 (subió) | MEDIO | Canal (plataformas online, WhatsApp) | OSEC infantil vía redes/WhatsApp sí; webcam no específico | https://www.state.gov/reports/2025-trafficking-in-persons-report/dominican-republic/ |
| Rumanía | Tier 2 | MEDIO | Canal (redes + **videochat**) | **Sí — "videochat" citado** para reclutar y anunciar | https://www.state.gov/reports/2025-trafficking-in-persons-report/romania/ |
| Ucrania | Tier 2 | MEDIO (+ contexto guerra) | Canal (cuentas anónimas online) | Reclutamiento online sí; webcam no específico | https://www.state.gov/reports/2025-trafficking-in-persons-report/ukraine/ |
| Moldavia | Tier 2 | MEDIO | Canal (internet, redes, mensajería) | OSEC infantil (grooming, "online child pornography") sí; webcam adulto no específico | https://www.state.gov/reports/2025-trafficking-in-persons-report/moldova/ |
| Serbia | Tier 2 (subió) | MEDIO | Canal (anuncios de empleo falsos online) | Reclutamiento online sí; webcam no específico | https://www.state.gov/reports/2025-trafficking-in-persons-report/serbia/ |
| Bulgaria | Tier 2 | MEDIO | Canal (internet, anuncios falsos) | Reclutamiento online sí; webcam no específico | https://www.state.gov/reports/2025-trafficking-in-persons-report/bulgaria/ |
| Albania | Tier 2 | MEDIO | Canal (redes, apps móviles) | Reclutamiento/anuncio online sí; webcam no específico | https://www.state.gov/reports/2025-trafficking-in-persons-report/albania/ |
| Macedonia del Norte | Tier 2 | MEDIO | Canal (perfiles falsos en redes/apps) | Reclutamiento online sí; webcam no específico | https://www.state.gov/reports/2025-trafficking-in-persons-report/north-macedonia/ |
| Bosnia y Herzegovina | Tier 2 | MEDIO | Canal (agencias de reclutamiento mal reguladas) | Reclutamiento online sí; webcam no específico | https://www.state.gov/reports/2025-trafficking-in-persons-report/bosnia-and-herzegovina/ |
| Georgia | **Tier 1** | BAJO | Canal (mínimo; Estado cumple) | Anuncios online de "escort"; webcam no específico | https://www.state.gov/reports/2025-trafficking-in-persons-report/georgia/ |
| Madagascar | Tier 2 | MEDIO | Canal (reclutamiento fraudulento; OSEC emergente) | **Sí** — OSEC infantil "en aumento" (mesa redonda gov.) | https://www.state.gov/reports/2025-trafficking-in-persons-report/madagascar/ |
| Costa de Marfil | Tier 2 | MEDIO | Canal (brokers laborales fraudulentos) | No específico | https://www.state.gov/reports/2025-trafficking-in-persons-report/cote-divoire |
| Camerún | Tier 2 | MEDIO | Canal (brokers laborales; destino Golfo) | No específico | https://www.state.gov/reports/2025-trafficking-in-persons-report/cameroon/ |
| Senegal | Tier 2 | MEDIO | Canal (SOPs de identificación débiles) | No específico | https://www.state.gov/reports/2025-trafficking-in-persons-report/senegal/ |
| Kenia | Tier 2 | MEDIO | Canal (agencias fraudulentas; trata = laboral Golfo) | No específico (trata dominante es laboral doméstica) | https://www.state.gov/reports/2025-trafficking-in-persons-report/kenya/ |
| Sudáfrica | Tier 2 Watch List (bajó) | MEDIO-ALTO | **País + canal** (corrupción/complicidad policial) | No específico | https://www.state.gov/reports/2025-trafficking-in-persons-report/south-africa/ |
| Filipinas | **Tier 1** | MEDIO | **Canal** (OSEC/cibersexo estructural — máxima cautela edad) | **Sí, fuerte** — OSEC/CSAEM, ley OSAEC, cibersexo tech-enabled | https://www.state.gov/reports/2025-trafficking-in-persons-report/philippines/ |
| Reunión (Francia) | **Tier 1** (Francia) | BAJO | — (Estado cumple; foco overseas = Mayotte, no Reunión) | No específico para Reunión | https://www.state.gov/reports/2025-trafficking-in-persons-report/france/ |

**Leyenda de riesgo (para un reclutador legítimo con KYC):**
BAJO = entorno fuerte, riesgo casi solo teórico. MEDIO = existe reclutamiento organizado engañoso
que un canal opaco reproduciría; mitigable con KYC directo. ALTO = entorno con Estado débil/cómplice
que eleva el riesgo-país por encima de lo que el canal puede mitigar por sí solo.

---

## Notas por país

### Latinoamérica

- **Colombia (Tier 2, bajó de Tier 1).** Degradado en 2025 por esfuerzos no "serios y sostenidos"
  (menos financiación, NAP vencido). Reclutamiento típico: redes y falsas ofertas de empleo, muy
  centrado en **migrantes venezolanos** en zona fronteriza y Darién (esquemas de deuda). Sin
  mención webcam específica. Riesgo = **CANAL**: alto volumen de captación fraudulenta por
  intermediarios; un reclutador directo con KYC lo evita.

- **Venezuela (Tier 3).** El único Tier 3 de la lista. El informe describe **complicidad/permisividad
  del Estado** (Maduro y representantes) y grupos armados que explotan a menores. Reclutamiento con
  falsas promesas de migración segura y empleos falsos. Aquí el riesgo NO es solo canal: el **entorno
  país** (impunidad, ausencia de instituciones que verifiquen) eleva el riesgo. Riesgo **ALTO,
  país + canal**. No implica descartar (eso lo decide legalidad), pero sí máxima cautela y
  verificación reforzada; el pool de captación se solapa con población migrante muy vulnerable.

- **Perú (Tier 2).** Reclutamiento crecientemente por **redes sociales**, falsas ofertas de empleo y
  falsas relaciones románticas; víctimas frecuentes = **migrantes venezolanos** y desplazados por
  desastres (2024-25). Sin webcam específico. Riesgo **MEDIO, canal**.

- **Bolivia (Tier 2 Watch List).** Degradado. Redes sociales = "herramienta principal" de captación
  con ofertas de empleo fraudulentas. Gobierno exige registro de agencias de empleo (dato útil: hay
  marco formal contra el intermediario opaco). Sin webcam específico. Riesgo **MEDIO, canal**.

- **Ecuador (Tier 2).** Redes sociales para reclutar y hacer *grooming*; víctimas = mujeres
  colombianas, peruanas y **venezolanas** desplazadas con ofertas laborales falsas. Menciona
  explotación sexual comercial extraterritorial por turistas (menores). Riesgo **MEDIO, canal**.

- **Brasil (Tier 2 Watch List, bajó).** Degradado por menos investigaciones/condenas. Reclutamiento
  vía **anuncios online, redes y medios digitales**. **Mención webcam/OSEC relevante**: Ley 4224
  tipifica el *live-streaming* de explotación sexual comercial infantil; explotación sexual infantil
  por visitantes extranjeros "endémica" en zonas costeras. El OSEC es infantil, no adultas
  voluntarias. Riesgo **MEDIO, canal** (con cautela de verificación de edad por infraestructura de
  *streaming* de abuso ya existente).

- **México (Tier 2).** Reclutamiento **online muy destacado**: redes, videojuegos, webs, apps de
  citas; una ONG reporta que >45% de víctimas de la línea de ayuda (2022-24) fue captada por esos
  canales. Mayoría de casos: familia, pareja, conocidos en redes, o esquemas de empleo fraudulento.
  Sin webcam específico. Riesgo **MEDIO, canal** (el canal online es exactamente el vector citado).

- **Rep. Dominicana (Tier 2, subió).** Mejora del gobierno. Plataformas online y **WhatsApp** para
  captar/explotar; en casos infantiles, redes para atraer menores (OSEC). Reformó la ley (elimina
  probar fuerza/fraude/coacción en menores). Riesgo **MEDIO, canal**.

### Europa del Este / Balcanes / Cáucaso

- **Rumanía (Tier 2).** **Único país donde el TIP cita "videochat" explícitamente** como vía de
  reclutamiento y anuncio (junto a redes), sobre todo con **menores**. Tratantes suelen ser rumanos,
  individuales o en redes pequeñas; la captación por violencia bajó y subió la manipulación
  emocional/chantaje. Vulnerables: menores institucionalizados, comunidad Roma, mujeres con poca
  educación. Rumanía tiene industria legal de "videochat" conocida → el término aparece en ambos
  lados; para un reclutador legítimo el riesgo es **CANAL** (distinguir estudio legítimo de red de
  captación de menores/coacción). Riesgo **MEDIO, canal**.

- **Ucrania (Tier 2).** Captación por **cuentas anonimizadas online**. Contexto de guerra: 6,9 M de
  refugiados y 3,6 M de desplazados internos elevan la vulnerabilidad. El riesgo-país sube por la
  guerra (población desplazada), pero el vector sigue siendo canal. Riesgo **MEDIO, canal + contexto
  país (guerra)**.

- **Moldavia (Tier 2).** Captación por vínculos familiares/personales e **internet, redes y
  mensajería**. Menciona **OSEC infantil** ("online child pornography" usada como grooming).
  Coordinación con Ucrania sobre reclutamiento online. Webcam adulto no específico. Riesgo
  **MEDIO, canal**.

- **Serbia (Tier 2, subió).** **Anuncios de empleo falsos online** (redes) como vía típica. Dato de
  canal: agencias de reclutamiento se re-forman con otro nombre tras perder licencia, y hay contratos
  con traducciones "sustancialmente distintas" del original → señal de **riesgo-canal por
  intermediarios**. Riesgo **MEDIO, canal**.

- **Bulgaria (Tier 2).** Trata sexual = forma más prevalente; víctimas jóvenes de comunidad Roma o
  etnia turca. Captación creciente por **internet, redes y mensajería con anuncios falsos**. Fuente
  primaria de trata en la UE. Sin webcam específico. Riesgo **MEDIO, canal**.

- **Albania (Tier 2).** Redes para reclutar; anuncios de sexo comercial vía apps móviles y
  plataformas. Gobierno investiga a compradores (reducción de demanda). Sin webcam específico. Riesgo
  **MEDIO, canal**.

- **Macedonia del Norte (Tier 2).** **Perfiles falsos** en redes y apps para captar; recibe víctimas
  extranjeras de Europa del Este, Balcanes y Sudamérica. Sin webcam específico. Riesgo **MEDIO,
  canal**.

- **Bosnia y Herzegovina (Tier 2).** Explotación en residencias privadas y moteles; menores Roma en
  varias formas. Agencias de reclutamiento reguladas pero inspección débil (riesgo-canal por
  intermediario). Sin webcam específico. Riesgo **MEDIO, canal**.

- **Georgia (Tier 1).** **Único Tier 1 no-europeo-occidental de la lista.** Estado cumple estándares
  ("serious and sustained"). Tratantes desplazaron reclutamiento/anuncio a medios **online** (chats,
  webs de "escort") y ofertas fraudulentas de empleo bien pagado en el extranjero. Riesgo **BAJO,
  canal mínimo** — entorno institucional fuerte.

### África

- **Madagascar (Tier 2).** Gobierno hace esfuerzos significativos. **OSEC infantil "en aumento"**
  (mesa redonda con organismo internacional; portal de denuncia de abuso infantil con telcos).
  Suspende acreditaciones de agencias de reclutamiento para prevenir fraude (dato de canal). El OSEC
  es infantil. Riesgo **MEDIO, canal** (verificación de edad reforzada por OSEC emergente).

- **Costa de Marfil (Tier 2).** Mujeres y niñas en trabajo forzoso (servicio doméstico, restaurantes)
  y trata sexual. Esfuerzos crecientes (nueva unidad policial, presupuesto NAP). Vector principal =
  brokers laborales. Sin webcam específico. Riesgo **MEDIO, canal**.

- **Camerún (Tier 2).** **Brokers laborales fraudulentos** captan mujeres para trabajo doméstico en
  Oriente Medio, donde son explotadas. Regulación de reclutadores extranjeros deficiente (riesgo-canal
  claro). Trata dominante = laboral/exterior, no cam. Sin webcam específico. Riesgo **MEDIO, canal**.

- **Senegal (Tier 2).** Esfuerzos crecientes (formación, base de datos, más víctimas identificadas).
  Debilidad: SOPs de identificación no aplicados consistentemente. Sin webcam específico. Riesgo
  **MEDIO, canal**.

- **Kenia (Tier 2).** La trata dominante es **laboral** (servidumbre doméstica en Golfo:
  Arabia Saudí, Líbano). Dato de canal llamativo: webs de agencias muestran fotos de trabajadoras
  que se "añaden al carrito". Agencias fraudulentas retienen pasaportes/salarios. Trata sexual-cam no
  es el foco. Sin webcam específico. Riesgo **MEDIO, canal** (el riesgo se concentra en el
  intermediario/agencia).

- **Sudáfrica (Tier 2 Watch List, bajó).** Degradado por caída fuerte en identificación de víctimas,
  investigaciones y procesamientos. **Corrupción/complicidad policial e inmigratoria** que facilita a
  tratantes; burdeles conocidos operan con "tacit approval". Captación de menores de zonas rurales
  hacia ciudades (Gauteng, Western Cape). Aquí el **riesgo-país sube** por complicidad estatal. Sin
  webcam específico. Riesgo **MEDIO-ALTO, país + canal**.

### Sudeste Asiático / Territorios franceses

- **Filipinas (Tier 1).** Estado fuerte (Tier 1 diez años seguidos), **pero es el epicentro global
  del OSEC/cibersexo**: ley OSAEC, Centro Nacional contra OSAEC/CSAEM, casos de explotación sexual
  infantil en línea con *plea bargaining*, "tech-enabled crimes stubbornly persistent". El riesgo
  aquí NO es que el Estado persiga a la adulta voluntaria (al contrario, marco robusto), sino que la
  **infraestructura de explotación sexual en línea (incl. de menores) es estructural** y el escrutinio
  regulatorio/mediático es máximo. Para un reclutador legítimo de cam adulto: riesgo **MEDIO, canal**
  — obligación de verificación de edad/identidad extrema y distancia total de cualquier zona gris de
  menores. El país en sí es institucionalmente sólido (Tier 1).

- **Reunión (Francia, Tier 1).** Francia cumple plenamente los estándares. El informe trata trata en
  territorios de ultramar, pero las preocupaciones concretas citadas se centran en **Mayotte** (no en
  Reunión): solicitantes de asilo, menores no acompañados. Para Reunión no hay señalamiento
  específico de trata sexual/cam. Riesgo **BAJO** — entorno jurídico de la UE/Francia, canal mínimo.

---

## Conclusiones transversales (para el diseño del canal de captación)

1. **El riesgo dominante es de CANAL, no de país.** En 23 de 25 países el TIP describe el mismo
   vector: captación por **redes sociales / falsas ofertas de empleo / plataformas online**, a menudo
   vía **agencias/intermediarios opacos** que se re-forman tras perder licencia. Un canal de
   captación **directo, sin intermediarios, con KYC de identidad y edad up-front** neutraliza
   precisamente ese vector. Es la mitigación estructural más potente.

2. **La persecución de la adulta voluntaria NO aparece** como problema de trata en ninguno de los 25
   informes. El marco TIP es fuerza/fraude/coacción y menores. Reclutar adultas que consienten,
   verificadas, no es lo que estos informes penalizan ni describen como riesgo.

3. **Riesgo-país elevado (por encima de lo que el canal mitiga) solo en 2 casos**: **Venezuela**
   (Tier 3, complicidad estatal) y, en menor grado, **Sudáfrica** (Tier 2 WL, complicidad policial).
   No son descartes automáticos (eso es legalidad), pero piden verificación reforzada y conciencia de
   que el entorno institucional no ayuda a filtrar.

4. **Mención webcam/online explícita**: **Rumanía** ("videochat"), **Brasil** (live-streaming CSAM),
   **Filipinas** (OSEC/cibersexo estructural), **Madagascar** y **Moldavia** (OSEC infantil),
   **Rep. Dominicana** (grooming por WhatsApp). En TODOS los casos el componente webcam citado es
   **infantil/coactivo**, no cam adulto voluntario. Implicación: reforzar verificación de edad, no
   evitar el país.

5. **Tier 1 (entorno fuerte)**: Georgia, Filipinas, Francia/Reunión. Filipinas es Tier 1 pero con
   OSEC estructural → cautela de canal máxima pese al entorno sólido.

---

## LO QUE NO PUDE VERIFICAR

- **Texto verbatim de las páginas TIP**: WebFetch a state.gov devuelve binario/imagen no parseable
  (páginas JS-heavy). Los datos provienen de **búsqueda web sobre esas mismas URLs oficiales** +
  documentos espejo de ecoi.net y notas de prensa del lanzamiento (sept. 2025). Los **tiers** están
  cruzados y son fiables; algunas **citas literales** ("videochat", "add to a cart") provienen de los
  extractos devueltos por el buscador, no de lectura directa del PDF. Para uso publicable conviene
  abrir la URL TIP de cada país y copiar la cita exacta a mano.
- **Bosnia (Tier 2)**: el extracto no mostró el tier 2025 de forma explícita; se infiere de continuidad
  con 2024 (Tier 2) y del lenguaje de esfuerzos. Confirmar en la página.
- **Georgia y Filipinas (Tier 1 2025)**: el lenguaje "serious and sustained" es consistente con Tier 1
  y hay confirmación de prensa (IJM para Filipinas), pero no leí la cabecera de tier en el PDF 2025.
- **Reunión específicamente**: el TIP trata a Francia como país (Tier 1) y detalla ultramar sobre todo
  en Mayotte; no hay narrativa TIP dedicada a Reunión. La valoración BAJO se apoya en el marco
  Francia/UE, no en un párrafo específico de Reunión.
- **No consulté** el Global Slavery Index (Walk Free) ni informes de OIT/UNODC como contraste
  cuantitativo; el encargo pedía TIP como fuente principal y así se hizo. Si se quiere un segundo
  indicador de prevalencia (no solo esfuerzo gubernamental), el Global Slavery Index sería el
  complemento natural.
- **Prevalencia real por país** (número de víctimas): el TIP no da cifras comparables fiables; mide
  esfuerzo del gobierno, no volumen. No debe leerse el tier como "cuántas víctimas hay".
