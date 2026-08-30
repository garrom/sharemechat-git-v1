package com.sharemechat.service;

import com.sharemechat.dto.ModelContractManifestDTO;
import com.sharemechat.entity.ModelContractAcceptance;
import com.sharemechat.repository.ModelContractAcceptanceRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Aceptación del contrato de modelo: idempotencia (no duplica el registro de
 * consentimiento legal), rama de carrera (dos aceptaciones simultáneas) y
 * el flag matchesCurrent por sha256.
 */
class ModelContractServiceTest {

    private static final String VERSION = "model_contract_v1_2026-08-04";
    private static final String SHA = "AAAA1111BBBB2222CCCC3333DDDD4444EEEE5555FFFF6666AAAA7777BBBB8888";
    private static final String URL = "https://assets.test/legal/model_contract.pdf";

    private final ModelContractAcceptanceRepository repo = mock(ModelContractAcceptanceRepository.class);
    private final ModelContractManifestService manifest = mock(ModelContractManifestService.class);
    private final ModelContractService svc = new ModelContractService(repo, manifest);

    @BeforeEach
    void setUp() {
        ModelContractManifestDTO m = new ModelContractManifestDTO();
        m.setVersion(VERSION);
        m.setSha256(SHA);
        m.setUrl(URL);
        when(manifest.getCurrent()).thenReturn(m);
    }

    private ModelContractAcceptance row(String sha) {
        ModelContractAcceptance r = new ModelContractAcceptance();
        r.setUserId(7L);
        r.setContractVersion(VERSION);
        r.setContractSha256(sha);
        r.setAcceptedAt(LocalDateTime.now());
        return r;
    }

    @Test
    void acceptConUserIdNuloNoAcepta() {
        Map<String, Object> res = svc.accept(null, "ip", "ua");
        assertThat(res.get("ok")).isEqualTo(false);
        assertThat(res.get("alreadyAccepted")).isEqualTo(false);
        verify(repo, never()).save(any());
    }

    @Test
    void acceptEsIdempotenteSiYaExisteParaLaVersionVigente() {
        when(repo.findByUserIdAndContractVersion(7L, VERSION)).thenReturn(Optional.of(row(SHA)));

        Map<String, Object> res = svc.accept(7L, "ip", "ua");

        assertThat(res.get("ok")).isEqualTo(true);
        assertThat(res.get("alreadyAccepted")).isEqualTo(true);
        assertThat(res.get("matchesCurrent")).isEqualTo(true);
        verify(repo, never()).save(any()); // NO duplica
    }

    @Test
    void acceptNuevaAceptacionInsertaFila() {
        when(repo.findByUserIdAndContractVersion(7L, VERSION)).thenReturn(Optional.empty());

        Map<String, Object> res = svc.accept(7L, "ip", "ua");

        assertThat(res.get("ok")).isEqualTo(true);
        assertThat(res.get("alreadyAccepted")).isEqualTo(false);
        assertThat(res.get("matchesCurrent")).isEqualTo(true);
        verify(repo).save(any(ModelContractAcceptance.class));
    }

    @Test
    void acceptEnCarreraDevuelveIdempotenteOK() {
        // 1ª consulta: no existe -> intenta insertar -> otro insertó primero (DIVE)
        // 2ª consulta: ya existe -> se resuelve como aceptado.
        when(repo.findByUserIdAndContractVersion(7L, VERSION))
                .thenReturn(Optional.empty())
                .thenReturn(Optional.of(row(SHA)));
        when(repo.save(any())).thenThrow(new DataIntegrityViolationException("dup"));

        Map<String, Object> res = svc.accept(7L, "ip", "ua");

        assertThat(res.get("ok")).isEqualTo(true);
        assertThat(res.get("alreadyAccepted")).isEqualTo(true);
    }

    @Test
    void acceptEnCarreraSinFilaTrasReintentoRelanza() {
        when(repo.findByUserIdAndContractVersion(7L, VERSION)).thenReturn(Optional.empty());
        when(repo.save(any())).thenThrow(new DataIntegrityViolationException("dup"));

        assertThatThrownBy(() -> svc.accept(7L, "ip", "ua"))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void isAcceptedYIsAcceptedEverDeleganEnElRepo() {
        when(repo.existsByUserIdAndContractVersion(7L, VERSION)).thenReturn(true);
        when(repo.existsByUserId(7L)).thenReturn(true);
        assertThat(svc.isAccepted(7L)).isTrue();
        assertThat(svc.isAcceptedEver(7L)).isTrue();
        assertThat(svc.isAccepted(null)).isFalse();
        verify(repo).existsByUserIdAndContractVersion(eq(7L), eq(VERSION));
    }
}
