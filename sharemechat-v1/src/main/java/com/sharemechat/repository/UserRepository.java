package com.sharemechat.repository;

import com.sharemechat.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    boolean existsByNickname(String nickname);

    boolean existsByNicknameAndIdNot(String nickname, Long id);

    List<User> findByUserType(String userType);

    List<User> findByUserTypeAndVerificationStatus(String userType, String verificationStatus);

    List<User> findByVerificationStatusIsNotNull();

    List<User> findByVerificationStatus(String verificationStatus);

    // Lock pesimista para serializar actualizaciones de “wallet” / rol / etc.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT u FROM User u WHERE u.id = :id")
    Optional<User> findByIdForUpdate(@Param("id") Long id);
}