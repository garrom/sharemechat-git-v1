# Pagos — vías descartadas

> Cerrado. Recoge **por qué NO se usa** cada vía, para no reabrirlas ni reestudiarlas.
> Lo aceptado y vigente vive en [psp-strategy.md](psp-strategy.md).
> Correspondencia y documentos crudos (fuera del repo): carpeta `FINANCIERO/PSP-CARDBILLING` del operador.

## COBRO — descartados

- **Segpay** — exige que el director/titular real resida en el país de constitución (Estonia); el operador vive en España. Requisito inmovible del vendor. Cerrado 2026-07-18.
- **CCBill** — mantuvo conversaciones iniciales y **dejó de responder**. Mudo. Reactivable solo si vuelve, pero no se persigue.
- **QuadraPay** — **es agencia/bróker**, no banco. Declinó "por ahora": pide 3-6 meses de historial de cobros que aún no existe (pre-lanzamiento).
- **EMS** (European Merchant Services) — **es bróker, no banco**; solo coloca con un adquirente ajeno. CardBilling (directo) ya nos aceptó, así que no aporta. En reserva.
- **PayFirmly / MerchantScout / FirmEU** — orquestador/agencias **no contactados**. Reserva solo si CardBilling cae. No contactar mientras CardBilling siga vivo.
- **Panda Blue (motor D24 / Directa24, grupo AstroPay)** — procesador **adult de mercados emergentes**. Hace adquirencia de tarjeta **solo LATAM / África / Asia** (local acquiring + métodos locales PIX/PSE/Nequi/SPEI); **NO cobra tarjetas emitidas en Europa ni USA** — no es fallo, es su nicho: cubre lo que Stripe/Adyen/CardBilling no sirven bien, y no compite en EU/USA. SÍ ofrece *payin* a plataforma nueva (producto Deposits; alta por comercial, go-live por revisión de transacciones de prueba; Colombia confirmado), sin kickoff tipo CardBilling. **Veredicto: NO apto como solución única para audiencia mundial** (el grueso EU/USA lo cubre CardBilling); **en reserva como COMPLEMENTO LATAM** sobre CardBilling solo si el volumen de pago LATAM lo justifica. Investigado a fondo 2026-10-23 (DD en memoria de Claude).

## PAGO (payout) — descartados

- **Paxum** — líder histórico del sector pero **riesgo regulatorio/reputacional** (banco en Dominica, prensa negativa, quejas de retención de fondos). En reserva, nunca como cuenta única.
- **Yoursafe** — cobertura LATAM débil; válido para modelos de la UE, no para Colombia. (Aun así entra en el circuito porque CardBilling liquida ahí el cobro de tarjeta.)
- **NOWPayments cripto** — la modelo tendría que gestionar monedero y casa de cambio: **fricción real**, muchas lo rechazan. Sirve para cobrar del cliente, no para pagar a la modelo.
- **Wise** — **prohíbe expresamente el negocio adult** en sus condiciones. Queda **solo para gastos de la empresa** (AWS, internet, asesoría), nunca para dinero de la actividad.
