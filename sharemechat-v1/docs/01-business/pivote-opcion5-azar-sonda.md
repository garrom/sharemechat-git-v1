# SONDA Azar (Opción 5 del pivote) — todo lo que hay en azarlive

> **2026-09-06.** Investigación profunda (SONDA, 5 agentes en paralelo, fuentes vivas) sobre **Azar / azarlive.com** (Hyperconnect → Match Group) como referencia de la **Opción 5** del pivote ([`pivote-2026-09.md`](pivote-2026-09.md) §3): un producto de videochat 1-a-1 entre usuarios, no-adult. Objetivo: destripar **cómo funciona, cómo maneja la EDAD y cómo se cubre legalmente**, y qué es replicable por una OÜ estonia.
>
> Etiquetas de evidencia: **[DATO DURO]** (visto en fuente oficial/primaria) · **[IMPRESIÓN]** (inferencia razonada) · **[NO VERIFICADO]** (sin fuente sólida). Corrige dos premisas de partida: (1) que Azar "se parece a Omegle" y (2) que "no verifica edad". **Las dos son falsas** — ver §2.

## 0. Veredicto en tres líneas

1. **Azar NO es Omegle** (que era anónimo, sin cuentas, sin moderación, y cerró en 2023 por demandas de abuso de menores). Azar tiene cuentas 18+, moderación por IA y **verificación de edad facial**.
2. **Azar SÍ verifica edad**: escaneo facial antes de cada llamada en todo el mundo + **selfie-check biométrico (Yoti/FaceTec) en UE/UK/US/Australia**. No se cubre con un disclaimer; se cubre **estimando la edad**. Lo que el operador vio en la web ("sin verificación") es la superficie ligera del navegador.
3. **La Opción 5 es imitable, pero lo imitable es "estimación de edad + ToS de indemnización + moderación", NO "solo teléfono".** Y hay un tope de distribución: **Apple prohíbe el random chat** → se arranca **solo web**.

## 1. Qué es Azar (empresa y escala)

- **[DATO DURO]** Hyperconnect (Seúl, 2014); **Match Group la compró en 2021 por 1.725 M USD** (su mayor adquisición). En la UE opera **MTCH Technology Services Limited** (Dublín, Irlanda).
- **[DATO DURO]** **+500 M descargas**, 230 países, 19 idiomas, +147.000 M de matches (marzo 2024); **99% de usuarios fuera de Corea**. Fuerte en **Oriente Medio, India, Sudeste Asiático y LatAm**.
- **[DATO DURO]** Ingresos del segmento "MG Asia" (Azar+Hakuna): **283,9 M USD en 2024** (-6%, por el declive del livestreaming; **Azar por sí solo crece ~20%**). El streaming *dentro* de Azar se cerró en **noviembre 2025**.
- Lectura: no es un nicho — es escala global con motor de monetización premium/IA. Replicarlo en solitario compite contra la infraestructura de moderación de todo Match Group.

## 2. Edad y blindaje legal (el corazón de la sonda)

- **[DATO DURO]** ToS (efectivos 2026-02-01): el usuario **"represents and warrants... at least 18 years old"** (representación contractual, no casilla pasiva). Community Guidelines: *"You must be 18 or older"*; *"We enforce strict age limits"*. En Corea el umbral es 19.
- **[DATO DURO] Age assurance en DOS capas** (página oficial *Age assurance at Azar*):
  1. **Global:** *"we may review your face when your camera is on, just before a call starts"* — IA que busca señales de <18. Sin crear face map identificativo.
  2. **Reforzada (UE/UK/US/Australia):** **video-selfie con Yoti y FaceTec** → face map efímero (borrado ~1 día), 2 "audit images" hasta 3 meses, age score 12 meses. Si estima <18 → **baneo con apelación** (posible ID check solo en disputa).
