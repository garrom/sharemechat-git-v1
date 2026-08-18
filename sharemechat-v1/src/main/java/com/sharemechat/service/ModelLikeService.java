package com.sharemechat.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.dto.ModelLikeStateDTO;
import com.sharemechat.entity.ModelLike;
import com.sharemechat.entity.User;
import com.sharemechat.repository.ModelLikeRepository;
import com.sharemechat.repository.UserRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Card 1 Fase 3: likes cliente→modelo + insignias por umbral.
 *
 * <p>Anti-abuso estructural (UNIQUE del par); nada de moderación. El
 * contador es un COUNT(*); la insignia se resuelve contra la escalera
 * (Tiara/Diadema/Corona/Corona de Gemas/Imperial). Cualquier cliente
 * autenticado puede dar like a una modelo (no a sí mismo).
 */
@Service
public class ModelLikeService {

    /** Escalera de insignias (de mayor a menor umbral). Fácil de tunear. */
    static final List<Badge> BADGES = List.of(
            new Badge(250, "IMPERIAL"),
            new Badge(100, "GEMS_CROWN"),
            new Badge(50, "CROWN"),
            new Badge(25, "DIADEM"),
            new Badge(10, "TIARA")
    );

    private final ModelLikeRepository modelLikeRepository;
    private final UserRepository userRepository;

    public ModelLikeService(ModelLikeRepository modelLikeRepository, UserRepository userRepository) {
        this.modelLikeRepository = modelLikeRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public ModelLikeStateDTO getState(Long viewerId, Long modelId) {
        long count = modelLikeRepository.countByModelUserId(modelId);
        boolean hasLiked = viewerId != null
                && modelLikeRepository.existsByClientUserIdAndModelUserId(viewerId, modelId);
        return new ModelLikeStateDTO(count, hasLiked, resolveBadge(count));
    }

    @Transactional
    public ModelLikeStateDTO toggle(Long clientId, Long modelId) {
        if (clientId == null || modelId == null || clientId.equals(modelId)) {
            throw new IllegalArgumentException("Like no válido");
        }
        User target = userRepository.findById(modelId).orElse(null);
        if (target == null || !Constants.Roles.MODEL.equals(target.getRole())) {
            throw new IllegalArgumentException("La modelo no está disponible");
        }

        boolean liked = modelLikeRepository.existsByClientUserIdAndModelUserId(clientId, modelId);
        if (liked) {
            modelLikeRepository.deleteByClientUserIdAndModelUserId(clientId, modelId);
        } else {
            try {
                modelLikeRepository.save(new ModelLike(clientId, modelId));
            } catch (DataIntegrityViolationException dup) {
                // Carrera: otro request ya insertó el par. Idempotente, seguimos.
            }
        }
        return getState(clientId, modelId);
    }

    /** Insignia vigente para un total de likes; null por debajo del primer umbral. */
    static String resolveBadge(long count) {
        for (Badge b : BADGES) {
            if (count >= b.threshold()) return b.code();
        }
        return null;
    }

    record Badge(long threshold, String code) {}
}
