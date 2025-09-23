package com.sharemechat.repository;

import com.sharemechat.entity.ModelDocument;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ModelDocumentRepository extends JpaRepository<ModelDocument, Long> {
    Optional<ModelDocument> findByUserId(Long userId);
    boolean existsByUserId(Long userId);
}
