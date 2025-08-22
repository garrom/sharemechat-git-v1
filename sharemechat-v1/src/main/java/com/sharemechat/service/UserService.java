package com.sharemechat.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.dto.*;
import com.sharemechat.entity.LoginResponse;
import com.sharemechat.entity.User;
import com.sharemechat.exception.EmailAlreadyInUseException;
import com.sharemechat.exception.InvalidCredentialsException;
import com.sharemechat.exception.UnderageModelException;
import com.sharemechat.exception.UserNotFoundException;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.security.JwtUtil;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.validation.annotation.Validated;

import java.time.LocalDate;
import java.time.Period;
import java.util.Optional;

@Service
@Validated
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    @Autowired
    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtUtil jwtUtil) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
    }

    @Transactional
    public UserDTO registerClient(@Valid UserRegisterDTO registerDTO) {
        if (userRepository.existsByEmail(registerDTO.getEmail())) {
            throw new EmailAlreadyInUseException("El email ya está en uso");
        }
        User user = new User();
        user.setEmail(registerDTO.getEmail());
        user.setPassword(passwordEncoder.encode(registerDTO.getPassword()));
        user.setRole(Constants.Roles.USER);
        user.setUserType(Constants.UserTypes.FORM_CLIENT);
        user.setUnsubscribe(false);
        User savedUser = userRepository.save(user);
        return mapToDTO(savedUser);
    }

    @Transactional
    public UserDTO registerModel(@Valid UserModelRegisterDTO registerDTO) {
        if (userRepository.existsByEmail(registerDTO.getEmail())) {
            throw new EmailAlreadyInUseException("El email ya está en uso");
        }
        LocalDate today = LocalDate.now();
        Period age = Period.between(registerDTO.getDateOfBirth(), today);
        if (age.getYears() < 18) {
            throw new UnderageModelException("Debes ser mayor de 18 años para registrarte como modelo");
        }
        User user = new User();
        user.setEmail(registerDTO.getEmail());
        user.setPassword(passwordEncoder.encode(registerDTO.getPassword()));
        user.setRole(Constants.Roles.USER);
        user.setUserType(Constants.UserTypes.FORM_MODEL);
        user.setDateOfBirth(registerDTO.getDateOfBirth());
        user.setUnsubscribe(false);
        user.setVerificationStatus(Constants.VerificationStatuses.PENDING);
        User savedUser = userRepository.save(user);
        return mapToDTO(savedUser);
    }

    public Optional<LoginResponse> login(@Valid UserLoginDTO loginDTO) {
        Optional<User> userOpt = userRepository.findByEmail(loginDTO.getEmail());
        if (userOpt.isEmpty()) {
            return Optional.empty();
        }
        User user = userOpt.get();
        if (!passwordEncoder.matches(loginDTO.getPassword(), user.getPassword())) {
            return Optional.empty();
        }
        if (user.getUnsubscribe()) {
            return Optional.empty();
        }
        String token = jwtUtil.generateToken(user.getEmail(), user.getRole(), user.getId());
        return Optional.of(new LoginResponse(token, mapToDTO(user)));
    }

    public UserDTO getUserById(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new UserNotFoundException("Usuario no encontrado con ID: " + id));
        return mapToDTO(user);
    }

    public User findByEmail(String email) {
        return userRepository.findByEmail(email).orElse(null);
    }

    @Transactional
    public UserDTO updateUser(Long id, @Valid UserUpdateDTO userUpdateDTO) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new UserNotFoundException("Usuario no encontrado con ID: " + id));

        // Normalizar: strings en blanco -> null
        String nickname = normalize(userUpdateDTO.getNickname());
        String name = normalize(userUpdateDTO.getName());
        String surname = normalize(userUpdateDTO.getSurname());
        String profilePicture = normalize(userUpdateDTO.getProfilePicture());
        String biography = normalize(userUpdateDTO.getBiography());
        String interests = normalize(userUpdateDTO.getInterests());

        // Nickname: validar unicidad solo si llega y cambia
        if (nickname != null) {
            if (userRepository.existsByNicknameAndIdNot(nickname, id)) {
                throw new EmailAlreadyInUseException("El nickname ya está en uso");
            }
            user.setNickname(nickname);
        }

        if (name != null) {
            user.setName(name);
        }

        if (surname != null) {
            user.setSurname(surname);
        }

        if (profilePicture != null) {
            user.setProfilePic(profilePicture);
        }

        if (userUpdateDTO.getDateOfBirth() != null) {
            user.setDateOfBirth(userUpdateDTO.getDateOfBirth());
        }

        if (biography != null) {
            user.setBiography(biography);
        }

        if (interests != null) {
            user.setInterests(interests);
        }

        User updatedUser = userRepository.save(user);
        return mapToDTO(updatedUser);
    }

    /** Devuelve null si el texto es null o está en blanco; en otro caso devuelve trim(). */
    private String normalize(String text) {
        return (text == null || text.trim().isEmpty()) ? null : text.trim();
    }


    public UserDTO mapToDTO(User user) {
        UserDTO dto = new UserDTO();
        dto.setId(user.getId());
        dto.setNickname(user.getNickname());
        dto.setEmail(user.getEmail());
        dto.setRole(user.getRole());
        dto.setUserType(user.getUserType());
        dto.setName(user.getName());
        dto.setSurname(user.getSurname());
        dto.setProfilePic(user.getProfilePic());
        dto.setDateOfBirth(user.getDateOfBirth());
        dto.setBiography(user.getBiography());
        dto.setInterests(user.getInterests());
        dto.setVerificationStatus(user.getVerificationStatus());
        dto.setIsPremium(user.getIsPremium());
        dto.setUnsubscribe(user.getUnsubscribe());
        dto.setCreatedAt(user.getCreatedAt());
        dto.setStartDate(user.getStartDate());
        dto.setEndDate(user.getEndDate());
        return dto;
    }
}