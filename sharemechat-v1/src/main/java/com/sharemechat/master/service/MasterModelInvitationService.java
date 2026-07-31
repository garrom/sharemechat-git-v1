package com.sharemechat.master.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.EmailVerificationToken;
import com.sharemechat.entity.Model;
import com.sharemechat.entity.User;
import com.sharemechat.exception.NicknameAlreadyInUseException;
import com.sharemechat.master.dto.CreateMasterModelRequestDTO;
import com.sharemechat.repository.EmailVerificationTokenRepository;
import com.sharemechat.repository.ModelRepository;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.service.EmailVerificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Locale;
import java.util.UUID;

/**
 * ADR-056 D7 — flujo de invitacion Master → modelo.
 *
 * <p>El Master rellena email + nickname. El sistema:
 * <ol>
 *   <li>Crea User(role=USER, user_type=FORM_MODEL, password_temporary=1,
 *       password=random placeholder que no permite login).</li>
 *   <li>Crea fila Model(user_id, master_user_id=masterId).</li>
 *   <li>Emite token de activacion via {@link EmailVerificationService}
 *       con context {@code MASTER_MODEL_INVITATION}.</li>
 *   <li>El email lleva a un link donde la modelo genera su propia password
 *       (endpoint {@code POST /api/masters/models/activate/{token}}).</li>
 * </ol>
 *
 * <p>Elimina el vector de coaccion GDPR (Master nunca conoce la password
 * de sus modelos). La modelo firma contrato + KYC bajo control exclusivo
 * de sus credenciales.
 */
@Service
public class MasterModelInvitationService {

    private static final Logger log = LoggerFactory.getLogger(MasterModelInvitationService.class);
    private static final String CONTEXT_MASTER_INVITATION =
            EmailVerificationService.CONTEXT_MASTER_INVITATION;

    private final UserRepository userRepository;
    private final ModelRepository modelRepository;
    private final EmailVerificationService emailVerificationService;
    private final EmailVerificationTokenRepository tokenRepository;
    private final PasswordEncoder passwordEncoder;

