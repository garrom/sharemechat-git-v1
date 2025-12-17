package com.sharemechat.repository;

import com.sharemechat.entity.UserBlock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserBlockRepository extends JpaRepository<UserBlock, Long> {

    Optional<UserBlock> findByBlockerUserIdAndBlockedUserId(Long blockerUserId, Long blockedUserId);

    boolean existsByBlockerUserIdAndBlockedUserId(Long blockerUserId, Long blockedUserId);

    List<UserBlock> findAllByBlockerUserIdOrderByCreatedAtDesc(Long blockerUserId);

    void deleteByBlockerUserIdAndBlockedUserId(Long blockerUserId, Long blockedUserId);

    @Query("""
        select (count(ub) > 0)
        from UserBlock ub
        where (ub.blockerUserId = :a and ub.blockedUserId = :b)
           or (ub.blockerUserId = :b and ub.blockedUserId = :a)
    """)
    boolean existsBlockBetween(@Param("a") Long a, @Param("b") Long b);

}
