# A3 — Rail de cobro USDT → dinero local por país

> Agente A3. Pregunta: si la plataforma paga a la modelo en **cripto (USDT)** y la
> tarjeta/Paxum es limitada, ¿cómo convierte ella ese USDT en **dinero local usable**
> (efectivo, cuenta bancaria, mobile money)? El rail práctico casi siempre es
> **Binance P2P** (vender USDT a un comprador local que te paga por transferencia,
> pago móvil o mobile money). Fecha: 2026-09-02.
>
> **Hallazgo transversal:** en los ~25 países candidatos, el rail cripto→local
> FUNCIONA vía Binance P2P. La diferencia no es "¿se puede?" sino la **fricción**
> (liquidez del mercado P2P, spread, escrutinio bancario, madurez del método de cobro).

## Tabla resumen

| País | ¿cripto→local? | Mobile money / rail de cobro dominante | Paxum | Fricción | Fuente |
|---|---|---|---|---|---|
| **Colombia** | Sí (alta liquidez) | Nequi, Daviplata (wallets); PSE, Bancolombia; Efecty (efectivo) | No verif. | **FÁCIL** | Binance P2P Nequi/COP; Wise |
| **Venezuela** | Sí (mercado más adoptado) | **Pago Móvil** (>60% P2P), banca (BDV, Banesco, Mercantil) | Prob. NO (sanciones) | **FÁCIL** (rail) / riesgo país | usdt.com.ve; Yahoo Finanzas |
| **Perú** | Sí | **Yape / Plin** (wallets), BCP/Interbank transf. | Listado prob. | **FÁCIL–MEDIA** | Binance P2P PEN; paralelo.bo |
| **Bolivia** | Sí (ban BCB levantado 2024) | Tigo Money; banca. Guías desaconsejan Yape/Tigo por fraude | No verif. | **MEDIA** | paralelo.bo; dolar-bolivia.com |
| **Ecuador** | Sí (dolarizado, USD) | Sin mobile money dominante; banca + DeUna emergente | No verif. | **MEDIA** | Binance P2P; paybis |
| **Brasil** | Sí (mercado enorme) | **Pix** (pago instantáneo universal) | Listado prob. | **FÁCIL** | Binance P2P BRL/Pix; paybis |
| **México** | Sí | **SPEI** (transf. instant.), OXXO (efectivo) | Listado prob. | **FÁCIL** | Binance P2P MXN/SPEI; cointop100 |
| **Rep. Dominicana** | Sí (DOP en P2P) | Transf. bancaria; tPago limitado | No verif. | **MEDIA** | Binance P2P (DOP soportado) |
| **Rumanía** | Sí (UE/MiCA) | Transf. bancaria RON, **Revolut** | Listado prob. | **FÁCIL** | Binance P2P Bank Transfer RON |
| **Ucrania** | Sí (P2P robusto) | Card-to-card (Privat24/Monobank); retiros a tarjeta SUSPENDIDOS dic-2025 | No verif. | **MEDIA** (banca en guerra) | Binance/Bifinity aviso 2025 |
| **Moldavia** | Sí | Transf. bancaria MDL (MICB, etc.) | No verif. | **MEDIA** | Binance P2P MICB/MDL |
| **Serbia** | Sí (liquidez fina) | Transf. bancaria RSD, Revolut | No verif. | **MEDIA** | Binance P2P (RSD) |
| **Bulgaria** | Sí (UE) | SEPA/EUR, transf. BGN, Revolut | Listado prob. | **FÁCIL** | Revolut BG; Binance SEPA |
| **Albania** | Sí (mercado pequeño) | Transf. bancaria ALL; Revolut parcial | No verif. | **MEDIA–DIFÍCIL** | Binance P2P (ALL, liquidez baja) |
| **Macedonia del N.** | Sí (mercado pequeño) | Transf. bancaria MKD | No verif. | **MEDIA–DIFÍCIL** | Binance P2P (MKD, liquidez baja) |
| **Bosnia** | Sí (mercado pequeño) | Transf. bancaria BAM | No verif. | **MEDIA–DIFÍCIL** | Binance P2P (BAM, liquidez baja) |
| **Georgia** | Sí (hub cripto) | Bank of Georgia / TBC (GEL, USD) | No verif. | **FÁCIL–MEDIA** (AML source-of-funds) | Binance P2P BankofGeorgia; gecrypto |
| **Madagascar** | Sí | **MVola** (dominante), Orange Money | Prob. NO | **FÁCIL–MEDIA** | cryptoj.mg; Binance P2P Ariary |
| **Costa de Marfil** | Sí | **Wave**, Orange Money, MTN MoMo (XOF) | Prob. NO | **FÁCIL–MEDIA** | Binance XOF gateway; Yahoo/Binance |
| **Camerún** | Sí | **MTN MoMo**, Orange Money (XAF) | Prob. NO | **FÁCIL–MEDIA** | Binance P2P África (XAF) |
| **Senegal** | Sí | **Wave** (dominante), Orange Money (XOF) | Prob. NO | **FÁCIL–MEDIA** | Binance XOF gateway |
| **Kenia** | Sí (mercado grande) | **M-Pesa** (dominante) | Prob. NO | **FÁCIL** | Binance Blog M-Pesa; p2p KES |
| **Sudáfrica** | Sí (maduro) | Transf. bancaria ZAR (banca alta); Luno directo | Listado prob. | **FÁCIL** | Binance P2P ZAR; paybis |
| **Filipinas** | Sí (mercado grande) | **GCash / Maya** (wallets), InstaPay | Listado prob. | **FÁCIL** | Binance P2P GCash/PHP; TronNRG |
| **Reunión** | Sí (EUR / SEPA) | Banca francesa + retiro SEPA directo (sin P2P) | Prob. sí (UE) | **FÁCIL** | Binance SEPA EUR FAQ |

