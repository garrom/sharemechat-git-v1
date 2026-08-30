package com.sharemechat.psp.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.PaymentSession;
import com.sharemechat.entity.User;
import com.sharemechat.psp.ClientGoliveClosedException;
import com.sharemechat.psp.PspException;
import com.sharemechat.psp.dto.CreateInvoiceRequest;
import com.sharemechat.psp.dto.CreateInvoiceResult;
import com.sharemechat.psp.service.PspOrchestratorService.BaseUrls;
import com.sharemechat.psp.service.PspOrchestratorService.CheckoutResult;
import com.sharemechat.repository.PaymentSessionRepository;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.service.ProductOperationalModeService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Dinero de ENTRADA (createCheckout). Asegura lo que hoy no tenía red:
 * precio correcto por pack, kill-switch runtime, gate go-live del primer pago
 * y que un fallo del vendor deja la sesión PENDING sin psp_transaction_id.
 */
class PspOrchestratorServiceTest {

    private static final String PROVIDER = "nowpayments";

    private final PaymentSessionRepository sessionRepo = mock(PaymentSessionRepository.class);
    private final UserRepository userRepo = mock(UserRepository.class);
    private final PaymentProviderRegistry registry = mock(PaymentProviderRegistry.class);
    private final PspProviderConfigService config = mock(PspProviderConfigService.class);
    private final ProductOperationalModeService mode = mock(ProductOperationalModeService.class);
    private final PaymentProvider provider = mock(PaymentProvider.class);

    private final PspOrchestratorService svc =
            new PspOrchestratorService(sessionRepo, userRepo, registry, config, mode);

    private final BaseUrls urls = new BaseUrls("https://x/ipn", "https://x/success", "https://x/cancel");

    private User user(long id, String role) {
        User u = new User();
        u.setId(id);
        u.setRole(role);
        return u;
    }

    /** Camino feliz por defecto: cliente ya pagador, PSP habilitado, provider presente. */
    @BeforeEach
    void happyDefaults() {
        when(userRepo.findById(1L)).thenReturn(Optional.of(user(1L, Constants.Roles.CLIENT)));
        when(config.isEnabled(PROVIDER)).thenReturn(true);
        when(registry.find(PROVIDER)).thenReturn(Optional.of(provider));
        when(provider.createInvoice(any(CreateInvoiceRequest.class)))
                .thenReturn(new CreateInvoiceResult("PAY123", "https://invoice.test/abc"));
    }

    // ---------- validaciones ----------

    @Test
    void validacionesBasicasLanzan() {
        assertThatThrownBy(() -> svc.createCheckout(null, PROVIDER, "P10", urls)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> svc.createCheckout(1L, PROVIDER, " ", urls)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> svc.createCheckout(1L, " ", "P10", urls)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> svc.createCheckout(1L, PROVIDER, "P999", urls))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("PackId");
    }