    public MasterModelInvitationService(UserRepository userRepository,
                                         ModelRepository modelRepository,
                                         EmailVerificationService emailVerificationService,
                                         EmailVerificationTokenRepository tokenRepository,
                                         PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.modelRepository = modelRepository;
        this.emailVerificationService = emailVerificationService;
        this.tokenRepository = tokenRepository;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * Invita a una modelo a operar bajo el umbrella del Master.
     * Idempotente sobre email existente: si el email ya esta registrado
     * y NO pertenece al mismo Master → error (evitar capturar modelos
     * de otro Master). Si pertenece al mismo Master → devuelve la
     * fila existente sin crear duplicado.
     *
     * @return userId de la modelo (nuevo o existente).
     */
    @Transactional
    public Long inviteModel(Long masterUserId, CreateMasterModelRequestDTO dto) {
        if (masterUserId == null || masterUserId <= 0) {
            throw new IllegalArgumentException("masterUserId invalido");
        }
        String email = sanitizeEmail(dto.getModelEmail());
        String nickname = sanitizeNickname(dto.getModelNickname());

        if (email == null) throw new IllegalArgumentException("modelEmail obligatorio");
        if (nickname == null) throw new IllegalArgumentException("modelNickname obligatorio");

        // Idempotencia: si el email ya existe, comprobar ownership.
        User existing = userRepository.findByEmail(email).orElse(null);
        if (existing != null) {
            Long existingMasterId = modelRepository
                    .findMasterUserIdByModelUserId(existing.getId())
                    .orElse(null);
            if (existingMasterId != null && existingMasterId.equals(masterUserId)) {
                // Misma modelo, mismo Master → reemitir invitacion (por si la
                // primera no llego). issueVerification invalida el token
                // anterior (consumedAt=now) y emite uno nuevo.
                emailVerificationService.issueVerification(
                        existing, masterUserId, CONTEXT_MASTER_INVITATION);
                log.info("[MASTER-INVITE] reemitida invitacion email={} masterId={} modelId={}",
                        email, masterUserId, existing.getId());
                return existing.getId();
            }
            // Email ocupado por otro user (individual o de otro Master).
            throw new IllegalArgumentException("El email ya esta registrado en otra cuenta");
        }

        if (userRepository.existsByNickname(nickname)) {
            throw new NicknameAlreadyInUseException("Ese nickname ya existe, elige otro");
        }

        // Crear User con password placeholder aleatoria + temporary=1.
        // La modelo genera su propia password al activar el token.
        String placeholderPassword = UUID.randomUUID().toString() + UUID.randomUUID().toString();

        User user = new User();
        user.setEmail(email);
        user.setNickname(nickname);
        user.setPassword(passwordEncoder.encode(placeholderPassword));
        user.setPasswordTemporary(true);
        user.setRole(Constants.Roles.USER);
        user.setUserType(Constants.UserTypes.FORM_MODEL);
        user.setUiLocale("es");
        user.setUnsubscribe(false);
        user.setIsActive(true);
        user.setAccountStatus(Constants.AccountStatuses.ACTIVE);
        user.setConfirAdult(true);   // el Master declara mayor de edad al invitar
        user.setAcceptTerm(null);    // la modelo aceptara contrato modelo tras activar
        user.setVerificationStatus(Constants.VerificationStatuses.PENDING);
        User savedUser = userRepository.save(user);

        // Fila Model con master_user_id set. NO setear userId manualmente:
        // Model usa @MapsId, JPA copia user.id al @Id durante persist. Setearlo
        // hace que Spring Data JPA save() interprete la entidad como detached y
        // ejecute merge() -> UPDATE sobre fila inexistente -> StaleObjectStateException.
        Model model = new Model();
        model.setUser(savedUser);
        model.setMasterUserId(masterUserId);
        modelRepository.save(model);

        // Emitir token de activacion.
        emailVerificationService.issueVerification(savedUser, masterUserId, CONTEXT_MASTER_INVITATION);
        log.info("[MASTER-INVITE] modelo invitada masterId={} modelId={} email={} nickname={}",
                masterUserId, savedUser.getId(), email, nickname);
        return savedUser.getId();
    }

    /**
     * Activa la cuenta de una modelo invitada. Consume el token, establece
     * password personal (bajo control de la modelo), marca
     * password_temporary=false, first_password_change_at=now,
     * email_verified_at=now.
     *
     * @return userId de la modelo activada.
     */
    @Transactional
    public Long activate(String rawToken, String newPassword) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new IllegalArgumentException("Token requerido");
        }
        if (newPassword == null || newPassword.length() < 10 || newPassword.contains(" ")) {
            throw new IllegalArgumentException("Password invalida (min 10 chars, sin espacios)");
        }
        // Consume el token; el service verifica expiracion + marca email_verified_at.
        var result = emailVerificationService.consumeVerificationToken(rawToken);
        Object userIdObj = result.get("userId");
        Long userId = userIdObj instanceof Number ? ((Number) userIdObj).longValue() : null;
        if (userId == null) {
            throw new IllegalStateException("Token consumido pero userId ausente");
        }

        // Verificar que la fila users existe y esta pendiente de activacion.
        User user = userRepository.findById(userId).orElseThrow(
                () -> new IllegalArgumentException("Usuario no encontrado"));

        // Solo activar si estaba password_temporary=true (defensa contra
        // reuso del token para user activo normal).
        if (!user.isPasswordTemporary()) {
            throw new IllegalStateException(
                    "Usuario ya activado previamente (password no temporal)");
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        user.setPasswordTemporary(false);
        user.setFirstPasswordChangeAt(LocalDateTime.now());
        userRepository.save(user);

        log.info("[MASTER-INVITE] modelo activada userId={} email={}", user.getId(), user.getEmail());
        return user.getId();
    }

    // ============================================================
    // Helpers
    // ============================================================
    private String sanitizeEmail(String s) {
        if (s == null) return null;
        String t = s.trim().toLowerCase(Locale.ROOT);
        return t.isEmpty() ? null : t;
    }

    private String sanitizeNickname(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
