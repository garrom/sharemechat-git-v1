package com.sharemechat.repository;

import com.sharemechat.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    boolean existsByNickname(String nickname);

    boolean existsByNicknameAndIdNot(String nickname, Long id);

    List<User> findByUserType(String userType);

    List<User> findByUserTypeAndVerificationStatus(String userType, String verificationStatus);

    List<User> findByVerificationStatusIsNotNull();

    List<User> findByVerificationStatus(String verificationStatus);

    // Lock pesimista para serializar actualizaciones de “wallet” / rol / etc.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT u FROM User u WHERE u.id = :id")
    Optional<User> findByIdForUpdate(@Param("id") Long id);

    /**
     * Politica de cuentas dormidas (V37, 2026-07-23): candidatas a ser
     * marcadas dormant por el {@code AccountDormancyJob}. Criterios:
     * <ul>
     *   <li>{@code last_activity_at < :cutoff} (inactividad > dormancyDays).</li>
     *   <li>{@code is_active = true} (ya activa; no re-marcar dormant las
     *       que ya lo estan ni las baneadas).</li>
     *   <li>{@code unsubscribe = false} (respeta baja voluntaria).</li>
     *   <li>{@code account_status = :activeStatus} (respeta SUSPENDED/
     *       BANNED existentes).</li>
     * </ul>
     *
     * <p>Se excluyen cuentas con {@code last_activity_at IS NULL} para no
     * marcar dormant a cuentas recien creadas que aun no han logeado
     * despues del rollout de esta politica (evita un pico masivo en la
     * primera ejecucion). El primer login sella el timestamp y a partir
     * de ahi cuenta.
     */
    @Query("SELECT u FROM User u " +
           "WHERE u.lastActivityAt IS NOT NULL " +
           "  AND u.lastActivityAt < :cutoff " +
           "  AND u.isActive = TRUE " +
           "  AND u.unsubscribe = FALSE " +
           "  AND u.accountStatus = :activeStatus " +
           "ORDER BY u.lastActivityAt ASC")
    List<User> findDormancyCandidates(@Param("cutoff") LocalDateTime cutoff,
                                       @Param("activeStatus") String activeStatus,
                                       org.springframework.data.domain.Pageable pageable);

    default List<User> findDormancyCandidates(LocalDateTime cutoff,
                                                String activeStatus,
                                                int limit) {
        return findDormancyCandidates(cutoff, activeStatus,
                org.springframework.data.domain.PageRequest.of(0, limit));
    }
}