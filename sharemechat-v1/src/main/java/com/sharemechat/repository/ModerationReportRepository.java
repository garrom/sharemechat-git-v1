package com.sharemechat.repository;

import com.sharemechat.entity.ModerationReport;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ModerationReportRepository extends JpaRepository<ModerationReport, Long> {

    List<ModerationReport> findAllByOrderByCreatedAtDesc();

    List<ModerationReport> findAllByStatusOrderByCreatedAtDesc(String status);

    List<ModerationReport> findAllByReportedUserIdOrderByCreatedAtDesc(Long reportedUserId);

    List<ModerationReport> findAllByReporterUserIdOrderByCreatedAtDesc(Long reporterUserId);
}