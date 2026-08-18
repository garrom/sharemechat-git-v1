package com.sharemechat.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.dto.ModelLikeStateDTO;
import com.sharemechat.dto.ModelRankingDTO;
import com.sharemechat.dto.ModelReputationDTO;
import com.sharemechat.entity.ModelLike;
import com.sharemechat.entity.User;
import com.sharemechat.repository.ModelLikeRepository;
import com.sharemechat.repository.UserRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

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

    // =====================================================================
    // Card 1 Fase C: reputación propia + ranking
    // =====================================================================

    /** Reputación de la modelo: sus likes + insignia + progreso al siguiente escalón. */
    @Transactional(readOnly = true)
    public ModelReputationDTO getReputation(Long modelId) {
        long count = modelLikeRepository.countByModelUserId(modelId);
        String badge = resolveBadge(count);
        // Siguiente escalón = menor umbral estrictamente mayor que count.
        Badge next = nextBadge(count);
        return new ModelReputationDTO(
                count,
                badge,
                next != null ? next.code() : null,
                next != null ? next.threshold() : null,
                next != null ? (next.threshold() - count) : null);
    }

    /** Ranking Top-N por likes + la posición de la modelo que consulta (si queda fuera). */
    @Transactional(readOnly = true)
    public ModelRankingDTO getRanking(Long viewerId, int limit) {
        List<Object[]> rows = modelLikeRepository.topByLikes(PageRequest.of(0, Math.max(1, limit)));

        List<Long> ids = new ArrayList<>(rows.size());
        for (Object[] r : rows) ids.add((Long) r[0]);
        Map<Long, String> nicks = new LinkedHashMap<>();
        userRepository.findAllById(ids).forEach(u -> nicks.put(u.getId(), u.getNickname()));

        List<ModelRankingDTO.Entry> entries = new ArrayList<>(rows.size());
        int rank = 0;
        boolean viewerInTop = false;
        for (Object[] r : rows) {
            rank++;
            Long mid = (Long) r[0];
            long c = ((Number) r[1]).longValue();
            if (mid.equals(viewerId)) viewerInTop = true;
            entries.add(new ModelRankingDTO.Entry(rank, mid, nicks.getOrDefault(mid, ""), c, resolveBadge(c)));
        }

        ModelRankingDTO.Entry self = null;
        if (viewerId != null && !viewerInTop) {
            long myCount = modelLikeRepository.countByModelUserId(viewerId);
            int myRank = (int) modelLikeRepository.countModelsAboveLikes(myCount) + 1;
            String nick = userRepository.findById(viewerId).map(User::getNickname).orElse("");
            self = new ModelRankingDTO.Entry(myRank, viewerId, nick, myCount, resolveBadge(myCount));
        }
        return new ModelRankingDTO(entries, self);
    }

    /** Menor insignia cuyo umbral es estrictamente mayor que {@code count}; null si ya en el máximo. */
    static Badge nextBadge(long count) {
        Badge best = null;
        for (Badge b : BADGES) {
            if (b.threshold() > count && (best == null || b.threshold() < best.threshold())) {
                best = b;
            }
        }
        return best;
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
