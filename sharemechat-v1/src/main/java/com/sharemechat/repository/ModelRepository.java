package com.sharemechat.repository;

import com.sharemechat.entity.Model;
import com.sharemechat.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ModelRepository extends JpaRepository<Model, Long> {
    Optional<Model> findByUser(User user);
    boolean existsByUserId(Long userId);
}
