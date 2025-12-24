package com.sharemechat.repository;

import com.sharemechat.entity.ModelTierDailySnapshot;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Optional;
import java.util.List;

public interface ModelTierDailySnapshotRepository extends JpaRepository<ModelTierDailySnapshot, Long> {

    Optional<ModelTierDailySnapshot> findByModelIdAndSnapshotDate(Long modelId, LocalDate snapshotDate);

    Optional<ModelTierDailySnapshot> findTopByModelIdOrderBySnapshotDateDesc(Long modelId);

    List<ModelTierDailySnapshot> findByModelIdOrderBySnapshotDateDesc(Long modelId);

    Page<ModelTierDailySnapshot> findByModelIdOrderBySnapshotDateDesc(Long modelId, Pageable pageable);
}
