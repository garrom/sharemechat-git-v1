package com.sharemechat.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.dto.ModelLikeStateDTO;
import com.sharemechat.entity.ModelLike;
import com.sharemechat.entity.User;
import com.sharemechat.repository.ModelLikeRepository;
import com.sharemechat.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Card 1 Fase 3: likes + insignias. Verifica la escalera de umbrales y el
 * toggle (dar/quitar, self-like, objetivo no-modelo).
 */
class ModelLikeServiceTest {

    private ModelLikeRepository likeRepo;
    private UserRepository userRepo;
    private ModelLikeService service;

    @BeforeEach
    void setUp() {
        likeRepo = mock(ModelLikeRepository.class);
        userRepo = mock(UserRepository.class);
        service = new ModelLikeService(likeRepo, userRepo);
    }

    private User model(Long id) {
        User u = new User();
        u.setId(id);
        u.setRole(Constants.Roles.MODEL);
        return u;
    }

    @Test
    void resolveBadge_escalera() {
        assertNull(ModelLikeService.resolveBadge(0));
        assertNull(ModelLikeService.resolveBadge(9));
        assertEquals("TIARA", ModelLikeService.resolveBadge(10));
        assertEquals("TIARA", ModelLikeService.resolveBadge(24));
        assertEquals("DIADEM", ModelLikeService.resolveBadge(25));
        assertEquals("CROWN", ModelLikeService.resolveBadge(50));
        assertEquals("CROWN", ModelLikeService.resolveBadge(99));
        assertEquals("GEMS_CROWN", ModelLikeService.resolveBadge(100));
        assertEquals("IMPERIAL", ModelLikeService.resolveBadge(250));
        assertEquals("IMPERIAL", ModelLikeService.resolveBadge(9999));
    }

    @Test
    void getState_devuelveCountHasLikedYBadge() {
        when(likeRepo.countByModelUserId(5L)).thenReturn(30L);
        when(likeRepo.existsByClientUserIdAndModelUserId(1L, 5L)).thenReturn(true);

        ModelLikeStateDTO s = service.getState(1L, 5L);

        assertEquals(30L, s.count());
        assertTrue(s.hasLiked());
        assertEquals("DIADEM", s.badgeCode());
    }

    @Test
    void toggle_daLikeSiNoExiste() {
        when(userRepo.findById(5L)).thenReturn(Optional.of(model(5L)));
        when(likeRepo.existsByClientUserIdAndModelUserId(1L, 5L)).thenReturn(false, true);
        when(likeRepo.countByModelUserId(5L)).thenReturn(1L);

        ModelLikeStateDTO s = service.toggle(1L, 5L);

        verify(likeRepo).save(any(ModelLike.class));
        verify(likeRepo, never()).deleteByClientUserIdAndModelUserId(any(), any());
        assertTrue(s.hasLiked());
        assertEquals(1L, s.count());
    }

    @Test
    void toggle_quitaLikeSiExiste() {
        when(userRepo.findById(5L)).thenReturn(Optional.of(model(5L)));
        when(likeRepo.existsByClientUserIdAndModelUserId(1L, 5L)).thenReturn(true, false);
        when(likeRepo.countByModelUserId(5L)).thenReturn(0L);

        ModelLikeStateDTO s = service.toggle(1L, 5L);

        verify(likeRepo).deleteByClientUserIdAndModelUserId(1L, 5L);
        verify(likeRepo, never()).save(any(ModelLike.class));
        assertFalse(s.hasLiked());
        assertEquals(0L, s.count());
    }

    @Test
    void toggle_rechazaSelfLike() {
        assertThrows(IllegalArgumentException.class, () -> service.toggle(1L, 1L));
    }

    @Test
    void toggle_rechazaObjetivoNoModelo() {
        User client = new User();
        client.setId(9L);
        client.setRole(Constants.Roles.CLIENT);
        when(userRepo.findById(9L)).thenReturn(Optional.of(client));

        assertThrows(IllegalArgumentException.class, () -> service.toggle(1L, 9L));
    }
}
