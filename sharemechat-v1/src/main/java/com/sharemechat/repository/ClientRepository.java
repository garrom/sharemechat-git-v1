package com.sharemechat.repository;

import com.sharemechat.entity.Client;
import com.sharemechat.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ClientRepository extends JpaRepository<Client, Long> {

    Optional<Client> findByUser(User user);
}