- **[DATO DURO]** ToS en mayúsculas: *"AZAR DOES NOT CONDUCT CRIMINAL BACKGROUND OR IDENTITY VERIFICATION CHECKS"*. Es decir: **estimación de edad ≠ verificación de identidad**. Azar separa deliberadamente las dos. Esto es clave: la capa proporcionada es *estimar la edad*, no pedir el DNI.
- **[DATO DURO] Prueba de que la casilla sola no basta en UE/UK:** el **Reino Unido obligó a Azar a expulsar a los menores de 18 el 1-jul-2025** (Online Safety Act). Azar cita explícitamente **DSA (UE) 2022/2065, UK OSA y la ley australiana** como base del selfie-check.
- **Blindaje legal en capas:** (a) representación contractual 18+ + cláusula de indemnización del usuario; (b) disclaimer de no-verificación de conducta/identidad; (c) **age estimation** real; (d) moderación (blur/ban/report) + "audit images" como evidencia; (e) **arbitraje obligatorio + class-action waiver**.
- **[NO VERIFICADO]** NO hay demandas BIPA, acción FTC ni multa coreana confirmadas contra Azar (los casos FTC/BIPA sonados son de OkCupid, Facebook, TikTok — **no atribuir a Azar**).

## 3. Cómo funciona el producto

- **Alta:** teléfono / email / social login (Google, Apple). Perfil: foto o vídeo de intro, nombre, edad, género, país, bio. Desde v7 exige nombre + foto + **video-selfie de edad**.
- **Match:** un toque conecta con otro usuario online según **preferencias + algoritmo**; **next/swipe** para saltar.
- **Capa social que retiene tras el match:** **Lounge** (ves perfiles, sigues/mensajeas), **Follow**, **Messages** (con *quick messages* preescritos), **History / actividad reciente / "me han visto"** (reconectar cuesta gemas).
- **[DATO DURO] Traducción en vivo** en 18 idiomas con **subtítulos de voz en tiempo real** — gran diferenciador (y algo que **ya tienes** en SharemeChat, el traductor P2P).
- **Moderación-producto:** **MatchBlur** (la IA desenfoca el vídeo del otro al detectar contenido inapropiado), report/block, **Azar Badge** de reputación (se gana por tiempo de chat sin infringir), IA 24/7.
- **[DATO DURO] Algoritmo "no aleatorio":** recomendador con IA (modelo **CUPID**, matchmaking con **Apache Flink** *stateful*, patentes de "single-click matchmaking"). El "una pulsación y conecta" esconde un recomendador que aprende preferencias para subir retención y disposición a pagar.

## 4. Monetización (el modelo de gemas)

- **[DATO DURO] Doble moneda:** **Gemas** (las compra el usuario y las gasta) + **Stars** (las gana el host en streaming y las cobra). Separa gasto de payout — limpio para contabilidad.
- **[DATO DURO] Consumo por acción, no por sesión:** el **filtro de género/país se cobra por cada match** (~8-24 gemas/swipe, exacto [NO VERIFICADO]) → drena saldo → recompra frecuente. **Es la palanca central.**
- **[DATO DURO] Paquetes de gemas escalonados** (App Store US): **0,99 $ → 37,99 $** (10 tramos), con descuento por volumen ("ahorra 15%" en tramos altos, [IMPRESIÓN]).
- **[DATO DURO] Suscripciones de 3 niveles** (precios vía review, reconfirmar en ficha): **Plus 10,99 $/mes** (2 filtros/día, sin ads, Global Match Pass) · **Premium 22,99 $/mes** (5 filtros/día, cambiar ubicación) · **Supreme 114,99 $/mes** (filtros ilimitados).
- **Regalos en streaming** (gemas → regalos → stars del host; la plataforma se queda el spread) — segundo motor.
- **[DATO DURO] Diseño de fricción:** la experiencia gratis se percibe **intencionadamente peor** (saldo que se agota, mejor match tras pagar) para forzar la conversión. Palanca potente pero con **riesgo reputacional** — usar con moderación en no-adult.

## 5. El grid de perfiles "ONLINE" de la web

