# Estrategia de pagos

> Actualizado 2026-08-15. Clasificación adult/streaming: [ADR-028](../06-decisions/adr-028-business-classification-adult-streaming.md).
> Este documento recoge **solo lo decidido**. Las vías descartadas y sus razones viven en [pagos-descartados.md](pagos-descartados.md).

## COBRO — cómo entra el dinero del cliente

### Aceptado

- **CardBilling (grupo Verotel)** — adquirente **directo** de tarjeta Visa/Mastercard. Revisó nuestra estructura (OÜ estonia operada en remoto desde España, director y titular real residente en España, contacto local + oficina virtual en Estonia vía Companio) y la declaró *"aceptable y dentro de su ámbito de riesgo"*: **no le afecta el requisito de residencia que descartó a Segpay**. Onboarding **en pausa por decisión del operador** (jul-2026). Para reactivar: pagar 1.000 $ (500 cuota anual + 500 preautorización, **reembolsables** si se detiene) → cuenta en modo preautorizado → revisión de la web por las redes de tarjeta → firma del contrato → integrar su API **FlexPay** en modo prueba → salida en vivo. El cobro se **liquida a diario en una cuenta Yoursafe Business** (obligatorio con ellos). Cubre el ~80% previsto del cobro.

- **NOWPayments** — cripto puente custodial, **vivo en PROD desde 2026-07-17**. El cliente paga en BTC/USDT/USDC y nosotros recibimos euros. Cubre el ~20% del cobro. Detalle técnico en [ADR-051](../06-decisions/adr-051-psp-puente-cripto-nowpayments.md).

### No apto

Segpay, CCBill, QuadraPay, EMS, PayFirmly, MerchantScout, FirmEU — descartados o en reserva por distintas razones. Detalle cerrado en [pagos-descartados.md](pagos-descartados.md). **No se persiguen mientras CardBilling siga vivo.**

## PAGO (payout) — cómo sale el dinero a las modelos

### Aceptado

- **Cosmo Payment** — paga a la modelo por **transferencia a su banco local en su moneda** (pesos en Colombia) o tarjeta de débito Cosmo, **sin cripto** (evita la fricción de que la modelo gestione monederos). Adult-friendly. Entidad: **CP Solutions Ltd (Isla de Man)** sobre **Paysafe**, entidad de dinero electrónico regulada por la **FCA** británica (FRN 900015). Antes de firmar, confirmar con cuál de sus entidades se contrata (hay varios dominios/entidades con nombre casi idéntico).

### No apto

Paxum, Yoursafe, NOWPayments-cripto, Wise — descartados o de uso limitado por distintas razones. Detalle cerrado en [pagos-descartados.md](pagos-descartados.md).
