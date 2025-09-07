package com.sharemechat.repository;

import com.sharemechat.entity.FavoriteClient;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface FavoriteClientRepository extends JpaRepository<FavoriteClient, Long> {
    boolean existsByModelIdAndClientId(Long modelId, Long clientId);
    Optional<FavoriteClient> findByModelIdAndClientId(Long modelId, Long clientId);
    List<FavoriteClient> findAllByModelIdAndStatusOrderByCreatedAtDesc(Long modelId, String status);
    // soft delete
    long deleteByModelIdAndClientId(Long modelId, Long clientId);


}
