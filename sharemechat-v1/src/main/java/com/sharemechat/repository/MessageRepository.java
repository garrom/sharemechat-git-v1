package com.sharemechat.repository;

import com.sharemechat.entity.Message;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface MessageRepository extends JpaRepository<Message, Long> {

    @Query("""
      SELECT m FROM Message m
      WHERE (m.senderId = :a AND m.recipientId = :b) OR (m.senderId = :b AND m.recipientId = :a)
      ORDER BY m.createdAt DESC, m.id DESC
    """)
    List<Message> findBetween(@Param("a") Long a, @Param("b") Long b, Pageable pageable);

    @Modifying
    @Query("UPDATE Message m SET m.readAt = CURRENT_TIMESTAMP WHERE m.recipientId = :me AND m.senderId = :peer AND m.readAt IS NULL")
    int markRead(@Param("me") Long me, @Param("peer") Long peer);

    @Modifying
    @Query("DELETE FROM Message m WHERE m.createdAt < :limit")
    int deleteOlderThan(@Param("limit") LocalDateTime limit);

    // Mantener solo los N más recientes por conversation_key
    @Modifying
    @Query(value = """
      DELETE FROM messages
      WHERE id IN (
        SELECT id FROM (
          SELECT id,
                 ROW_NUMBER() OVER (PARTITION BY conversation_key ORDER BY created_at DESC, id DESC) AS rn
          FROM messages
        ) t
        WHERE t.rn > :keep
      )
    """, nativeQuery = true)
    int trimOversizeConversations(@Param("keep") int keep);
}
