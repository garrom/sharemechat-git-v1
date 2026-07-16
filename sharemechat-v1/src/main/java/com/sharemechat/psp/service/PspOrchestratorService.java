package com.sharemechat.psp.service;

import com.sharemechat.entity.PaymentSession;
import com.sharemechat.entity.User;
import com.sharemechat.psp.PspException;
import com.sharemechat.psp.dto.CreateInvoiceRequest;
import com.sharemechat.psp.dto.CreateInvoiceResult;
import com.sharemechat.repository.PaymentSessionRepository;
import com.sharemechat.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Locale;
import java.util.UUID;

/**
 * ADR-051 Fase 3: orquestador vendor-agnostic para crear un checkout PSP.
 *
 * <p>Flujo {@link #createCheckout(Long, String, String, String)}:
 * <ol>
 *   <li>Valida usuario (existe, rol elegible).</li>
 *   <li>Resuelve pack → precio (catálogo P10/P20/P40, ADR-011).</li>
 *   <li>Chequea kill-switch runtime: {@code psp_provider_config.active_mode}
 *       para {@code providerKey} debe ser ENABLED, y {@link PaymentProvider}
 *       debe estar registrado en el contexto.</li>
 *   <li>Genera {@code order_id = UUID.randomUUID()} (D5).</li>
 *   <li>Persiste {@link PaymentSession} PENDING con provider + order_id
 *       + first_payment flag.</li>
 *   <li>Delega a {@link PaymentProvider#createInvoice(CreateInvoiceRequest)}.</li>
 *   <li>Actualiza la session con {@code psp_transaction_id} devuelto.</li>
 *   <li>Devuelve URL del hosted checkout para redirect frontend.</li>
 * </ol>
 *
 * <p>La transacción del paso 5 se hace ANTES del paso 6 (llamada HTTP al
 * vendor) para asegurar que si el vendor devuelve un id, siempre tenemos
 * la fila local a la que asociarlo. Si el vendor falla, la fila queda
 * PENDING sin {@code psp_transaction_id} (se puede reconciliar/marcar
 * FAILED por job posterior). Si actualizásemos DESPUÉS con FOR UPDATE,
 * el vendor podría procesar mientras la BD no tiene la fila.
 */
@Service
public class PspOrchestratorService {

    private static final Logger log = LoggerFactory.getLogger(PspOrchestratorService.class);

    /**
     * ADR-011 catálogo canónico. Duplicado aquí explícito para tests unitarios
     * y para evitar dependencia adicional; el catálogo vive también en
     * {@code CcbillService} (eliminado H7) y en {@code useAppModals.js} del
     * frontend. Consolidar en un servicio dedicado si aparece un tercer caller.
     */
    private static final java.util.Map<String, BigDecimal> PACK_PRICES = java.util.Map.of(
            "P10", new BigDecimal("10.00"),
            "P20", new BigDecimal("20.00"),
            "P40", new BigDecimal("40.00")
    );

    private final PaymentSessionRepository paymentSessionRepository;
    private final UserRepository userRepository;
    private final PaymentProviderRegistry providerRegistry;
    private final PspProviderConfigService pspProviderConfigService;

    public PspOrchestratorService(PaymentSessionRepository paymentSessionRepository,
                                  UserRepository userRepository,
                                  PaymentProviderRegistry providerRegistry,
                                  PspProviderConfigService pspProviderConfigService) {
        this.paymentSessionRepository = paymentSessionRepository;
        this.userRepository = userRepository;
        this.providerRegistry = providerRegistry;
        this.pspProviderConfigService = pspProviderConfigService;
    }

