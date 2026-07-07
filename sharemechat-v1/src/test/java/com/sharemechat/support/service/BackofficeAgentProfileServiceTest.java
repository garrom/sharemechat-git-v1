package com.sharemechat.support.service;

import com.sharemechat.support.entity.BackofficeAgentProfile;
import com.sharemechat.support.exception.SupportConflictException;
import com.sharemechat.support.exception.SupportNotFoundException;
import com.sharemechat.support.repository.BackofficeAgentProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class BackofficeAgentProfileServiceTest {

    private BackofficeAgentProfileRepository repo;
    private BackofficeAgentProfileService svc;

    @BeforeEach
    void setUp() {
        repo = mock(BackofficeAgentProfileRepository.class);
        svc = new BackofficeAgentProfileService(repo);
        when(repo.save(any(BackofficeAgentProfile.class)))
                .thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    @DisplayName("create happy path -> profile con displayName trim + active=true")
    void createHappyPath() {
        BackofficeAgentProfile p = svc.create("  Pepito (Soporte)  ", "TECH", 99L);
        assertEquals("Pepito (Soporte)", p.getDisplayName());
        assertEquals("TECH", p.getCategory());
        assertTrue(p.isActive());
        assertEquals(99L, p.getCreatedBy());
    }

    @Test
    @DisplayName("create con displayName vacio -> IllegalArgumentException")
    void createEmptyDisplayName() {
        assertThrows(IllegalArgumentException.class,
                () -> svc.create("   ", null, 1L));
    }

    @Test
    @DisplayName("create con displayName duplicado -> SupportConflictException")
    void createDuplicate() {
        when(repo.save(any(BackofficeAgentProfile.class)))
                .thenThrow(new DataIntegrityViolationException("uk_bap_display_name"));
        assertThrows(SupportConflictException.class,
                () -> svc.create("Pepito", null, 1L));
    }

    @Test
    @DisplayName("update parcial -> solo cambia active si otros son null")
    void updatePartial() {
        BackofficeAgentProfile existing = new BackofficeAgentProfile();
        existing.setDisplayName("Antiguo");
        existing.setActive(true);
        when(repo.findById(1L)).thenReturn(Optional.of(existing));

        BackofficeAgentProfile out = svc.update(1L, null, null, false);
        assertEquals("Antiguo", out.getDisplayName());
        assertFalse(out.isActive());
    }

    @Test
    @DisplayName("update con id inexistente -> SupportNotFoundException")
    void updateNotFound() {
        when(repo.findById(999L)).thenReturn(Optional.empty());
        assertThrows(SupportNotFoundException.class,
                () -> svc.update(999L, "X", null, null));
    }
}