("Prob." = inferencia por pertenencia UE/tamaño de mercado, no confirmado en lista oficial. Ver *LO QUE NO PUDE VERIFICAR*.)

---

## Notas por región

### LATAM — el bloque más maduro para cripto→local
- **Colombia, Venezuela, Perú, México, Brasil**: mercados P2P de altísima liquidez. Vender
  USDT y recibir moneda local en minutos es rutina. LATAM mueve ~120 M USD/mes en Binance P2P.
- **Venezuela** es el caso extremo: **Pago Móvil** (transferencia interbancaria instantánea por
  teléfono+cédula) canaliza >60% de las operaciones P2P; USDT funciona como reserva de valor
  frente a la hiperinflación. El rail es trivial; el "riesgo" es macro (banca sancionada, spread
  ~18% BCV vs P2P), no técnico. Binance amplió métodos tras flexibilización OFAC.
- **Colombia**: Nequi y Daviplata (wallets de Bancolombia/Nequi) son el método P2P estrella;
  también PSE, Bancolombia y **Efecty** (retiro en efectivo en corresponsales). Uno de los
  mayores mercados P2P de la región.
- **Perú**: **Yape** y **Plin** (wallets bancarias interoperables) son el rail cotidiano; muy
  usados en P2P aunque algunas guías avisan de que los bancos vigilan patrones. Moneda PEN;
  el USD también circula.
- **Bolivia**: el Banco Central levantó la prohibición de cripto en 2024; el P2P ya funciona
  con banca y **Tigo Money**, PERO guías locales (paralelo.bo, dolar-bolivia) **desaconsejan
  Yape/Tigo Money** para P2P por riesgo de bloqueo/fraude y recomiendan trocear montos >1.000 USD.
  Mercado más pequeño y con escasez de dólares → fricción MEDIA.
- **Ecuador**: economía **dolarizada** (paga en USD, no hay riesgo cambiario), lo que simplifica
  el valor pero el mercado P2P es más fino y **no hay mobile money dominante**; cobro por banca o
  la wallet DeUna (Banco Pichincha), emergente. Fricción MEDIA por liquidez.
- **Rep. Dominicana**: DOP está entre las fiat soportadas por Binance P2P; cobro por transferencia
  bancaria. Liquidez menor que CO/VE/MX; mobile money débil (tPago) → MEDIA.

### Balcanes / Europa del Este — funciona, la variable es la liquidez
- **Rumanía y Bulgaria** (UE, bajo MiCA): lo más fácil del bloque. Transferencia local
  (RON/BGN), **Revolut** muy extendido, y en Bulgaria SEPA/EUR. Fricción FÁCIL.