    /**
     * Crea el checkout hosted. Devuelve la URL a la que redirigir al usuario
     * y el order_id (para polling posterior de status).
     */
    @Transactional
    public CheckoutResult createCheckout(Long userId, String providerKey, String packId,
                                          BaseUrls baseUrls) {
        // 1. Validaciones básicas.
        if (userId == null) throw new IllegalArgumentException("userId requerido");
        if (packId == null || packId.isBlank()) throw new IllegalArgumentException("packId requerido");
        if (providerKey == null || providerKey.isBlank()) throw new IllegalArgumentException("providerKey requerido");
        String packKey = packId.trim().toUpperCase(Locale.ROOT);
        BigDecimal price = PACK_PRICES.get(packKey);
        if (price == null) {
            throw new IllegalArgumentException("PackId no soportado: " + packId);
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado: " + userId));

        // 2. Kill-switch runtime.
        if (!pspProviderConfigService.isEnabled(providerKey)) {
            throw new PspException("PSP_UNAVAILABLE: " + providerKey + " no habilitado runtime");
        }
        PaymentProvider provider = providerRegistry.find(providerKey)
                .orElseThrow(() -> new PspException("PSP_UNAVAILABLE: provider no registrado: " + providerKey));

        // 3. UUID puro (D5) - order_id único global sin colisiones cross-env.
        String orderId = UUID.randomUUID().toString();

        // 4. Determinar firstPayment (semántica ADR-012 BFPM): USER + FORM_CLIENT no
        // ha pagado antes; CLIENT ya pagó al menos una vez.
        boolean firstPayment = com.sharemechat.constants.Constants.Roles.USER.equals(user.getRole());

        // 5. Persistir PaymentSession PENDING (antes de llamar al vendor).
        PaymentSession session = new PaymentSession();
        session.setUser(user);
        session.setProvider(providerKey.toLowerCase(Locale.ROOT));
        session.setPackId(packKey);
        session.setAmount(price.setScale(2, RoundingMode.HALF_UP));
        session.setCurrency("eur");
        session.setFirstPayment(firstPayment);
        session.setStatus("PENDING");
        session.setOrderId(orderId);
        // psp_transaction_id se rellena tras la respuesta del vendor.
        paymentSessionRepository.saveAndFlush(session);

        // 6. Llamar al vendor.
        String description = String.format("SharemeChat - Pack %s (%s)",
                packKey, envHint());
        // ADR-051 Fase 4g: NOWPayments no expande placeholders en success/
        // cancel URL - hay que appendear el orderId manualmente aqui para
        // que /checkout/success pueda leerlo de query y hacer polling.
        String successUrl = appendOrderId(baseUrls.getSuccessUrl(), orderId);
        String cancelUrl = appendOrderId(baseUrls.getCancelUrl(), orderId);
        CreateInvoiceRequest req = new CreateInvoiceRequest(
                orderId, description,
                session.getAmount(), "eur",
                null, // pay_currency null -> cliente elige moneda en hosted checkout
                baseUrls.getIpnCallbackUrl(),
                successUrl,
                cancelUrl
        );
        CreateInvoiceResult vendorResult;
        try {
            vendorResult = provider.createInvoice(req);
        } catch (Exception ex) {
            log.warn("[PSP] createCheckout vendor error userId={} providerKey={} orderId={}: {}",
                    userId, providerKey, orderId, ex.getMessage());
            throw ex; // PaymentSession queda PENDING sin psp_transaction_id.
        }

        // 7. Actualizar la fila con psp_transaction_id devuelto.
        session.setPspTransactionId(vendorResult.getProviderPaymentId());
        paymentSessionRepository.save(session);

        log.info("[PSP] checkout created userId={} providerKey={} orderId={} providerPaymentId={} pack={} amount={}",
                userId, providerKey, orderId, vendorResult.getProviderPaymentId(), packKey, price);

        return new CheckoutResult(orderId, vendorResult.getInvoiceUrl(), session.getId());
    }

    /**
     * Appendea {@code ?orderId=<uuid>} a la URL respetando si ya tiene
     * query string (usa {@code &} en ese caso). Si la URL viene vacia o
     * null, devuelve string vacio (NOWPayments trata vacio como
     * "sin redirect" y usa la pantalla default del hosted checkout).
     */
    private String appendOrderId(String baseUrl, String orderId) {
        if (baseUrl == null || baseUrl.isBlank()) return "";
        String sep = baseUrl.contains("?") ? "&" : "?";
        return baseUrl + sep + "orderId=" + orderId;
    }

    /**
     * Utilidad: hint del entorno para el order_description. Best-effort
     * lectura de {@code SPRING_PROFILES_ACTIVE}; fallback a "?".
     */
    private String envHint() {
        String p = System.getenv("SPRING_PROFILES_ACTIVE");
        return (p == null || p.isBlank()) ? "?" : p.toLowerCase(Locale.ROOT);
    }

    public static class CheckoutResult {
        private final String orderId;
        private final String invoiceUrl;
        private final Long sessionId;

        public CheckoutResult(String orderId, String invoiceUrl, Long sessionId) {
            this.orderId = orderId;
            this.invoiceUrl = invoiceUrl;
            this.sessionId = sessionId;
        }

        public String getOrderId() { return orderId; }
        public String getInvoiceUrl() { return invoiceUrl; }
        public Long getSessionId() { return sessionId; }
    }

    /**
     * URLs del entorno para pasar al vendor en el request de invoice.
     * Se inyectan desde el controller para no acoplar este service a
     * {@code NowPaymentsProperties} (mantiene vendor-agnostic).
     */
    public static class BaseUrls {
        private final String ipnCallbackUrl;
        private final String successUrl;
        private final String cancelUrl;

        public BaseUrls(String ipnCallbackUrl, String successUrl, String cancelUrl) {
            this.ipnCallbackUrl = ipnCallbackUrl;
            this.successUrl = successUrl;
            this.cancelUrl = cancelUrl;
        }

        public String getIpnCallbackUrl() { return ipnCallbackUrl; }
        public String getSuccessUrl() { return successUrl; }
        public String getCancelUrl() { return cancelUrl; }
    }
}
