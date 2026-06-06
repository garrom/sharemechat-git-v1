# ADR-031: Country gating go-live PROD — listas finales cliente (28) y modelo (46)

## Estado

Aprobada. Cierra la "decisión operativa pendiente" declarada en
[geographic-strategy.md](../01-business/geographic-strategy.md) y refina la
"decisión de implementación" registrada como cerrada el 2026-05-27 en
[known-debt.md](../04-operations/known-debt.md) (entrada *Country Access —
migración de blocklist random a allowlist por flujo (cliente vs modelo) +
bypass por IP para PSPs*).

Aplicable al go-live PROD (PRELAUNCH armado y, posteriormente, OPEN). NO
modifica el mecanismo definido en
[ADR-007](adr-007-country-blacklist-phase1-backend-primary.md) — solo cierra
qué países concretos componen las listas vigentes al activar el frente en
PROD.

## Contexto

A 2026-06-06 hay dos posturas documentales sobre qué países sirve SharemeChat:

1. La **postura estratégica** descrita en `geographic-strategy.md` define un
   beachhead anglosfera de 6 países (UK, IE, CA, AU, NZ, US) como primera
   oleada de mercados servidos, justificado por:
   - Régimen regulatorio explícito y entendido (UK OSA, US FSC v Paxton, AU
     OSA, EU DSA art. 28 en IE).
   - i18n EN cubre el universo lingüístico sin trabajo adicional.
   - Cobertura conocida de Veriff (ADR-029) y disciplina de chargebacks.
   - Audiencia donde la adquisición orgánica realista (X, Reddit, SEO blog
     SFW) es eficiente.

   Pero el mismo documento declara textualmente "la lista concreta de países
   servidos en el beachhead es decisión operativa pendiente; se cerrará junto
   con el ADR futuro de country-gating real".

2. La **decisión de implementación** del 2026-05-27 (`known-debt.md`, commit
   `639c4f8 feat(country-access): redesign to dual allowlist (client/model)
   with PSP bypass IPs`) cableó:
   - 28 países en `client-registration` (anglosfera + Europa occidental +
     LatAm hispano/portugués con poder adquisitivo).
   - 51 países en `model-registration` (superconjunto: los 28 + LatAm
     Andes/Brasil/Centro + Europa Este UE + Báltico + UA + RU + CU + VE +
     NI).
   - Bypass `90.175.201.51/32` (IP del operador), con coordinación PSP
     pendiente.

   Esta implementación coexistía como decisión operativa pero sin ADR formal
   que la respaldase; el frente quedó desactivado en AUDIT/TEST tras el
   incidente Segpay del 2026-05-29 (`COUNTRY_ACCESS_ENABLED=false` + nota
   crítica de reactivación documentada en `known-debt.md`).

El frente PROD coming-soon (modo PRELAUNCH armado en
[ADR-009](adr-009-product-operational-mode.md)) requiere cerrar la decisión
de listas antes de activar `COUNTRY_ACCESS_ENABLED=true` en
`/opt/sharemechat/config.env` de PROD. Este ADR cierra esa decisión.

## Decisión

### Listas finales para PROD

**Cliente — 28 países** (sin cambios respecto a la implementación 2026-05-27):

```
GB, IE, CA, AU, NZ, US,
DE, AT, CH,
ES, PT, FR, IT,
NL, BE, LU,
SE, DK, FI, NO,
AR, CL, UY, MX, CR, PA, DO, PR
```

**Modelo — 46 países** (los 28 de cliente + 18 adicionales; equivale a los
51 de AUDIT MENOS 5 quitados por riesgo: RU, CU, VE, NI, UA):

```
[los 28 de cliente]
+
CO, PE, BO, EC, PY, BR,
GT, HN, SV,
RO, PL, HU, CZ, SK, BG,
LT, LV, EE
```

### Configuración técnica

En `/opt/sharemechat/config.env` de PROD:

```
COUNTRY_ACCESS_ENABLED=true
COUNTRY_ACCESS_BLOCK_WHEN_MISSING=true
COUNTRY_ACCESS_CLIENT_REGISTRATION_ALLOWED_COUNTRIES=GB,IE,CA,AU,NZ,US,DE,AT,CH,ES,PT,FR,IT,NL,BE,LU,SE,DK,FI,NO,AR,CL,UY,MX,CR,PA,DO,PR
COUNTRY_ACCESS_MODEL_REGISTRATION_ALLOWED_COUNTRIES=GB,IE,CA,AU,NZ,US,DE,AT,CH,ES,PT,FR,IT,NL,BE,LU,SE,DK,FI,NO,AR,CL,UY,MX,CR,PA,DO,PR,CO,PE,BO,EC,PY,BR,GT,HN,SV,RO,PL,HU,CZ,SK,BG,LT,LV,EE
COUNTRY_ACCESS_BYPASS_IPS=90.175.201.51/32
```