- **Ucrania**: mercado cripto de los mayores del mundo y P2P muy robusto. PERO Binance
  **suspendió los retiros directos a tarjeta Visa/Mastercard el 29-dic-2025** (cese de su
  proveedor fiat Bifinity); quedan P2P y SWIFT. El card-to-card local (Privat24/Monobank) sigue
  siendo el hábito de cobro. Banca en contexto de guerra → fricción MEDIA.
- **Moldavia, Serbia**: P2P disponible (MICB/MDL, bancos serbios/RSD, Revolut en Serbia) pero
  liquidez fina; funciona, MEDIA.
- **Albania, Macedonia del Norte, Bosnia**: mercados pequeños. El par fiat existe en P2P
  (ALL/MKD/BAM) pero con **pocos anunciantes y spreads mayores**; puede requerir esperar
  contraparte o trocear. Fricción MEDIA–DIFÍCIL. Es el punto más débil del listado europeo.
- **Georgia**: **hub cripto** regional, muy favorable. Bank of Georgia y TBC aparecen como
  métodos en Binance P2P (GEL y USD). Matiz importante: los bancos **no prohíben** cripto pero
  vigilan el **origen de fondos** (AML); guías recomiendan no recibir el P2P directo de un
  desconocido en el IBAN sin guardar justificantes. Fricción FÁCIL–MEDIA por ese escrutinio.

### África — el rail es **mobile money**, y Binance ya lo integró de forma nativa
- Binance añadió pasarelas fiat para **XOF** (CFA occidental) y **XAF** (CFA central) vía
  mobile money, y da soporte P2P con **Wave, Orange Money, MTN Mobile Money, Moov Money** en
  Costa de Marfil, Camerún, Senegal y 25+ países africanos. Se compra/vende introduciendo el
  PIN de mobile money. Hubo promos de 0% comisión en Costa de Marfil y Senegal.
  - **Senegal / Costa de Marfil**: **Wave** es el mobile money dominante (comisiones bajísimas),
    con Orange Money como alternativa. Cobro cripto→Wave/OM directo y rápido.
  - **Camerún**: **MTN MoMo** y Orange Money (XAF).
- **Kenia**: **M-Pesa** es el rail. Binance publica guía oficial de comprar/vender USDT con
  M-Pesa; se vende USDT y llega KES al M-Pesa sin necesidad de cuenta bancaria. Mercado grande,
  fricción FÁCIL.
- **Madagascar**: **MVola** (dominante) y Orange Money aceptados en Binance P2P para Ariary.
  Guías locales (cryptoj.mg) describen el ciclo completo cripto→USDT→P2P→MVola en 15-30 min,
  spread 1-2%. Mercado pequeño pero rail sólido → FÁCIL–MEDIA.
- **Sudáfrica**: mercado maduro y muy bancarizado. Cobro por **transferencia bancaria ZAR**;
  además existe **Luno** (exchange local con retiro directo a banco). No hay mobile money
  dominante porque la población está bancarizada. Fricción FÁCIL.

### Asia / Otros
- **Filipinas**: mercado enorme. **GCash** y **Maya** (wallets) son el método P2P rey (instantáneo,
  hasta ~PHP 100k/tx); InstaPay/bancos (BDO, BPI, UnionBank) para montos mayores. Fricción FÁCIL.
- **Reunión**: **departamento francés de ultramar → euro e IBAN francés (FR)**. Caso más simple
  de todos: no hace falta P2P; se puede **vender USDT→EUR y retirar por SEPA** directamente en
  Binance a la cuenta bancaria local. Fricción FÁCIL. (Matiz: la FAQ SEPA de Binance lista países
  UE continentales; el IBAN de Reunión es francés y opera en SEPA, pero conviene confirmarlo por
  el estatus MiCA/registro de Binance en Francia — ver abajo.)

---

## Lecturas para la captación (implicaciones)

1. **El pago en USDT NO es un bloqueante en ninguno de los 25 países.** En todos existe rail
   cripto→local vía Binance P2P. La objeción "¿cómo cobro?" se responde igual en casi todos:
   *"te pagamos en USDT; lo vendes en Binance P2P y recibes [pago móvil/banco local] en minutos"*.
