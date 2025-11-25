package com.sharemechat.repository;

import com.sharemechat.entity.UserTrialStream;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserTrialStreamRepository extends JpaRepository<UserTrialStream, Long> {

    // Sesión trial activa (sin end_time) para un viewer (USER) y una modelo concretos
    Optional<UserTrialStream> findTopByViewer_IdAndModel_IdAndEndTimeIsNullOrderByStartTimeDesc(
            Long viewerId, Long modelId
    );

    // Cualquier sesión trial activa de ese viewer (da igual la modelo)
    Optional<UserTrialStream> findTopByViewer_IdAndEndTimeIsNullOrderByStartTimeDesc(Long viewerId);

    // Última sesión trial YA CERRADA de ese viewer (por end_time más reciente)
    Optional<UserTrialStream> findTopByViewer_IdAndEndTimeIsNotNullOrderByEndTimeDesc(Long viewerId);


    // Número de sesiones trial YA CERRADAS de ese viewer (para limitar a 3 slots)
    long countByViewer_IdAndEndTimeIsNotNull(Long viewerId);

    // Sesiones trial YA CERRADAS de una modelo en un rango de tiempo (para cómputo de minutos facturados)
    java.util.List<UserTrialStream> findByModel_IdAndEndTimeIsNotNullAndEndTimeAfter(Long modelId, java.time.LocalDateTime since);

}
