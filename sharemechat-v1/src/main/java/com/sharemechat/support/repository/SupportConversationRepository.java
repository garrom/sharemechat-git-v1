package com.sharemechat.support.repository;

import com.sharemechat.support.entity.SupportConversation;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface SupportConversationRepository
        extends JpaRepository<SupportConversation, Long> {

    Optional<SupportConversation> findFirstByUserIdAndResolutionStatusOrderByIdDesc(
            Long userId, String resolutionStatus);

    Optional<SupportConversation> findFirstByUserIdAndResolutionStatusInOrderByIdDesc(
            Long userId, Collection<String> resolutionStatuses);

    List<SupportConversation> findAllByUserIdOrderByIdDesc(Long userId);

    // ============================================================
    // Frente B.3.1 (ADR-046) - claim/release/counts.
    // ============================================================

    /**
     * Claim atomico. Solo actualiza si {@code assigned_agent_id IS NULL}. Devuelve
     * el numero de filas actualizadas (1 exito, 0 conflict). El caller compara con
     * 1 y decide 409 si es 0. Cambia el status a HUMAN_HANDLING de golpe.
     */
    @Modifying
    @Query("UPDATE SupportConversation c " +
           "SET c.assignedAgentId = :agentId, " +
           "    c.assignedProfileId = :profileId, " +
           "    c.assignedAt = :assignedAt, " +
           "    c.resolutionStatus = 'HUMAN_HANDLING', " +
           "    c.updatedAt = :now " +
           "WHERE c.id = :convId AND c.assignedAgentId IS NULL")
    int claimIfUnassigned(@Param("convId") Long convId,
                          @Param("agentId") Long agentId,
                          @Param("profileId") Long profileId,
                          @Param("assignedAt") LocalDateTime assignedAt,
                          @Param("now") LocalDateTime now);

    /**
     * Release atomico. Solo actualiza si la conversacion esta claimed por el
     * mismo agent. Vuelve a ESCALATED y limpia assigned_*. Devuelve rowCount.
     */
    @Modifying
    @Query("UPDATE SupportConversation c " +
           "SET c.assignedAgentId = NULL, " +
           "    c.assignedProfileId = NULL, " +
           "    c.assignedAt = NULL, " +
           "    c.resolutionStatus = 'ESCALATED', " +
           "    c.updatedAt = :now " +
           "WHERE c.id = :convId AND c.assignedAgentId = :agentId")
    int releaseIfOwnedBy(@Param("convId") Long convId,
                         @Param("agentId") Long agentId,
                         @Param("now") LocalDateTime now);

    /**
     * Race-check post-LLM: si la conversacion sigue sin claim, actualiza el
     * timestamp y devuelve 1. Si un admin hizo claim durante el LLM call,
     * devuelve 0 y el caller descarta la respuesta bot.
     */
    @Modifying
    @Query("UPDATE SupportConversation c " +
           "SET c.updatedAt = :now " +
           "WHERE c.id = :convId AND c.assignedAgentId IS NULL")
    int touchIfStillUnassigned(@Param("convId") Long convId,
                               @Param("now") LocalDateTime now);

    long countByResolutionStatusAndAssignedAgentIdIsNull(String resolutionStatus);

    long countByAssignedAgentIdAndResolutionStatus(Long assignedAgentId, String resolutionStatus);

    @Query("SELECT COUNT(c) FROM SupportConversation c " +
           "WHERE c.resolutionStatus = :status " +
           "  AND c.assignedAgentId IS NOT NULL " +
           "  AND c.assignedAgentId <> :excludeAgentId")
    long countByStatusAndAssignedToOthers(@Param("status") String status,
                                          @Param("excludeAgentId") Long excludeAgentId);

    long countByAssignedProfileIdAndResolutionStatus(Long assignedProfileId, String resolutionStatus);

    /**
     * Listado con filtros opcionales. Si algun parametro es null, se ignora ese
     * filtro. {@code unassignedOnly=true} restringe a assigned_agent_id IS NULL.
     */
    @Query("SELECT c FROM SupportConversation c " +
           "WHERE (:statusFilter IS NULL OR c.resolutionStatus = :statusFilter) " +
           "  AND (:agentFilter IS NULL OR c.assignedAgentId = :agentFilter) " +
           "  AND (:unassignedOnly = false OR c.assignedAgentId IS NULL) " +
           "ORDER BY c.updatedAt DESC")
    Page<SupportConversation> findFiltered(@Param("statusFilter") String statusFilter,
                                            @Param("agentFilter") Long agentFilter,
                                            @Param("unassignedOnly") boolean unassignedOnly,
                                            Pageable pageable);
}
