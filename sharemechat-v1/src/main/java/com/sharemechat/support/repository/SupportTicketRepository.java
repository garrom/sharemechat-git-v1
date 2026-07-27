package com.sharemechat.support.repository;

import com.sharemechat.support.entity.SupportTicket;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

/**
 * ADR-054. Fase T1.
 */
public interface SupportTicketRepository extends JpaRepository<SupportTicket, Long> {

    List<SupportTicket> findAllByUserIdOrderByIdDesc(Long userId);

    Optional<SupportTicket> findByIdAndUserId(Long id, Long userId);

    /** D7 antifraude: cantidad de tickets del user en estados no terminales. */
    long countByUserIdAndStatusIn(Long userId, Collection<String> statuses);

    /** D7 antifraude: cantidad de tickets creados en ventana rolling. */
    long countByUserIdAndCreatedAtGreaterThanEqual(Long userId, LocalDateTime since);

    /** D7 flag informativo: cantidad de tickets compensados en ventana. */
    long countByUserIdAndStatusAndResolvedAtGreaterThanEqual(
            Long userId, String status, LocalDateTime since);

    /**
     * Listado admin con filtros opcionales (null = ignorar). Ordena por updatedAt DESC.
     */
    @Query("SELECT t FROM SupportTicket t " +
           "WHERE (:categoryFilter IS NULL OR t.category = :categoryFilter) " +
           "  AND (:statusFilter IS NULL OR t.status = :statusFilter) " +
           "ORDER BY t.updatedAt DESC")
    Page<SupportTicket> findFiltered(@Param("categoryFilter") String categoryFilter,
                                     @Param("statusFilter") String statusFilter,
                                     Pageable pageable);
}
