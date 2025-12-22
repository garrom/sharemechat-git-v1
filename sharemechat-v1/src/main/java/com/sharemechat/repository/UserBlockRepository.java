package com.sharemechat.repository;

import com.sharemechat.entity.UserBlock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface UserBlockRepository extends JpaRepository<UserBlock, Long> {

    Optional<UserBlock> findByBlockerUserIdAndBlockedUserId(Long blockerUserId, Long blockedUserId);

    List<UserBlock> findAllByBlockerUserIdOrderByCreatedAtDesc(Long blockerUserId);

    // Lista bloqueos “entrantes”: quién me ha bloqueado (para UI en lado receptor)
    List<UserBlock> findAllByBlockedUserIdOrderByCreatedAtDesc(Long blockedUserId);

    void deleteByBlockerUserIdAndBlockedUserId(Long blockerUserId, Long blockedUserId);

    @Query("""
        select (count(ub) > 0)
        from UserBlock ub
        where (ub.blockerUserId = :a and ub.blockedUserId = :b)
           or (ub.blockerUserId = :b and ub.blockedUserId = :a)
    """)
    boolean existsBlockBetween(@Param("a") Long a, @Param("b") Long b);

    // === Batch: ids bloqueados por "me" dentro de una lista (para UI) ===
    @Query("""
        select ub.blockedUserId
        from UserBlock ub
        where ub.blockerUserId = :me
          and ub.blockedUserId in :ids
    """)
    List<Long> findBlockedIdsByBlockerIn(@Param("me") Long me, @Param("ids") Collection<Long> ids);

    @Query("""
    select ub.blockerUserId
    from UserBlock ub
    where ub.blockedUserId = :me
      and ub.blockerUserId in :ids
    """)
    // Batch: devuelve IDs de usuarios (de una lista) que ME han bloqueado
    List<Long> findBlockerIdsWhoBlockedMeIn(@Param("me") Long me, @Param("ids") Collection<Long> ids);
}
