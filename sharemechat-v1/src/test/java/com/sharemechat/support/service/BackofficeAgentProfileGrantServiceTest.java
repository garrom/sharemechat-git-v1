package com.sharemechat.support.service;

import com.sharemechat.entity.User;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.support.dto.GrantDetailDTO;
import com.sharemechat.support.entity.BackofficeAgentProfileGrant;
import com.sharemechat.support.repository.BackofficeAgentProfileGrantRepository;
import com.sharemechat.support.repository.BackofficeAgentProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyIterable;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class BackofficeAgentProfileGrantServiceTest {

    private BackofficeAgentProfileGrantRepository grantRepo;
    private BackofficeAgentProfileRepository profileRepo;
    private UserRepository userRepo;
    private BackofficeAgentProfileGrantService svc;

    @BeforeEach
    void setUp() {
        grantRepo = mock(BackofficeAgentProfileGrantRepository.class);
        profileRepo = mock(BackofficeAgentProfileRepository.class);
        userRepo = mock(UserRepository.class);
        svc = new BackofficeAgentProfileGrantService(grantRepo, profileRepo, userRepo);
    }

    @Test
    @DisplayName("listGrantsByProfileDetailed: happy path resuelve emails por batch (sin N+1) y preserva orden del repo")
    void listGrantsHappyPath() {
        BackofficeAgentProfileGrant g1 = new BackofficeAgentProfileGrant();
        g1.setUserId(10L);
        g1.setProfileId(7L);
        g1.setGrantedBy(9L);
        g1.setActive(true);
        g1.setGrantedAt(LocalDateTime.of(2026, 7, 8, 12, 0));
        BackofficeAgentProfileGrant g2 = new BackofficeAgentProfileGrant();
        g2.setUserId(11L);
        g2.setProfileId(7L);
        g2.setGrantedBy(9L);
        g2.setActive(false);
        g2.setGrantedAt(LocalDateTime.of(2026, 7, 7, 12, 0));

        when(grantRepo.findAllByProfileIdOrderByGrantedAtDesc(7L))
                .thenReturn(List.of(g1, g2));

        User admin = mkUser(9L, "operations+admin@sharemechat.com");
        User u10 = mkUser(10L, "u10@example.com");
        User u11 = mkUser(11L, "u11@example.com");
        when(userRepo.findAllById(anyIterable())).thenReturn(List.of(admin, u10, u11));

        List<GrantDetailDTO> out = svc.listGrantsByProfileDetailed(7L);

        assertEquals(2, out.size());
        assertEquals(10L, out.get(0).getUserId());
        assertEquals("u10@example.com", out.get(0).getUserEmail());
        assertEquals(9L, out.get(0).getGrantedBy());
        assertEquals("operations+admin@sharemechat.com", out.get(0).getGrantedByEmail());
        assertTrue(out.get(0).isActive());
        assertEquals(11L, out.get(1).getUserId());
        assertEquals("u11@example.com", out.get(1).getUserEmail());
        assertFalse(out.get(1).isActive());

        // Batch-fetch users: una sola llamada a findAllById.
        verify(userRepo).findAllById(anyIterable());
    }

    @Test
    @DisplayName("listGrantsByProfileDetailed: profile sin grants -> lista vacia, no consulta users")
    void listGrantsEmpty() {
        when(grantRepo.findAllByProfileIdOrderByGrantedAtDesc(99L)).thenReturn(List.of());
        List<GrantDetailDTO> out = svc.listGrantsByProfileDetailed(99L);
        assertTrue(out.isEmpty());
        verify(userRepo, org.mockito.Mockito.never()).findAllById(anyIterable());
    }

    @Test
    @DisplayName("listGrantsByProfileDetailed: granted_by NULL -> grantedByEmail NULL, sin fallo")
    void listGrantsWithNullGrantedBy() {
        BackofficeAgentProfileGrant g = new BackofficeAgentProfileGrant();
        g.setUserId(10L);
        g.setProfileId(7L);
        g.setGrantedBy(null);
        g.setActive(true);
        g.setGrantedAt(LocalDateTime.now());
        when(grantRepo.findAllByProfileIdOrderByGrantedAtDesc(7L)).thenReturn(List.of(g));
        when(userRepo.findAllById(anyIterable()))
                .thenReturn(List.of(mkUser(10L, "u10@example.com")));

        List<GrantDetailDTO> out = svc.listGrantsByProfileDetailed(7L);
        assertEquals(1, out.size());
        assertEquals("u10@example.com", out.get(0).getUserEmail());
        assertNull(out.get(0).getGrantedBy());
        assertNull(out.get(0).getGrantedByEmail());
    }

    @Test
    @DisplayName("listGrantsByProfileDetailed: user_id sin fila en users -> email null pero sin fallo")
    void listGrantsWithMissingUserEmail() {
        BackofficeAgentProfileGrant g = new BackofficeAgentProfileGrant();
        g.setUserId(999L);
        g.setProfileId(7L);
        g.setGrantedBy(9L);
        g.setActive(true);
        g.setGrantedAt(LocalDateTime.now());
        when(grantRepo.findAllByProfileIdOrderByGrantedAtDesc(7L)).thenReturn(List.of(g));
        when(userRepo.findAllById(anyIterable()))
                .thenReturn(List.of(mkUser(9L, "operations+admin@sharemechat.com")));

        List<GrantDetailDTO> out = svc.listGrantsByProfileDetailed(7L);
        assertEquals(1, out.size());
        assertNull(out.get(0).getUserEmail(), "user 999 no esta en la respuesta de findAllById");
        assertEquals("operations+admin@sharemechat.com", out.get(0).getGrantedByEmail());
    }

    private static User mkUser(Long id, String email) {
        User u = new User();
        try {
            java.lang.reflect.Field f = User.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(u, id);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
        u.setEmail(email);
        return u;
    }
}