- `ENABLED=true`: frente armado en PROD desde el coming-soon.
- `BLOCK_WHEN_MISSING=true`: modo seguro (deny si el header
  `CloudFront-Viewer-Country` no resuelve). Coherente con la decisión
  original del frente; lo correcto para PROD productivo (a diferencia del
  `false` defensivo aplicado a AUDIT tras el incidente Segpay).
- `BYPASS_IPS`: replica la IP del operador documentada en AUDIT. Las IPs de
  PSPs (Segpay, futuros) quedan como deuda pendiente de coordinación —
  registrada en riesgos abiertos.

## Razonamiento

### Cliente — por qué los 28

Los 28 países cubren el universo realista de demanda comercial **inmediata**
del coming-soon:

- **Anglosfera (6)**: GB, IE, CA, AU, NZ, US. Beachhead estratégico
  documentado en `geographic-strategy.md`. i18n EN del producto cubre sin
  localización. Régimen regulatorio explícito (UK OSA, US FSC v Paxton, AU
  OSA, EU DSA art. 28 en IE). En US el código no desglosa estados; la
  decisión sobre qué estados servir queda como deuda fuera del scope de este
  ADR (depende del *Free Speech Coalition v. Paxton* aplicado caso por caso
  por ley estatal — el `country.access` resuelve a nivel país y deja la
  granularidad estatal a una capa futura).
- **Continental UE Oeste (12)**: DE, AT, CH, ES, PT, FR, IT, NL, BE, LU, SE,
  DK, FI, NO. Poder adquisitivo medio-alto, jurisdicciones DSA art. 28
  o equivalentes (CH/NO no UE pero régimen armonizado). i18n ES + EN cubre
  parcialmente (DE, FR, NL, nórdicos quedan en EN durante coming-soon;
  localización completa pendiente como oleada 2).
- **LatAm hispano-portugués con poder adquisitivo (10)**: AR, CL, UY, MX,
  CR, PA, DO, PR, BR... Actually BR no está en cliente (está solo en
  modelo). Las 10 son: AR, CL, UY, MX, CR, PA, DO, PR — Cono Sur estable
  (AR, CL, UY) + México + Centro hispanohablante + Caribe hispanohablante
  + Puerto Rico (US dependency). i18n ES cubre. Régimen consumo adult menos
  endurecido que UE/UK pero PSP Segpay cubre.

Mantener los 28 (en lugar de recortar a los 6 anglosfera del beachhead
estricto) tiene coste casi nulo en coming-soon: el cuerpo de compliance es
prácticamente fijo una vez construido (ADR-028), y abrir el universo en
PRELAUNCH permite captar señal de demanda real desde más mercados antes del
go-live OPEN. La disciplina de chargebacks que `geographic-strategy.md` cita
como criterio nuclear queda preservada porque el coming-soon no tiene
transacciones reales (solo registro + verificación + cola de espera).

### Modelo — por qué 46 (no 51) y por qué superconjunto del cliente

**El conjunto superconjunto** es la decisión arquitectónica del frente
original: oferta (modelo) y consumo (cliente) son flujos legalmente
distintos. Un modelo es un streamer contratado, no un consumidor de
contenido adult; el régimen aplicable es laboral/contractual + KYC + payout,
no las leyes de consumo adult (US FSC, UK OSA, etc.). Eso permite extender
la lista modelo a regiones de alto stock de streamers que no entran en la
lista cliente.

**Los 18 model-only añadidos** son:

- **LatAm Andes/Brasil/Centro (6)**: CO, PE, BO, EC, PY, BR. Stock relevante
  de streamers de habla hispana/portuguesa. Régimen laboral viable y PSP
  Segpay cubre payouts.
- **Centroamérica norte (3)**: GT, HN, SV. Stock menor pero presente.
  Régimen viable.
- **Europa Este UE (6)**: RO, PL, HU, CZ, SK, BG. Estados miembros UE,
  régimen GDPR + Veriff funcionando, stock históricamente alto de streamers.
- **Báltico (3)**: LT, LV, EE. Estados miembros UE, régimen estable, stock
  menor pero presente.

**Los 5 países excluidos respecto a la implementación 2026-05-27** (51 → 46):