- **[DATO DURO] Son ILUSTRATIVOS / stock, NO usuarios reales conectados.** El propio aviso *"Todas las imágenes son de modelos y se utilizan solo con fines ilustrativos"* es una auto-admisión. Es **prueba social de landing** (dar sensación de plataforma poblada y empujar al registro), no matching real.
- Patrón del sector (MonkeyChat usa perfiles ficticios declarados). **Legal si se etiqueta**, pero **no confundir con demanda real**: el motor de matching sigue necesitando usuarios vivos.

## 6. Qué significa para la OÜ (lo replicable y lo caro)

**Stack legal mínimo (barato, y en buena parte YA construido) para arrancar no-adult 18+ en UE/LatAm:**
- **Posicionamiento 18+ estricto** en ToS y registro (evita el art. 8 GDPR multi-país y el grueso del art. 28 DSA de menores).
- **Age-gate: auto-declaración 18+ + estimación de edad por IA (Didit, ya construida)** — capa "proporcionada" suficiente hoy en UE para no-adult; **no hace falta KYC documental**.
- **Verificación por teléfono (SMS)** — anti-abuso y señal de unicidad (ya prevista).
- **Report + Block** en producto; **punto de contacto** publicado (DSA arts. 11-12, 16).
- **Política de privacidad + ToS** claros; **DPA** con cada procesador; **RoPA**; **DPIA** (vídeo + estimación facial = alto riesgo; ya hay precedente en el proyecto).
- **Micro-empresa exenta** de la capa pesada del DSA (art. 19: reclamaciones formales, transparency reports…). El **art. 28 (menores) NO se exime** → otra razón para ir 18+.
- **Geobloquear UK** (OSA exige "highly effective age assurance") y **no targetear EE. UU.** al inicio (campo minado estado a estado).
- **Arrancar SOLO WEB (PWA):** **Apple prohíbe explícitamente** las apps de *random/anonymous chat* (Guideline 1.2); las tiendas añaden moderación exigida + rating 18+ que un fundador solo no sostiene el día 1. Google (más permisivo) primero, si acaso, más adelante.

**Reutilización del stack SharemeChat (alta):** motor de vídeo 1-a-1, matching, **traductor en vivo P2P**, i18n, gifts/emojis (base de la economía de gemas), Didit (age estimation), moderación/report, deploy. La distancia técnica es corta.

**El muro que NO desaparece:** la **densidad de arranque**. Un dating/social no-adult sigue necesitando suficiente gente en un mismo sitio (geografía/nicho) para que haya con quién hacer match, y sin presupuesto de ads hay que decidir *quiénes* son los primeros y *cómo* llegan. El grid ilustrativo maquilla la sensación, no la demanda. **Este es el siguiente nudo de análisis.**

## 7. Forma recomendada de la Opción 5

**Perfil-primero (estilo Tinder) con la videollamada como acción estrella**, no ruleta pura:
- El perfil vale aunque la persona esté offline → **ablanda el muro de la simultaneidad** (mejor para arrancar solo).
- La videollamada nativa **reutiliza tu mejor activo** y diferencia de Tinder ("no te escribas semanas — conócela en 2 minutos de vídeo").
- Evita además el veto de Apple al "random chat" (es descubrimiento + match, no ruleta anónima).
- **Gratis al arrancar**, con los ganchos de pago tipo gemas **diseñados pero apagados** (filtro de género/país, reconectar, boosts, "quién te dio like", vídeo más largo).

## 8. Fricción del age assurance — cómo igualar el escaneo invisible de Azar (2026-09-07)

Hallazgo a raíz de una observación del operador: hizo una videollamada en la web de Azar y **no percibió ninguna verificación de edad ni pasarela**. Investigado en fuente viva.

**Por qué es invisible en Azar (dos capas distintas, texto oficial):**
- **Capa global (en todo el mundo) — la invisible:** *"we may review your face when your camera is on, just before a call starts... automated technology... does not create, store, or rely on face maps"*. Es un **escaneo PASIVO de un frame** de la cámara ya encendida, **sin paso, sin selfie, sin pasarela**. Fricción cero. (Azar conserva la imagen 3 meses para auditar/entrenar.)
- **Capa reforzada (solo UE/UK/US/Australia) — la visible:** un **video-selfie** con Yoti/FaceTec (biométrico, face map efímero borrado ~1 día). Esta **sí** tiene fricción; se dispara por DSA/OSA/SMMA. En la **web** el operador probablemente solo topó con la capa pasiva (la selfie reforzada suele ir en la app o en un gate posterior).