    @Test
    void usuarioNoEncontradoLanza() {
        when(userRepo.findById(1L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> svc.createCheckout(1L, PROVIDER, "P10", urls))
                .isInstanceOf(IllegalArgumentException.class);
    }

    // ---------- kill-switch + provider ----------

    @Test
    void killSwitchApagadoRechazaSinCrearSesionNiLlamarVendor() {
        when(config.isEnabled(PROVIDER)).thenReturn(false);
        assertThatThrownBy(() -> svc.createCheckout(1L, PROVIDER, "P10", urls))
                .isInstanceOf(PspException.class);
        verify(sessionRepo, never()).saveAndFlush(any());
        verify(provider, never()).createInvoice(any());
    }

    @Test
    void providerNoRegistradoRechaza() {
        when(registry.find(PROVIDER)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> svc.createCheckout(1L, PROVIDER, "P10", urls))
                .isInstanceOf(PspException.class);
    }

    // ---------- gate go-live del primer pago ----------

    @Test
    void goliveCerradoBloqueaElPrimerPagoAntesDeCobrar() {
        when(userRepo.findById(1L)).thenReturn(Optional.of(user(1L, Constants.Roles.USER))); // firstPayment
        when(mode.isClientGoliveEnabled()).thenReturn(false);
        assertThatThrownBy(() -> svc.createCheckout(1L, PROVIDER, "P10", urls))
                .isInstanceOf(ClientGoliveClosedException.class);
        verify(sessionRepo, never()).saveAndFlush(any()); // no crea la sesión
        verify(provider, never()).createInvoice(any());   // no llama al vendor
    }

    // ---------- precio por pack (invariante de dinero) ----------

    @Test
    void cadaPackCobraSuImporteExacto() {
        svc.createCheckout(1L, PROVIDER, "P10", urls);
        svc.createCheckout(1L, PROVIDER, "P20", urls);
        svc.createCheckout(1L, PROVIDER, "P40", urls);
        svc.createCheckout(1L, PROVIDER, "P100", urls);

        ArgumentCaptor<PaymentSession> cap = ArgumentCaptor.forClass(PaymentSession.class);
        verify(sessionRepo, times(4)).saveAndFlush(cap.capture());
        List<PaymentSession> saved = cap.getAllValues();
        assertThat(saved.get(0).getAmount()).isEqualByComparingTo(new BigDecimal("10.00"));
        assertThat(saved.get(1).getAmount()).isEqualByComparingTo(new BigDecimal("20.00"));
        assertThat(saved.get(2).getAmount()).isEqualByComparingTo(new BigDecimal("40.00"));
        assertThat(saved.get(3).getAmount()).isEqualByComparingTo(new BigDecimal("100.00"));
    }

    // ---------- happy path + firstPayment ----------

    @Test
    void happyPathDevuelveInvoiceYActualizaPspTransactionId() {
        CheckoutResult r = svc.createCheckout(1L, PROVIDER, "P20", urls);

        assertThat(r.getOrderId()).isNotBlank();
        assertThat(r.getInvoiceUrl()).isEqualTo("https://invoice.test/abc");

        ArgumentCaptor<PaymentSession> cap = ArgumentCaptor.forClass(PaymentSession.class);
        verify(sessionRepo).saveAndFlush(cap.capture()); // PENDING
        verify(sessionRepo).save(cap.capture());          // update con psp_transaction_id
        PaymentSession updated = cap.getAllValues().get(cap.getAllValues().size() - 1);
        assertThat(updated.getPspTransactionId()).isEqualTo("PAY123");
        assertThat(updated.isFirstPayment()).isFalse(); // CLIENT no es primer pago
    }

    @Test
    void firstPaymentTrueParaUserConGoliveAbierto() {
        when(userRepo.findById(1L)).thenReturn(Optional.of(user(1L, Constants.Roles.USER)));
        when(mode.isClientGoliveEnabled()).thenReturn(true);

        svc.createCheckout(1L, PROVIDER, "P10", urls);

        ArgumentCaptor<PaymentSession> cap = ArgumentCaptor.forClass(PaymentSession.class);
        verify(sessionRepo).saveAndFlush(cap.capture());
        assertThat(cap.getValue().isFirstPayment()).isTrue();
    }

    // ---------- fallo del vendor ----------

    @Test
    void fallaDelVendorDejaSesionPendingSinPspTransactionId() {
        when(provider.createInvoice(any())).thenThrow(new RuntimeException("vendor 500"));

        assertThatThrownBy(() -> svc.createCheckout(1L, PROVIDER, "P10", urls))
                .isInstanceOf(RuntimeException.class);

        ArgumentCaptor<PaymentSession> cap = ArgumentCaptor.forClass(PaymentSession.class);
        verify(sessionRepo).saveAndFlush(cap.capture()); // se creó PENDING
        assertThat(cap.getValue().getStatus()).isEqualTo("PENDING");
        assertThat(cap.getValue().getPspTransactionId()).isNull();
        verify(sessionRepo, never()).save(any()); // NO se llegó al update post-vendor
    }
}
