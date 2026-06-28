package com.sharemechat.repository;

import com.sharemechat.entity.Complaint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface ComplaintRepository extends JpaRepository<Complaint, Long> {

    List<Complaint> findAllByOrderByCreatedAtDesc();

    List<Complaint> findAllByStatusOrderByCreatedAtDesc(String status);

    List<Complaint> findAllByCategoryOrderByCreatedAtDesc(String category);

    @Query("SELECT c FROM Complaint c WHERE c.status = :status AND c.category = :category ORDER BY c.createdAt DESC")
    List<Complaint> findAllByStatusAndCategoryOrderByCreatedAtDesc(@Param("status") String status,
                                                                  @Param("category") String category);

    /**
     * SLA query: complaints abiertas cuyo expected_resolution_at ya
     * paso. Usado por el admin panel para mostrar badge BREACH.
     */
    @Query("SELECT c FROM Complaint c WHERE c.expectedResolutionAt < :now AND c.status NOT IN ('RESOLVED','REJECTED','ESCALATED') ORDER BY c.expectedResolutionAt ASC")
    List<Complaint> findSlaBreached(@Param("now") LocalDateTime now);

    long countByStatus(String status);

    @Query("SELECT COUNT(c) FROM Complaint c WHERE c.expectedResolutionAt < :now AND c.status NOT IN ('RESOLVED','REJECTED','ESCALATED')")
    long countSlaBreached(@Param("now") LocalDateTime now);

    @Query("SELECT COUNT(c) FROM Complaint c WHERE c.expectedResolutionAt BETWEEN :now AND :soon AND c.status NOT IN ('RESOLVED','REJECTED','ESCALATED')")
    long countSlaNear(@Param("now") LocalDateTime now, @Param("soon") LocalDateTime soon);
}
