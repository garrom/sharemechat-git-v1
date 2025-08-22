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

import java.time.LocalDate;
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
        final String currentVerification = user.getVerificationStatus(); // puede ser null

        // Regla 1: REJECT es terminal. Si ya está REJECTED, no permitimos volver a PENDING/APROVED.
        if (Constants.VerificationStatuses.REJECTED.equals(currentVerification)
                && ("APPROVE".equals(a) || "PENDING".equals(a))) {
            throw new IllegalStateException("La modelo fue RECHAZADA definitivamente. No puede volver a PENDING ni APPROVED.");
        }

        switch (a) {
            case "APPROVE" -> {
                // Solo aprobamos si no está REJECTED (ya validado arriba)
                user.setVerificationStatus(Constants.VerificationStatuses.APPROVED);

                // Promoción a MODEL si aún no lo es
                if (!Constants.Roles.MODEL.equals(user.getRole())) {
                    user.setRole(Constants.Roles.MODEL);
                    if (user.getStartDate() == null) {
                        user.setStartDate(java.time.LocalDate.now());
                    }
                }

                // Asegurar registro en tabla models (idempotente)
                if (!modelRepository.existsById(user.getId())) {
                    Model m = new Model();
                    m.setUser(user); // @MapsId: user_id = user.id
                    modelRepository.save(m);
                }
            }
            case "REJECT" -> {
                // Regla 2: degradar a USER si era MODEL, si ya es USER, se queda igual
                user.setVerificationStatus(Constants.VerificationStatuses.REJECTED);
                if (Constants.Roles.MODEL.equals(user.getRole())) {
                    user.setRole(Constants.Roles.USER);
                }
                user.setEndDate(java.time.LocalDate.now());
            }
            case "PENDING" -> {
                // Solo permitimos PENDING si nunca fue REJECTED antes
                if (Constants.VerificationStatuses.REJECTED.equals(currentVerification)) {
                    throw new IllegalStateException("La modelo fue RECHAZADA definitivamente. No puede volver a PENDING.");
                }
                user.setVerificationStatus(Constants.VerificationStatuses.PENDING);
                // No tocamos el role.
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
