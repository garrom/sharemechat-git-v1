package com.sharemechat.service;

import com.sharemechat.config.AccountDormancyProperties;
import com.sharemechat.constants.Constants;
import com.sharemechat.entity.User;
import com.sharemechat.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;

/**
 * Politica de cuentas dormidas (2026-07-23). Tres operaciones:
 *
 * <ul>
 *   <li>{@link #recordActivity(Long)}: hook llamado desde login/refresh
 *       exitoso. Actualiza {@code last_activity_at=NOW()} y auto-reactiva
 *       si la cuenta estaba dormant.</li>
 *   <li>{@link #markDormantBatch(int)}: invocado por
 *       {@code AccountDormancyJob} semanal. Marca dormant a los usuarios
 *       con {@code last_activity_at < NOW() - dormancyDays}, respetando
 *       bans/unsubscribes existentes.</li>
 *   <li>{@link #reactivate(Long)}: endpoint admin para reactivar
 *       manualmente una cuenta dormant.</li>
 * </ul>
 *
 * <p>Distinguimos dormant vs ban real:
 * <ul>
 *   <li>{@code is_active=false, dormant_since IS NOT NULL} -> dormant,
 *       auto-reactivable al login.</li>
 *   <li>{@code is_active=false, dormant_since IS NULL} -> ban admin,
 *       no auto-reactivable.</li>
 *   <li>{@code account_status IN (SUSPENDED, BANNED)} -> bloqueo por
 *       otro motivo, no lo tocamos.</li>
 * </ul>
 */
@Service
public class AccountDormancyService {

    private static final Logger log = LoggerFactory.getLogger(AccountDormancyService.class);

    private final UserRepository userRepository;
    private final AccountDormancyProperties props;

    public AccountDormancyService(UserRepository userRepository,
                                   AccountDormancyProperties props) {
        this.userRepository = userRepository;
        this.props = props;
    }

    /**
     * Hook llamado desde {@code AuthController.login} y
     * {@code AuthController.refresh} tras emitir tokens con exito.
     * Actualiza {@code last_activity_at}. Si la cuenta estaba dormant
     * (marcada por el job), auto-reactiva: {@code is_active=true},
     * {@code dormant_since=NULL}.
     *
     * <p>Best-effort: cualquier excepcion se traga y loguea WARN. El
     * hook NO debe bloquear el flujo de login.
     */
    @Transactional
    public void recordActivity(Long userId) {
        if (userId == null) return;
        try {
            User user = userRepository.findById(userId).orElse(null);
            if (user == null) return;
            LocalDateTime nowUtc = LocalDateTime.now(ZoneOffset.UTC);
            user.setLastActivityAt(nowUtc);
            if (user.getDormantSince() != null) {
                user.setDormantSince(null);
                user.setIsActive(true);
                log.info("[DORMANCY] auto-reactivate userId={} tras login/refresh",
                        userId);
            }
            userRepository.save(user);
        } catch (Exception ex) {
            log.warn("[DORMANCY] recordActivity FAIL userId={}: {}",
                    userId, ex.getMessage());
        }
    }

    /**
     * Marca dormant a los usuarios con inactividad prolongada. Invocado
     * por {@code AccountDormancyJob} semanal. Respeta filtros de bans y
     * unsubscribes: NO tocamos cuentas que ya estan gestionadas por otros
     * mecanismos.
     *
     * @param limit  numero maximo de cuentas a marcar en esta pasada
     *               (defensa contra jobs largos si hay un backlog masivo
     *               tras rollout inicial).
     * @return numero de cuentas marcadas dormant en esta ejecucion.
     */
    @Transactional
    public int markDormantBatch(int limit) {
        if (!props.isEnabled()) {
            log.info("[DORMANCY] job disabled via property, skip");
            return 0;
        }
        LocalDateTime nowUtc = LocalDateTime.now(ZoneOffset.UTC);
        LocalDateTime cutoff = nowUtc.minusDays(props.getDormancyDays());

        List<User> candidates = userRepository.findDormancyCandidates(
                cutoff,
                Constants.AccountStatuses.ACTIVE,
                limit);

        int marked = 0;
        for (User u : candidates) {
            u.setIsActive(false);
            u.setDormantSince(nowUtc);
            marked++;
        }
        if (marked > 0) {
            userRepository.saveAll(candidates);
            log.warn("[DORMANCY] marcadas {} cuentas como dormant (cutoff={}, dormancyDays={})",
                    marked, cutoff, props.getDormancyDays());
        }
        return marked;
    }

    /**
     * Reactivacion manual desde el panel admin. Distinto del auto-reactivate
     * del login: aplicable para casos donde el usuario no puede logear
     * (email perdido, etc). Solo revierte el estado dormant; si la cuenta
     * estaba bloqueada por otro motivo (ban admin, account_status), NO
     * cambia esas dimensiones.
     */
    @Transactional
    public void reactivate(Long userId) {
        if (userId == null) throw new IllegalArgumentException("userId requerido");
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado: " + userId));
        if (user.getDormantSince() == null) {
            log.info("[DORMANCY] reactivate userId={} no estaba dormant, no-op", userId);
            return;
        }
        user.setDormantSince(null);
        user.setIsActive(true);
        user.setLastActivityAt(LocalDateTime.now(ZoneOffset.UTC));
        userRepository.save(user);
        log.warn("[DORMANCY] admin reactivate userId={}", userId);
    }
}