2. **Cuanto más pobre/menos bancarizado el país, MÁS natural es este rail**, no menos: en
   Venezuela, Madagascar, Senegal, Kenia o Filipinas la gente ya vive en mobile money y USDT, y
   el P2P es cotidiano. La fricción real está en los **Balcanes pequeños** (Albania, Macedonia,
   Bosnia) por liquidez fina, no en África.
3. **Mobile money = argumento de captación**: para África francófona (Wave/Orange/MTN), Kenia
   (M-Pesa), Madagascar (MVola) y Filipinas (GCash), la modelo cobra en el mismo wallet que ya
   usa a diario. Cero banca.
4. **Reunión y los UE (Rumanía, Bulgaria)** pueden saltarse el P2P entero: SEPA/EUR directo.
   Es el rail más limpio si se busca perfil "europeo".
5. **Casos con asterisco**: Ucrania (retiros a tarjeta caídos dic-2025, queda P2P), Georgia
   (AML source-of-funds), Bolivia (guías desaconsejan Yape/Tigo, escasez de USD), Venezuela
   (riesgo macro y bancario, no técnico).

---

## LO QUE NO PUDE VERIFICAR

- **Cobertura oficial de Paxum por país.** La URL oficial `paxum.com/legal/country-list/` (y su
  espejo `paxumbank.com`) devuelve en realidad un **directorio de oficinas de protección de datos**,
  no una lista de servicio; no es señal fiable. Las marcas "Listado prob." (Colombia, Perú, Brasil,
  México, Rumanía, Bulgaria, Sudáfrica, Filipinas) salen de que aparecen en ese directorio, lo cual
  **no confirma que Paxum opere allí**. "Prob. NO" en Venezuela y África subsahariana es inferencia
  por sanciones/cobertura histórica, no dato duro. **Recomendación:** si Paxum importa, pedir a
  Paxum la lista de países soportados por soporte, o registrar una cuenta de prueba. De todos modos,
  el enunciado del encargo ya asume Paxum como vía limitada; el rail principal es cripto→P2P.
- **Liquidez P2P exacta** (nº de anunciantes, spread real) por país: verificado cualitativamente
  (alto en LATAM/Filipinas/Kenia; fino en Balcanes pequeños) pero **no cuantificado**. Para un dato
  duro habría que abrir `p2p.binance.com` por par fiat y contar ofertas — no lo hice por país.
- **Reunión + SEPA/MiCA**: el IBAN francés opera en SEPA, pero **no confirmé** que Binance habilite
  explícitamente cuentas de Reunión bajo su registro francés post-MiCA; podría haber matiz de KYC
  por región. Requiere confirmación directa con Binance.
- **Ecuador y Rep. Dominicana**: confirmé que la fiat está soportada, pero **no abrí anuncios** para
  medir liquidez; la clasificación MEDIA es por reputación de mercado, no por conteo.
- **Bolivia, Serbia, Moldavia, Albania, Macedonia, Bosnia**: mercados pequeños; el par existe pero
  **no verifiqué profundidad de libro** ni tiempos reales de emparejamiento.
- No verifiqué **límites legales/fiscales** de recibir cripto por país (declaración, tope de
  mobile money, KYC del wallet). Fuera del alcance de A3 (rail técnico), pero relevante para
  compliance/onboarding.

### Fuentes principales (abiertas o citadas)
- Binance P2P (páginas de par fiat): COP/Nequi, KES/M-PESA, GEL/Bank of Georgia, PHP/GCash,
  MDL/MICB, RON/Bank Transfer, ZAR, DOP.
- Binance Support/Blog: guía M-Pesa Kenia; pasarela fiat XOF vía mobile money; nuevos métodos
  África (Wave, Orange Money, MTN, Moov, Tigo); FAQ SEPA EUR.
- Aviso Binance/Bifinity: suspensión retiros a tarjeta Ucrania (dic-2025).
- Yahoo Finanzas: ampliación métodos Venezuela tras OFAC.
- Guías locales: usdt.com.ve (Pago Móvil VE), paralelo.bo y dolar-bolivia.com (Bolivia),
  cryptoj.mg (Madagascar MVola/OM), TronNRG (Filipinas GCash), gecrypto.com (Georgia AML),
  paybis (exchanges LATAM Pix/SPEI), Wise (retiro Binance Colombia).
