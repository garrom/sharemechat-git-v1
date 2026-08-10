package com.sharemechat.master.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.User;
import com.sharemechat.exception.NicknameAlreadyInUseException;
import com.sharemechat.util.NicknameNormalizer;
import com.sharemechat.exception.UnderageModelException;
import com.sharemechat.master.dto.RegisterMasterRequestDTO;
import com.sharemechat.master.entity.Master;
import com.sharemechat.master.repository.MasterRepository;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.service.EmailVerificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Period;
import java.util.Locale;

/**
 * ADR-056 D6: gestor del rol MASTER. Registro persona fisica simple con
 * flag opcional de empresa. Simetrico a
 * {@code UserService.registerModel} pero sin la creacion de fila Model
 * (crea fila Master 1-a-1 con users). Sin flujo de country-gating por
 * ahora (D6 v1: Master persona fisica sin restriccion geografica).
 *
 * <p>Post-registro (decision 2026-07-30, revision del comentario original):
 * <ul>
 *   <li>user.role = MASTER, user.user_type = FORM_MASTER (auto-promocion).
 *       A diferencia de Cliente/Modelo que arrancan como USER y se promocionan
 *       tras primera recarga / primeros docs, el Master no tiene gate PRELAUNCH
 *       aplicable: no consume ni produce servicio directo. El KYC + contrato
 *       Master se enforcean via banners del dashboard y validaciones en el
 *       endpoint de payout (deuda: bloquear payout hasta contrato firmado).</li>
 *   <li>Se crea fila Master con datos opcionales de empresa.</li>
 *   <li>Se dispara email de verificacion (patron estandar).</li>
 * </ul>
 *
 * <p>Si en el futuro se decide reintroducir revision admin previa antes de
 * activar el rol MASTER (Opcion 2 del analisis), habra que:
 * <ol>
 *   <li>Volver a asignar role=USER + user_type=FORM_MASTER aqui.</li>
 *   <li>Crear pagina intermedia {@code /dashboard-user-master}.</li>
 *   <li>Anyadir endpoint admin de promocion USER+FORM_MASTER -> MASTER.</li>
 * </ol>
 */
@Service
public class MasterService {

    private static final Logger log = LoggerFactory.getLogger(MasterService.class);

    private final UserRepository userRepository;
    private final MasterRepository masterRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailVerificationService emailVerificationService;

    public MasterService(UserRepository userRepository,
                         MasterRepository masterRepository,
                         PasswordEncoder passwordEncoder,
                         EmailVerificationService emailVerificationService) {
        this.userRepository = userRepository;
        this.masterRepository = masterRepository;
        this.passwordEncoder = passwordEncoder;
        this.emailVerificationService = emailVerificationService;
    }

    @Transactional
    public User registerMaster(RegisterMasterRequestDTO dto, String registerIp, String acceptLanguage) {
        final String email = sanitizeEmail(dto.getEmail());
        final String nickname = sanitizeNickname(dto.getNickname());
        final String password = dto.getPassword();

        if (email == null) {
            throw new IllegalArgumentException("El email no puede estar vacio");
        }
        if (nickname == null) {
            throw new IllegalArgumentException("El nickname es obligatorio");
        }
        if (nickname.length() < 3) {
            throw new IllegalArgumentException("El nickname necesita al menos 3 caracteres.");
        }
        if (!Boolean.TRUE.equals(dto.getConfirAdult())) {
            throw new IllegalArgumentException("Debes confirmar que eres mayor de 18 anyos");
        }
        if (!Boolean.TRUE.equals(dto.getAcceptedTerm())) {
            throw new IllegalArgumentException("Debes aceptar los terminos y condiciones");
        }

        if (userRepository.existsByNickname(nickname)) {
            throw new NicknameAlreadyInUseException("Ese nickname ya existe, debes elegir otro.");
        }
        if (userRepository.existsByEmail(email)) {
            // Patron simetrico a registerModel: si el email existe, se
            // silencia y no se crea (evitamos user enumeration). El caller
            // recibe null.
            return null;
        }

        // Mayoria de edad (mismo threshold que modelo).
        LocalDate dob = dto.getDateOfBirth();
        LocalDate today = LocalDate.now();
        Period age = Period.between(dob, today);
        if (age.getYears() < 18) {
            throw new UnderageModelException("Debes ser mayor de 18 anyos para registrarte como Master");
        }

        User user = new User();
        String uiLocale = normalizeUiLocale(dto.getUiLocale());
        if (uiLocale == null && acceptLanguage != null && !acceptLanguage.isBlank()) {
            uiLocale = acceptLanguage.substring(0, Math.min(2, acceptLanguage.length()))
                    .toLowerCase(Locale.ROOT);
        }
        user.setUiLocale(uiLocale != null ? uiLocale : "en");

        user.setEmail(email);
        user.setNickname(nickname);
        user.setPassword(passwordEncoder.encode(password));
        user.setRole(Constants.Roles.MASTER);   // auto-promocion (ver javadoc)
        user.setUserType(Constants.UserTypes.FORM_MASTER);
        user.setDateOfBirth(dob);
        user.setUnsubscribe(false);
        user.setIsActive(true);
        user.setAccountStatus(Constants.AccountStatuses.ACTIVE);
        user.setConfirAdult(true);
        user.setAcceptTerm(LocalDateTime.now());
        String termVersion = dto.getTermVersion();
        user.setTermVersion(termVersion != null && !termVersion.isBlank() ? termVersion : "v1");
        if (registerIp != null && !registerIp.isBlank()) {
            user.setRegistIp(registerIp.trim());
        }
        user.setVerificationStatus(Constants.VerificationStatuses.PENDING);
        user.setPasswordTemporary(false); // password creada por el propio Master, no temporal

        User savedUser = userRepository.save(user);

        // Crear fila Master 1-a-1.
        Master master = new Master();
        master.setUserId(savedUser.getId());
        master.setCompanyName(sanitizeOptional(dto.getCompanyName()));
        master.setCompanyRegistrationNumber(sanitizeOptional(dto.getCompanyRegistrationNumber()));
        master.setCompanyCountry(sanitizeCountryCode(dto.getCompanyCountry()));
        master.setOnboardedAt(LocalDateTime.now());
        masterRepository.save(master);

        emailVerificationService.issueProductVerification(savedUser);

        log.info("REGISTER_MASTER email={} nickname={} ip={}", email, nickname, registerIp);
        return savedUser;
    }

    private String sanitizeEmail(String s) {
        if (s == null) return null;
        String t = s.trim().toLowerCase(Locale.ROOT);
        return t.isEmpty() ? null : t;
    }

    private String sanitizeNickname(String s) {
        // Normalizacion industrial (NicknameNormalizer): espacios -> guion,
        // elimina caracteres no permitidos, recorta a 30. Fix friccion registro
        // 2026-08-10. Devuelve null si tras sanear queda vacio.
        String n = NicknameNormalizer.normalize(s);
        return n.isEmpty() ? null : n;
    }

    private String sanitizeOptional(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private String sanitizeCountryCode(String s) {
        if (s == null) return null;
        String t = s.trim().toUpperCase(Locale.ROOT);
        return t.length() == 2 ? t : null;
    }

    private String normalizeUiLocale(String s) {
        if (s == null) return null;
        String t = s.trim().toLowerCase(Locale.ROOT);
        return t.length() >= 2 ? t.substring(0, 2) : null;
    }
}
