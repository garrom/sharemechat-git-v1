package com.sharemechat.master.service;

import com.sharemechat.master.dto.MasterContractManifestDTO;
import com.sharemechat.master.entity.MasterContractAcceptance;
import com.sharemechat.master.repository.MasterContractAcceptanceRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * ADR-056 S2.5: tests unitarios de MasterContractService. Cubre
 * idempotencia + carrera DataIntegrityViolationException.
 */
class MasterContractServiceTest {

    private MasterContractAcceptanceRepository repo;
    private MasterContractManifestService manifestService;
    private MasterContractService svc;

    private static final String VERSION = "master_contract_v1_2026-07-29";
    private static final String SHA256 = "A".repeat(64);
    private static final String URL = "https://assets.sharemechat.com/legal/master_contract.pdf";

    @BeforeEach
    void setUp() {
        repo = mock(MasterContractAcceptanceRepository.class);
        manifestService = mock(MasterContractManifestService.class);
        MasterContractManifestDTO manifest = new MasterContractManifestDTO();
        manifest.setVersion(VERSION);
        manifest.setSha256(SHA256);
        manifest.setUrl(URL);
        when(manifestService.getCurrent()).thenReturn(manifest);
        svc = new MasterContractService(repo, manifestService);
    }

    @Test
    @DisplayName("current() devuelve version+sha+url del manifest vigente")
    void current_ok() {
        Map<String, String> current = svc.current();
        assertEquals(VERSION, current.get("version"));
        assertEquals(SHA256, current.get("sha256"));
        assertEquals(URL, current.get("url"));
    }

    @Test
    @DisplayName("isAccepted true si repo devuelve fila para user+version")
    void isAccepted_true() {
        when(repo.existsByUserIdAndContractVersion(42L, VERSION)).thenReturn(true);
        assertTrue(svc.isAccepted(42L));
        assertTrue(svc.isAcceptedCurrent(42L));
    }

    @Test
    @DisplayName("isAccepted false si no hay fila")
    void isAccepted_false() {
        when(repo.existsByUserIdAndContractVersion(42L, VERSION)).thenReturn(false);
        assertFalse(svc.isAccepted(42L));
    }

    @Test
    @DisplayName("isAccepted false si userId null")
    void isAccepted_nullUser() {
        assertFalse(svc.isAccepted(null));
    }

    @Test
    @DisplayName("accept happy path: inserta y devuelve ok=true, alreadyAccepted=false")
    void accept_happy() {
        when(repo.findFirstByUserIdAndContractVersion(42L, VERSION)).thenReturn(Optional.empty());
        when(repo.save(any(MasterContractAcceptance.class))).thenAnswer(inv -> inv.getArgument(0));

        Map<String, Object> res = svc.accept(42L, "1.2.3.4", "ua");

        assertEquals(Boolean.TRUE, res.get("ok"));
        assertEquals(Boolean.FALSE, res.get("alreadyAccepted"));
        assertEquals(Boolean.TRUE, res.get("matchesCurrent"));
        assertEquals(VERSION, res.get("version"));
    }

    @Test
    @DisplayName("accept idempotente: fila ya existe con sha matching -> ok=true, alreadyAccepted=true, matchesCurrent=true")
    void accept_idempotent() {
        MasterContractAcceptance existing = new MasterContractAcceptance();
        existing.setUserId(42L);
        existing.setContractVersion(VERSION);
        existing.setContractSha256(SHA256);
        when(repo.findFirstByUserIdAndContractVersion(42L, VERSION)).thenReturn(Optional.of(existing));

        Map<String, Object> res = svc.accept(42L, "1.2.3.4", "ua");

        assertEquals(Boolean.TRUE, res.get("ok"));
        assertEquals(Boolean.TRUE, res.get("alreadyAccepted"));
        assertEquals(Boolean.TRUE, res.get("matchesCurrent"));
        verify(repo, times(0)).save(any());
    }

    @Test
    @DisplayName("accept race: save lanza DataIntegrityViolation -> fetch second time devuelve idempotente")
    void accept_race_recovery() {
        MasterContractAcceptance fromRace = new MasterContractAcceptance();
        fromRace.setUserId(42L);
        fromRace.setContractVersion(VERSION);
        fromRace.setContractSha256(SHA256);

        when(repo.findFirstByUserIdAndContractVersion(42L, VERSION))
                .thenReturn(Optional.empty())     // primera consulta (idempotencia)
                .thenReturn(Optional.of(fromRace)); // segunda consulta (post-race)

        doThrow(new DataIntegrityViolationException("race"))
                .when(repo).save(any(MasterContractAcceptance.class));

        Map<String, Object> res = svc.accept(42L, "1.2.3.4", "ua");

        assertEquals(Boolean.TRUE, res.get("ok"));
        assertEquals(Boolean.TRUE, res.get("alreadyAccepted"));
    }

    @Test
    @DisplayName("accept con userId null devuelve ok=false")
    void accept_nullUser() {
        Map<String, Object> res = svc.accept(null, null, null);
        assertEquals(Boolean.FALSE, res.get("ok"));
    }
}
