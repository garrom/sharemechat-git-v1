package com.sharemechat.repository;

import com.sharemechat.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
    boolean existsByNicknameAndIdNot(String nickname, Long id);
    List<User> findByUserType(String userType);
    List<User> findByUserTypeAndVerificationStatus(String userType, String verificationStatus);
    List<User> findByVerificationStatusIsNotNull();
    List<User> findByVerificationStatus(String verificationStatus);

}