**Fricción que tenemos HOY (ADR-035):** Didit cableado como **flujo alojado con redirección + checkbox de consentimiento biométrico, disparado en la primera recarga (pago)**. Es una **pasarela visible** — más fricción que el escaneo pasivo de Azar. Pero fue diseñado para el producto **adult** (gatear el momento del dinero); **no es una limitación técnica, es cableado**.

**SÍ podemos igualar el escaneo invisible — confirmado en fuente:** Didit ofrece una **API de age estimation "headless"/standalone**: se le manda **una sola imagen** y devuelve JSON con edad estimada + confianza + **liveness pasivo** (sin reto al usuario, sin interfaz alojada), ~0,10 USD/check, ±3,5 años. Es decir: **coger el primer frame del vídeo (cámara ya encendida) → API → pase silencioso**, exactamente la capa global de Azar. Docs: `docs.didit.me/standalone-apis/age-estimation`. Alternativas para el primer filtro pasivo: **AWS Rekognition** (rango de edad por imagen, casi gratis) y **Yoti** (premium certificado).

**Arquitectura recomendada (calcada de Azar y compatible con el patrón "Adaptive" del propio ADR-035):**
1. **Capa pasiva invisible** (caso común): frame del vídeo → API headless → pase silencioso. Fricción cero.
2. **Step-up con selfie** (solo el borde: edad dudosa o exigencia UE reforzada): flujo Didit con selfie. Es la **excepción**, no el default → el ~90% de usuarios no ve nada.

**Matiz legal (una vez, no es pega):** aunque sea pasivo, estimar edad desde la cara es **tratamiento biométrico**. Azar lo cubre **declarándolo en ToS/privacidad** (no con pasarela). Réplica: **aviso/consentimiento de una sola vez al registro** (una línea, no un redirect) + **borrado inmediato del frame**. Frictionless pero **declarado** — es lo que separa "pasivo y legal" de "secreto". El ADR-035 ya trata el consentimiento biométrico en serio (SharemeChat controller, Didit processor, checkbox explícito).

**Conclusión:** la brecha de fricción con Azar es **reconfigurable, no un muro**. Es cambiar el cableado (API headless sobre el frame) en vez del redirect alojado. Vale tanto para la Opción 5 como para cualquier producto de vídeo del pivote.

Fuentes §8: [Azar Age Assurance](https://help.azarlive.com/hc/en-us/articles/48317319109529-Age-assurance-at-Azar) · [Didit Age Estimation API](https://docs.didit.me/standalone-apis/age-estimation) · [Didit adaptive estimation+fallback](https://didit.me/blog/adaptive-age-verification-passive-estimation-document-fallback/) · [AWS Rekognition AgeRange](https://docs.aws.amazon.com/rekognition/latest/APIReference/API_AgeRange.html) · [Yoti Facial Age Estimation API](https://developers.yoti.com/facial-age-estimation-api) · interno: [ADR-035](../06-decisions/adr-035-age-and-identity-verification-vendor-consolidation-on-didit.md).

## Fuentes (primarias/oficiales)

Azar Help Center: Terms of Service (2026-02-01), Privacy Policy (2025-11-08), Age assurance at Azar, Community Guidelines, Notice of Service Cessation UK (2025), Gems & Stars, Plus/Premium/Supreme · App Store (id972558973) · Google Play (com.azarlive.android) · Match Group IR (adquisición, earnings) · Ververica (matchmaking Flink) · EUR-Lex DSA (arts. 11-19, 28) · EDPB Age Assurance Statement (2025-02-11) · Comisión Europea — Guidelines protección de menores (2025-07) · GDPR art. 8 · Ofcom (UK OSA) · Apple App Store Guidelines 1.2 · Google Play UGC. (URLs completas en los informes de los agentes de la sesión.)
