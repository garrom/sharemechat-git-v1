package com.sharemechat.repository;

import com.sharemechat.entity.ClientDocument;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ClientDocumentRepository extends JpaRepository<ClientDocument, Long> {
    Optional<ClientDocument> findByUserId(Long userId);
    boolean existsByUserId(Long userId);
}
