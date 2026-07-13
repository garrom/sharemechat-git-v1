package com.sharemechat.repository;

import com.sharemechat.entity.LivenessAttempt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * ADR-050 Fase B: acceso a la tabla {@code liveness_attempts}.
 */
public interface LivenessAttemptRepository extends JpaRepository<LivenessAttempt, Long> {

    /**
     * Query hot del guard {@code MatchingHandler}: ?"tiene este usuario
     * un pass de liveness vigente en UTC ahora?".
     *
     * <p>Devuelve la fila PASSED mas reciente cuyo {@code passed_until >
     * now}. Si es {@code Optional.empty()}, el user debe pasar un nuevo
     * challenge antes de conectar al match.
     */
    @Query("SELECT la FROM LivenessAttempt la "
            + "WHERE la.userId = :userId "
            + "AND la.status = 'PASSED' "
            + "AND la.passedUntil > :now "
            + "ORDER BY la.passedUntil DESC")
    List<LivenessAttempt> findValidPassedByUserIdOrderedDesc(@Param("userId") Long userId,
                                                              @Param("now") LocalDateTime now);

    /**
     * Wrapper conveniente: devuelve el primer pass vigente (el mas
     * reciente por passed_until) o vacio.
     */
    default Optional<LivenessAttempt> findValidPassedByUserId(Long userId, LocalDateTime now) {
        List<LivenessAttempt> hits = findValidPassedByUserIdOrderedDesc(userId, now);
        return hits.isEmpty() ? Optional.empty() : Optional.of(hits.get(0));
    }

    /**
     * ADR-050 D6 rate limit: cuenta los intentos con status = FAILED
     * en las ultimas 24h del usuario. Si >= max-failed-attempts-per-day
     * → aplica cooldown antes de permitir nuevo challenge.
     */
    @Query("SELECT COUNT(la) FROM LivenessAttempt la "
            + "WHERE la.userId = :userId "
            + "AND la.status = 'FAILED' "
            + "AND la.createdAt >= :sinceInclusive")
    long countFailedByUserSince(@Param("userId") Long userId,
                                 @Param("sinceInclusive") LocalDateTime sinceInclusive);

    /**
     * Intentos PENDING abiertos del usuario. Al abrir uno nuevo, el
     * service marca los pendientes viejos como EXPIRED para evitar
     * ambiguedad.
     */
    List<LivenessAttempt> findByUserIdAndStatus(Long userId, String status);
}
