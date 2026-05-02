package com.sharemechat.service;

import com.sharemechat.config.BillingProperties;
import com.sharemechat.dto.CcbillInitResponseDTO;
import com.sharemechat.entity.PaymentSession;
import com.sharemechat.entity.User;
import com.sharemechat.repository.PaymentSessionRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class CcbillService {

    private final PaymentSessionRepository paymentSessionRepository;
    private final TransactionService transactionService;
    private final BillingProperties billing;

    public CcbillService(PaymentSessionRepository paymentSessionRepository,
                         TransactionService transactionService,
                         BillingProperties billing) {
        this.paymentSessionRepository = paymentSessionRepository;
        this.transactionService = transactionService;
        this.billing = billing;
    }

    /**
     * Catálogo BFPM Fase 4A (ADR-011 + ADR-012):
     *  - priceEur: importe efectivamente cobrado al cliente (lo que viaja al PSP).
     *  - minutesGranted: minutos de servicio que recibe el cliente.
     *
     * El bonus en EUR se deriva al ejecutar la compra:
     *   bonusEur = (minutesGranted * billing.rate-per-minute) - priceEur
     */
    private record Pack(String packId, BigDecimal priceEur, BigDecimal minutesGranted) {
    }

    /**
     * Crea una PaymentSession para un pack y devuelve los datos necesarios
     * para redirigir al usuario a CCBill (URL + campos POST).
     *
     * De momento:
     *  - currency fija en "EUR"
     *  - URL sandbox provisional
     *  - clientAccnum / clientSubacc / formName provisionales
     */
    @Transactional
    public CcbillInitResponseDTO createSessionForPack(User user, String packId, boolean firstPayment) {
        // 1) Resolver pack (importe + minutos concedidos)
        Pack pack = resolvePack(packId);

        // 2) Crear PaymentSession en BBDD
        PaymentSession session = new PaymentSession();
        session.setUser(user);
        session.setPackId(pack.packId());
        session.setAmount(pack.priceEur());
        session.setCurrency("EUR");
        session.setFirstPayment(firstPayment);
        session.setStatus("PENDING");
        session.setOrderId(UUID.randomUUID().toString());

        paymentSessionRepository.save(session);

        // 3) Construir respuesta para el frontend
        CcbillInitResponseDTO dto = new CcbillInitResponseDTO();
        dto.setPaymentUrl("https://sandbox.ccbill.com/jpost/signup.cgi"); // se ajustará cuando tengas datos reales
        dto.setMethod("POST");

        Map<String, String> fields = new HashMap<>();
        // Campos provisionales; se ajustarán con la documentación oficial de CCBill
        fields.put("clientAccnum", "0000000");
        fields.put("clientSubacc", "0000");
        fields.put("formName", "testForm");
        fields.put("currencyCode", "978");                         // 978 = EUR
        fields.put("amount", pack.priceEur().toPlainString());     // "10.00", "20.00", "40.00"
        fields.put("orderId", session.getOrderId());               // identificador único nuestro
        fields.put("email", user.getEmail());                      // opcional

        dto.setFields(fields);

        return dto;
    }

    /**
     * Procesa la notificación de la pasarela:
     *  - Busca la PaymentSession por orderId.
     *  - Si ya no está en PENDING, no hace nada (idempotente).
     *  - Si el pago está aprobado, registra la recarga (con bonus si procede) vía
     *    TransactionService.creditPackWithBonus.
     *  - Actualiza status y pspTransactionId.
     */
    @Transactional
    public void completeSession(String orderId, String pspTransactionId, boolean approved) {
        PaymentSession session = paymentSessionRepository.findByOrderId(orderId)
                .orElseThrow(() -> new IllegalArgumentException("PaymentSession no encontrada para orderId=" + orderId));

        // Si ya fue procesada (SUCCESS o FAILED), no repetir nada
        if (!"PENDING".equalsIgnoreCase(session.getStatus())) {
            return;
        }

        // Guardar pspTransactionId (protección adicional con UNIQUE)
        if (pspTransactionId != null && !pspTransactionId.isBlank()) {
            try {
                session.setPspTransactionId(pspTransactionId);
                // flush más tarde con el save() del final
            } catch (DataIntegrityViolationException e) {
                // En escenarios normales no debería ocurrir; si ocurre, registras log y sales
                throw e;
            }
        }

        if (!approved) {
            session.setStatus("FAILED");
            paymentSessionRepository.save(session);
            return;
        }

        // === Pago aprobado ===
        User user = session.getUser();

        // BFPM (ADR-012): resolver catálogo y calcular bonus en el momento del cierre.
        // No se persiste minutesGranted ni bonusEur en payment_sessions (sin cambio de schema).
        Pack pack = resolvePack(session.getPackId());
        BigDecimal bonusEur = computeBonusEur(pack);

        transactionService.creditPackWithBonus(
                user.getId(),
                pack.priceEur(),
                bonusEur,
                session.getOrderId(),
                pack.packId(),
                session.isFirstPayment()
        );

        session.setStatus("SUCCESS");
        paymentSessionRepository.save(session);
    }

    /**
     * Catálogo vigente (ADR-011 / Fase 3A) extendido con minutesGranted (BFPM Fase 4A).
     * Mantiene match exacto por packId. Rechaza el catálogo legacy.
     */
    private Pack resolvePack(String packId) {
        if ("P10".equalsIgnoreCase(packId)) {
            return new Pack("P10", new BigDecimal("10.00"), new BigDecimal("10"));
        }
        if ("P20".equalsIgnoreCase(packId)) {
            return new Pack("P20", new BigDecimal("20.00"), new BigDecimal("22"));
        }
        if ("P40".equalsIgnoreCase(packId)) {
            return new Pack("P40", new BigDecimal("40.00"), new BigDecimal("44"));
        }
        throw new IllegalArgumentException("PackId no soportado: " + packId);
    }

    /**
     * bonusEur = (minutesGranted * ratePerMinute) - priceEur
     * Escala 2, HALF_UP. Garantiza >= 0; si el cálculo da negativo, lanza IllegalStateException
     * (catálogo inconsistente respecto a la tarifa configurada).
     */
    private BigDecimal computeBonusEur(Pack pack) {
        BigDecimal rate = billing.getRatePerMinute();
        if (rate == null) {
            throw new IllegalStateException("billing.rate-per-minute no configurado");
        }
        BigDecimal expectedEur = pack.minutesGranted().multiply(rate);
        BigDecimal bonus = expectedEur.subtract(pack.priceEur()).setScale(2, RoundingMode.HALF_UP);
        if (bonus.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalStateException(
                    "Catálogo inconsistente: bonusEur < 0 para pack=" + pack.packId()
                            + " (priceEur=" + pack.priceEur() + ", minutesGranted=" + pack.minutesGranted()
                            + ", rate=" + rate + ")"
            );
        }
        return bonus;
    }
}
