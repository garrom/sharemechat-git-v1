package com.sharemechat.repository;

import com.sharemechat.entity.StreamRecord;
import com.sharemechat.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface StreamRecordRepository extends JpaRepository<StreamRecord, Long> {

    // Sesiones abiertas (sin end_time) por cliente o modelo
    List<StreamRecord> findByClientAndEndTimeIsNull(User client);
    List<StreamRecord> findByModelAndEndTimeIsNull(User model);

    // Última sesión entre cliente y modelo
    Optional<StreamRecord> findTopByClientAndModelOrderByStartTimeDesc(User client, User model);

    // Rango por fechas, útil para reportes
    List<StreamRecord> findByStartTimeBetween(LocalDateTime from, LocalDateTime to);
}
