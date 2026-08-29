package com.sharemechat.psp.service;

import com.sharemechat.psp.entity.PspProviderConfig;
import com.sharemechat.psp.repository.PspProviderConfigRepository;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Kill-switch de pagos (ADR-051 D8). Invariante crítica: {@code isEnabled}
 * devuelve true SOLO si {@code enabled=true} AND {@code active_mode=ENABLED}.
 * Un fallo aquí abre la puerta a aceptar pagos con el proveedor apagado.
 */
class PspProviderConfigServiceTest {

    private final PspProviderConfigRepository repo = mock(PspProviderConfigRepository.class);
    private final PspProviderConfigService svc = new PspProviderConfigService(repo);

    private static PspProviderConfig cfg(boolean enabled, String mode) {
        PspProviderConfig c = new PspProviderConfig();
        c.setProviderKey("nowpayments");
        c.setEnabled(enabled);
        c.setActiveMode(mode);
        return c;
    }

    @Test
    void isEnabledTrueSoloConEnabledYModoEnabled() {
        when(repo.findByProviderKey("nowpayments")).thenReturn(Optional.of(cfg(true, "ENABLED")));
        assertThat(svc.isEnabled("nowpayments")).isTrue();
        assertThat(svc.isNowPaymentsEnabled()).isTrue();
    }

    @Test
    void isEnabledFalseSiDeshabilitado() {
        when(repo.findByProviderKey("nowpayments")).thenReturn(Optional.of(cfg(false, "ENABLED")));
        assertThat(svc.isEnabled("nowpayments")).isFalse();
    }

    @Test
    void isEnabledFalseSiModoDisabled() {
        when(repo.findByProviderKey("nowpayments")).thenReturn(Optional.of(cfg(true, "DISABLED")));
        assertThat(svc.isEnabled("nowpayments")).isFalse();
    }

    @Test
    void isEnabledFalseSiConfigAusente() {
        when(repo.findByProviderKey("nowpayments")).thenReturn(Optional.empty());
        assertThat(svc.isEnabled("nowpayments")).isFalse();
    }

    @Test
    void isEnabledNormalizaProviderKeyYModoCaseInsensitive() {
        // providerKey se normaliza (trim + lowercase); el modo se compara case-insensitive.
        when(repo.findByProviderKey("nowpayments")).thenReturn(Optional.of(cfg(true, "enabled")));
        assertThat(svc.isEnabled("  NowPayments  ")).isTrue();
    }

    @Test
    void setActiveModeRechazaModoInvalido() {
        assertThatThrownBy(() -> svc.setActiveMode("nowpayments", "FOO", 1L, null))
                .isInstanceOf(IllegalArgumentException.class);
        verify(repo, never()).save(any());
    }

    @Test
    void setActiveModeValidoPersiste() {
        when(repo.findByProviderKey("nowpayments")).thenReturn(Optional.of(cfg(true, "DISABLED")));
        when(repo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        PspProviderConfig r = svc.setActiveMode("nowpayments", "ENABLED", 7L, "activado");

        assertThat(r.getActiveMode()).isEqualTo("ENABLED");
        assertThat(r.getUpdatedByUserId()).isEqualTo(7L);
        assertThat(r.getNote()).isEqualTo("activado");
    }
}
