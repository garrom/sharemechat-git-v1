package com.sharemechat.service;

import com.sharemechat.dto.CcbillInitResponseDTO;
import com.sharemechat.dto.TransactionRequestDTO;
import com.sharemechat.entity.PaymentSession;
import com.sharemechat.entity.User;
import com.sharemechat.repository.PaymentSessionRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class CcbillService {

    private final PaymentSessionRepository paymentSessionRepository;
    private final TransactionService transactionService;

    public CcbillService(PaymentSessionRepository paymentSessionRepository,
                         TransactionService transactionService) {
        this.paymentSessionRepository = paymentSessionRepository;
        this.transactionService = transactionService;
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
        // 1) Resolver importe del pack (alineado con frontend)
        BigDecimal amount = resolvePackAmount(packId);

        // 2) Crear PaymentSession en BBDD
        PaymentSession session = new PaymentSession();
        session.setUser(user);
        session.setPackId(packId);
        session.setAmount(amount);
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
        fields.put("currencyCode", "978");                 // 978 = EUR
        fields.put("amount", amount.toPlainString());      // "12.00", "27.00", etc.
        fields.put("orderId", session.getOrderId());       // identificador único nuestro
        fields.put("email", user.getEmail());              // opcional

        dto.setFields(fields);

        return dto;
    }

    /**
     * Procesa la notificación de la pasarela:
     *  - Busca la PaymentSession por orderId.
     *  - Si ya no está en PENDING, no hace nada (idempotente).
     *  - Si el pago está aprobado, registra la recarga vía TransactionService.
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
            // Si por algún motivo ya existe para otra sesión, capturamos excepción e ignoramos
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

        // Construimos un TransactionRequestDTO como los que ya usa TransactionService
        TransactionRequestDTO dto = new TransactionRequestDTO();
        dto.setAmount(session.getAmount());
        dto.setOperationType("INGRESO");
        dto.setDescription("Recarga via CCBILL pack " + session.getPackId());

        // Si es primer pago => processFirstTransaction, si no => addBalance
        if (session.isFirstPayment()) {
            transactionService.processFirstTransaction(user.getId(), dto);
        } else {
            transactionService.addBalance(user.getId(), dto);
        }

        session.setStatus("SUCCESS");
        paymentSessionRepository.save(session);
    }

    private BigDecimal resolvePackAmount(String packId) {
        if ("P5".equalsIgnoreCase(packId)) {
            return BigDecimal.valueOf(5.00);
        }
        if ("P15".equalsIgnoreCase(packId)) {
            return BigDecimal.valueOf(12.00);
        }
        if ("P30".equalsIgnoreCase(packId)) {
            return BigDecimal.valueOf(27.00);
        }
        if ("P45".equalsIgnoreCase(packId)) {
            return BigDecimal.valueOf(40.00);
        }
        throw new IllegalArgumentException("PackId no soportado: " + packId);
    }
}