- **RU (Rusia)**: sanciones US OFAC + UE sectoriales. PSP Segpay sin
  cobertura realista para payouts a entidades/bancos rusos. Exclusión
  operativa firme.
- **CU (Cuba)**: sanciones US OFAC vigentes. Segpay sin cobertura. Misma
  lógica que RU.
- **VE (Venezuela)**: sanciones US OFAC parciales sobre PDVSA + entidades.
  Segpay puede tener cobertura pero el riesgo de payout no resuelto.
  Re-incorporable si Segpay confirma viabilidad operativa.
- **NI (Nicaragua)**: situación política/sanciones más laxas que VE pero
  inestabilidad operativa + bajo stock potencial. Coste/beneficio negativo
  en coming-soon. Re-incorporable.
- **UA (Ucrania)**: **no es exclusión legal — es operativa**. Conflicto
  activo introduce inestabilidad en KYC, en disponibilidad de la población
  como streamers viables, y en payouts. Re-incorporable cuando la situación
  estabilice o cuando Segpay confirme operativa.

La exclusión NI/UA/VE es operativa y revisable. RU/CU son exclusiones más
firmes por régimen de sanciones.

### Disciplina del modo seguro (`BLOCK_WHEN_MISSING=true`)

Si CloudFront no envía el header `CloudFront-Viewer-Country` (por ejemplo,
si la behavior `/api/*` no propaga el header correctamente, como ocurrió en
el incidente Segpay 2026-05-28 con el ORP `f11445e9`), el gate cierra.
**Es preferible cerrar un usuario legítimo que abrir uno no autorizado** en
un coming-soon con compliance entrando en producción. El bypass por IP del
operador y de Segpay (cuando se coordine) atienden el caso operativo
controlado.

## Riesgos abiertos

### 1. Legalidad del trabajo adult por país (modelos) — fase OPEN

Los 18 países model-only no han sido auditados uno por uno respecto a si
permiten contratar streamers para contenido adult de forma legalmente
viable. El régimen laboral varía:

- LatAm Andes/Brasil: legal en su mayoría con régimen civil.
- Centroamérica norte: regulación menos clara, posible riesgo penal en
  algunos casos.
- Europa Este UE: legal en su mayoría, GDPR cubre.
- Báltico: legal, régimen estable.

**Acción**: auditoría país a país pendiente para la fase OPEN. En el
coming-soon (PRELAUNCH) los modelos no operan (solo se registran y entran a
cola), por lo que el riesgo es contenido. Cuando se active OPEN, esta
auditoría debe estar cerrada o el modelo no se aprueba.

### 2. Reconciliar IPs bypass con Segpay

`BYPASS_IPS=90.175.201.51/32` cubre la IP del operador. Segpay (Patricia)
tiene equipo distribuido (UK, Europa varios, US, banco) con **IPs
volátiles**, según lo documentado en el incidente del 2026-05-29.

**Acción**: coordinar con Segpay para obtener un rango CIDR estable o un
mecanismo alternativo (allowlist por header de origen, header firmado, etc.)
antes de que Segpay necesite acceder al producto PROD. Hasta entonces, la
única vía es deshabilitar temporalmente el gate (lo que se hizo en AUDIT) o
añadir IPs puntuales reactivamente. La deuda está documentada en
`known-debt.md` desde 2026-05-29.

### 3. Reconsiderar UA / VE cuando Segpay confirme payouts

UA y VE quedan fuera por viabilidad operativa, no por bloqueo legal firme.
Si Segpay confirma cobertura de payouts a uno de ellos (o ambos), la
exclusión es revisable mediante adición a la lista modelo sin cambiar el
ADR (el cambio se documentará como rev menor del ADR o como entrada en
`known-debt.md`).

### 4. Alinear AUDIT con estas 46 (deuda baja prioridad)

AUDIT tiene en `config.env` la lista modelo de 51 países (con RU, CU, VE,
NI, UA todavía dentro). El frente está desactivado en AUDIT
(`ENABLED=false`) desde el incidente Segpay, por lo que el desalineamiento
no tiene efecto operativo hoy. Cuando AUDIT vuelva a `ENABLED=true` (post
onboarding PSP), conviene actualizar también su lista modelo a estas 46
para mantener paridad con PROD.

**Acción**: añadir entrada a `known-debt.md` recordando el alineamiento
AUDIT modelo cuando se reactive el gate ahí.

### 5. US state-by-state granularity

El frente actual resuelve a nivel país; no desglosa estados US. Tras *Free
Speech Coalition v. Paxton*, varios estados US tienen leyes de age
verification que obligarían a tratarlos caso por caso. Este ADR servir US
*entero* en el coming-soon delega la granularidad estatal a:

- Veriff (ADR-029) cubriendo la verificación a nivel federal.
- Capa adicional futura si llegan a haber estados US donde el age
  assurance no sea viable (potencial uso de IP geolocation a nivel estado).

En coming-soon esto no es bloqueante porque el producto está cerrado
(PRELAUNCH); cuando se active OPEN debe haber decisión sobre estados US.

## Reconciliación con AUDIT y TEST

| Entorno | `ENABLED` | Cliente | Modelo | Acción |
|---|---|---|---|---|
| **PROD** (este ADR) | `true` | 28 (lista de este ADR) | 46 (lista de este ADR) | Aplicar líneas exactas en `config.env` |
| **AUDIT** (vivo) | `false` | 28 (igual al de este ADR) | 51 (5 países de más) | Mantener desactivado mientras dure onboarding PSP. Al reactivar: alinear modelo a las 46 de este ADR + decidir `BLOCK_WHEN_MISSING` |
| **TEST** (vivo) | `false` | sin listas (vacías) | sin listas (vacías) | Sin cambios: TEST no opera con country gate |

## Configuración técnica final (para deploy PROD)

Líneas exactas a añadir/modificar en `/opt/sharemechat/config.env` de PROD,
respetando el orden alfabético del bloque:

```
# Country access (frente country-access dual allowlist - commit 639c4f8 +
# decisión cerrada por ADR-031: 28 cliente / 46 modelo / bypass operador).
# RU, CU, VE, NI, UA excluidos de modelo respecto a la implementación
# 2026-05-27 original (51) por sanciones (RU/CU) o riesgo operativo
# (VE/NI/UA). Reincorporables si Segpay confirma cobertura.
COUNTRY_ACCESS_ENABLED=true
COUNTRY_ACCESS_BLOCK_WHEN_MISSING=true
COUNTRY_ACCESS_CLIENT_REGISTRATION_ALLOWED_COUNTRIES=GB,IE,CA,AU,NZ,US,DE,AT,CH,ES,PT,FR,IT,NL,BE,LU,SE,DK,FI,NO,AR,CL,UY,MX,CR,PA,DO,PR
COUNTRY_ACCESS_MODEL_REGISTRATION_ALLOWED_COUNTRIES=GB,IE,CA,AU,NZ,US,DE,AT,CH,ES,PT,FR,IT,NL,BE,LU,SE,DK,FI,NO,AR,CL,UY,MX,CR,PA,DO,PR,CO,PE,BO,EC,PY,BR,GT,HN,SV,RO,PL,HU,CZ,SK,BG,LT,LV,EE
COUNTRY_ACCESS_BYPASS_IPS=90.175.201.51/32
```

**Conteo confirmado**:
- Cliente: 6 (anglosfera) + 3 (DACH) + 4 (Europa romance) + 3 (Benelux) + 4
  (nórdicos) + 3 (LatAm cono sur) + 5 (México + Caribe + Centro) = **28**.
- Modelo: 28 (cliente) + 6 (LatAm Andes/Brasil) + 3 (Centroamérica norte) +
  6 (Europa Este UE) + 3 (Báltico) = **46**.

## Referencias

- [ADR-007](adr-007-country-blacklist-phase1-backend-primary.md) — mecanismo
  técnico de bloqueo por país (sin cambios en este ADR; solo se refina el
  conjunto de países).
- [ADR-009](adr-009-product-operational-mode.md) — modo operativo PRELAUNCH
  bajo el que se arma el coming-soon.
- [ADR-028](adr-028-business-classification-adult-streaming.md) —
  clasificación adult/streaming que condiciona el régimen aplicable.
- [ADR-029](adr-029-age-and-identity-verification-architecture.md) —
  arquitectura Veriff que cubre la verificación de edad e identidad.
- [geographic-strategy.md](../01-business/geographic-strategy.md) —
  estrategia de mercados servidos (este ADR cierra la frase "decisión
  operativa pendiente" de ese documento).
- [compliance-scope.md](../01-business/compliance-scope.md) — marco de
  compliance adult/streaming.
- [psp-strategy.md](../01-business/psp-strategy.md) — estrategia PSP
  (Segpay) que condiciona las exclusiones RU/CU/VE.
- [known-debt.md](../04-operations/known-debt.md) — entrada CERRADA
  2026-05-27 sobre la implementación inicial 28/51, entrada 2026-05-29
  sobre el incidente Segpay, y entrada nueva (pendiente, derivada de este
  ADR) sobre alineamiento de AUDIT a las 46 modelo.
