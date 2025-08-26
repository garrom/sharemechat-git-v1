package com.sharemechat.repository;

import com.sharemechat.entity.FavoriteClient;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface FavoriteClientRepository extends JpaRepository<FavoriteClient, Long> {
    boolean existsByModelIdAndClientId(Long modelId, Long clientId);
    List<FavoriteClient> findAllByModelIdOrderByCreatedAtDesc(Long modelId);
    long deleteByModelIdAndClientId(Long modelId, Long clientId);
}
