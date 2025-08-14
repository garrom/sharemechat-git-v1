package com.sharemechat.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.dto.UserDTO;
import com.sharemechat.entity.Model;
import com.sharemechat.entity.User;
import com.sharemechat.exception.UserNotFoundException;
import com.sharemechat.repository.ModelRepository;
import com.sharemechat.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class AdminService {

    private final UserRepository userRepository;
    private final UserService userService;
    private final ModelRepository modelRepository;

    public AdminService(UserRepository userRepository, UserService userService, ModelRepository modelRepository) {
        this.userRepository = userRepository;
        this.userService = userService;
        this.modelRepository = modelRepository;
    }

    /**
     * Lista candidatos/modelos usando SOLO verificationStatus.
     * - Sin filtro: devuelve todos los usuarios con verificationStatus no nulo.
     * - Con filtro: PENDING | APPROVED | REJECTED.
     */
    @Transactional(readOnly = true)
    public List<UserDTO> getModels(String verification) {
        List<User> list = (verification == null || verification.isBlank())
                ? userRepository.findByVerificationStatusIsNotNull()
                : userRepository.findByVerificationStatus(verification.toUpperCase());
        return list.stream().map(userService::mapToDTO).toList();
    }

    /**
     * Revisión robusta e idempotente:
     * - APPROVE  -> verification=APPROVED; si role != MODEL => role=MODEL; upsert en models.
     * - REJECT   -> verification=REJECTED; no toca role.
     * - PENDING  -> verification=PENDING; no toca role.
     *
     * Importante: nunca degradamos roles (si ya es MODEL/CLIENT, se mantiene).
     */
    @Transactional
    public String reviewModel(Long userId, String action) {
        if (action == null || action.isBlank()) {
            throw new IllegalArgumentException("Acción requerida");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException("Usuario no encontrado con ID: " + userId));

        final String previousRole = user.getRole();
        final String a = action.toUpperCase();

        switch (a) {
            case "APPROVE" -> {
                user.setVerificationStatus(Constants.VerificationStatuses.APPROVED);

                // Promoción a MODEL si aún no lo es (unidireccional; no se revierte)
                if (!Constants.Roles.MODEL.equals(user.getRole())) {
                    user.setRole(Constants.Roles.MODEL);
                }

                // Asegurar registro en tabla models (idempotente)
                if (!modelRepository.existsById(user.getId())) {
                    Model m = new Model();
                    m.setUser(user);      // @MapsId: user_id = user.id
                    // El resto de campos quedan en sus valores por defecto
                    modelRepository.save(m);
                }
            }
            case "REJECT" -> {
                user.setVerificationStatus(Constants.VerificationStatuses.REJECTED);
                // No tocar role (si ya era MODEL, se mantiene)
            }
            case "PENDING" -> {
                user.setVerificationStatus(Constants.VerificationStatuses.PENDING);
                // No tocar role (no degradamos nunca)
            }
            default -> throw new IllegalArgumentException("Acción no válida: " + action);
        }

        userRepository.save(user);

        return "Estado: " + user.getVerificationStatus()
                + " | Rol previo: " + previousRole
                + " | Rol actual: " + user.getRole()
                + " | Model row: " + (modelRepository.existsById(user.getId()) ? "OK" : "NO");
    }
}
