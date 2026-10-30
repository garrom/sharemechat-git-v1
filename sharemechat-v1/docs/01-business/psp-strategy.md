# Estrategia de pagos

> Actualizado 2026-08-15. Clasificación adult/streaming: [ADR-028](../06-decisions/adr-028-business-classification-adult-streaming.md).
> Este documento recoge **solo lo decidido**. Las vías descartadas y sus razones viven en [pagos-descartados.md](pagos-descartados.md).

## COBRO — cómo entra el dinero del cliente

### Aceptado

- **CardBilling (grupo Verotel)** — adquirente **directo** de tarjeta Visa/Mastercard. Revisó nuestra estructura (OÜ estonia operada en remoto desde España, director y titular real residente en España, contacto local + oficina virtual en Estonia vía Companio) y la declaró *"aceptable y dentro de su ámbito de riesgo"*: **no le afecta el requisito de residencia que descartó a Segpay**. Onboarding **en pausa por decisión del operador** (jul-2026). Para reactivar: pagar 1.000 $ (500 cuota anual + 500 preautorización, **reembolsables** si se detiene) → cuenta en modo preautorizado → revisión de la web por las redes de tarjeta → firma del contrato → integrar su API **FlexPay** en modo prueba → salida en vivo. El cobro se **liquida a diario en una cuenta Yoursafe Business** (obligatorio con ellos). Cubre el ~80% previsto del cobro. **⚠️ 2026-10-23: el operador descarta reactivar CardBilling** — rechaza pagar la cuota/preautorización ($1.000) ANTES de la revisión final de la web por las redes de tarjeta: si en esa revisión le rechazan, se queda sin PSP y con el dinero pendiente de reembolso. Se buscan alternativas que aprueben al comercio ANTES de cualquier cobro (ver *En evaluación* abajo).

- **NOWPayments** — cripto puente custodial, **vivo en PROD desde 2026-07-17**. El cliente paga en BTC/USDT/USDC y nosotros recibimos euros. Cubre el ~20% del cobro. Detalle técnico en [ADR-051](../06-decisions/adr-051-psp-puente-cripto-nowpayments.md).

### No apto

Segpay, CCBill, QuadraPay, EMS, PayFirmly, MerchantScout, FirmEU, Panda Blue (D24) — descartados o en reserva por distintas razones. Detalle cerrado en [pagos-descartados.md](pagos-descartados.md). **No se persiguen mientras CardBilling siga vivo.** (Panda Blue/D24 solo cobraría tarjetas LATAM; en reserva como complemento LATAM, nunca como solución única para audiencia mundial.)

### En evaluación (2026-10-23) — alternativa a CardBilling

Tras descartar reactivar CardBilling, se buscan PSP de tarjeta adult que **aprueben al comercio y revisen la web ANTES de cualquier cobro** (sin dinero en riesgo), con tarjeta **mundial**, que acepten **pre-lanzamiento sin historial** y la estructura **OÜ estonia + titular residente en España** (el muro que tumbó a Segpay). **Verdad del mercado:** el underwriting/revisión previa es universal (no es el problema); el único coste inevitable en adult es el **registro de redes (Visa VIRP ~$950 + Mastercard ~$500/año)** por el MCC adult — lo evitable es pagarlo *antes* de la aprobación. Candidatos por contactar (DD completa en memoria de Claude):

1. **Vendo Services** (PayFac suizo, licencia PI) — aprobación primero; trabaja con adquirentes europeos si la empresa es de la UE (la OÜ lo es); tarjeta mundial; acepta startups; el registro de redes (~1.450 €/año) **se deduce del payout, NO se paga por adelantado** = mejor encaje con "sin dinero en riesgo". Sin Amex en adult. Reserva rolling 6 meses.
2. **Epoch** (IPSP/merchant-of-record) — operas bajo su cuenta, no necesitas adquirente propio (un solo sí/no lo resuelve todo); tarjeta mundial; acepta pre-lanzamiento; admite entidad UE con principal residente en "región europea" → OÜ+España encaja. Confirmar si el registro (~$1.950) se cobra antes/después de la aprobación y si es reembolsable. Rate inicial alto (~15% a bajo volumen, baja por tramos).
3. **CommerceGate** (Barcelona) — mejor encaje jurisdiccional con titular en España; underwriting-first; *aggregate account* para pre-lanzamiento; **opaco en precios** → exigir fee schedule y secuencia de alta por escrito.

Descartar/cautela: **MobiusPay** (su ruta UE podría exigir director residente en Estonia = muro Segpay; contrato 3 años), **Centrobill** (reputación de billing negativa, facturación vía Chipre), **NETbilling/RocketGate** (solo gateways, necesitan un adquirente adult detrás), **Corepay/PaymentCloud/EasyPayDirect/Instabill** (revendedores/brókers, modelo ya descartado).

## PAGO (payout) — cómo sale el dinero a las modelos

### Aceptado

- **Cosmo Payment** — paga a la modelo por **transferencia a su banco local en su moneda** (pesos en Colombia) o tarjeta de débito Cosmo, **sin cripto** (evita la fricción de que la modelo gestione monederos). Adult-friendly. Entidad: **CP Solutions Ltd (Isla de Man)** sobre **Paysafe**, entidad de dinero electrónico regulada por la **FCA** británica (FRN 900015). Antes de firmar, confirmar con cuál de sus entidades se contrata (hay varios dominios/entidades con nombre casi idéntico).

### No apto

Paxum, Yoursafe, NOWPayments-cripto, Wise — descartados o de uso limitado por distintas razones. Detalle cerrado en [pagos-descartados.md](pagos-descartados.md).
