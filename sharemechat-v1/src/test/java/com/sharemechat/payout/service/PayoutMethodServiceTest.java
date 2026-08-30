package com.sharemechat.payout.service;

import com.sharemechat.payout.dto.PayoutMethodRequestDTO;
import com.sharemechat.payout.entity.PayoutMethod;
import com.sharemechat.payout.repository.PayoutMethodRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Destino del dinero saliente. Asegura: validación de {@code accountRef} por rail
 * (email/IBAN/wallet), y la invariante "siempre existe exactamente un método
 * default" (forzado en el primero, mutex al marcar, promoción al borrar el default).
 */
class PayoutMethodServiceTest {

    private static final String IBAN_OK = "ES9121000418450200051332";
    private static final String WALLET_OK = "TQn9Y2khEUL3abc12345XYZ0";

    private final PayoutMethodRepository repo = mock(PayoutMethodRepository.class);
    private final PayoutMethodService svc = new PayoutMethodService(repo);

    @BeforeEach
    void setUp() {
        when(repo.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    private PayoutMethodRequestDTO req(String rail, String ref, boolean setDefault) {
        PayoutMethodRequestDTO r = new PayoutMethodRequestDTO();
        r.setRail(rail);
        r.setAccountRef(ref);
        r.setSetAsDefault(setDefault);
        return r;
    }

    private PayoutMethod pm(long id, String rail, String ref, boolean isDefault) {
        PayoutMethod p = new PayoutMethod();
        org.springframework.test.util.ReflectionTestUtils.setField(p, "id", id);
        p.setUserId(7L);
        p.setRail(rail);
        p.setAccountRef(ref);
        p.setDefault(isDefault);
        return p;
    }

    // ---------- validación por rail ----------

    @Test
    void paxumExigeEmailValido() {
        when(repo.findAllByUserIdOrderByIdDesc(7L)).thenReturn(List.of());
        assertThatThrownBy(() -> svc.create(7L, req("PAXUM", "no-es-email", false)))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("Paxum");
        // válido no lanza
        svc.create(7L, req("PAXUM", "cobros@modelo.com", false));
    }

    @Test
    void sepaExigeIbanValido() {
        when(repo.findAllByUserIdOrderByIdDesc(7L)).thenReturn(List.of());
        assertThatThrownBy(() -> svc.create(7L, req("SEPA_MANUAL", "1234", false)))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("IBAN");
        svc.create(7L, req("SEPA_MANUAL", IBAN_OK, false));
    }

    @Test
    void cryptoExigeWalletValida() {
        when(repo.findAllByUserIdOrderByIdDesc(7L)).thenReturn(List.of());
        assertThatThrownBy(() -> svc.create(7L, req("NOWPAYMENTS_CRYPTO", "short", false)))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("wallet");
        svc.create(7L, req("NOWPAYMENTS_CRYPTO", WALLET_OK, false));
    }

    @Test
    void railNoSoportadoLanza() {
        when(repo.findAllByUserIdOrderByIdDesc(7L)).thenReturn(List.of());
        assertThatThrownBy(() -> svc.create(7L, req("PAYPAL", "x@y.com", false)))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("Rail no soportado");
    }

    // ---------- invariante del default ----------

    @Test
    void elPrimerMetodoSeFuerzaComoDefaultAunqueNoSePida() {
        when(repo.findAllByUserIdOrderByIdDesc(7L)).thenReturn(List.of()); // no hay ninguno
        svc.create(7L, req("PAXUM", "a@b.com", false)); // setAsDefault=false

        ArgumentCaptor<PayoutMethod> cap = ArgumentCaptor.forClass(PayoutMethod.class);
        verify(repo).save(cap.capture());
        assertThat(cap.getValue().isDefault()).as("el primer método debe quedar default").isTrue();
    }

    @Test
    void crearComoDefaultDesmarcaElDefaultAnterior() {
        PayoutMethod anterior = pm(1L, "PAXUM", "old@b.com", true);
        when(repo.findAllByUserIdOrderByIdDesc(7L)).thenReturn(List.of(anterior));

        svc.create(7L, req("NOWPAYMENTS_CRYPTO", WALLET_OK, true));

        assertThat(anterior.isDefault()).as("el default anterior debe quedar desmarcado").isFalse();
    }

    @Test
    void borrarElDefaultPromueveElMasRecienteDeLosRestantes() {
        PayoutMethod target = pm(5L, "PAXUM", "a@b.com", true); // default, se borra
        PayoutMethod resto = pm(3L, "PAXUM", "c@d.com", false);
        when(repo.findByIdAndUserId(5L, 7L)).thenReturn(Optional.of(target));
        when(repo.findAllByUserIdOrderByIdDesc(7L)).thenReturn(List.of(resto)); // lo que queda

        svc.delete(7L, 5L);

        verify(repo).delete(target);
        assertThat(resto.isDefault()).as("al borrar el default debe promoverse otro").isTrue();
    }

    @Test
    void cambiarRailOAccountRefResetaLaVerificacion() {
        PayoutMethod pm = pm(5L, "PAXUM", "a@b.com", false);
        pm.setVerifiedAt(LocalDateTime.now());
        when(repo.findByIdAndUserId(5L, 7L)).thenReturn(Optional.of(pm));

        svc.update(7L, 5L, req("NOWPAYMENTS_CRYPTO", WALLET_OK, false)); // cambia rail y ref

        assertThat(pm.getVerifiedAt()).as("al cambiar rail/ref se invalida la verificación").isNull();
    }
}
