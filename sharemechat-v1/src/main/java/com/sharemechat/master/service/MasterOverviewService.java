package com.sharemechat.master.service;

import com.sharemechat.entity.Balance;
import com.sharemechat.entity.Model;
import com.sharemechat.entity.User;
import com.sharemechat.master.dto.MasterMeDTO;
import com.sharemechat.master.dto.MasterOverviewDTO;
import com.sharemechat.master.entity.Master;
import com.sharemechat.master.repository.MasterRepository;
import com.sharemechat.repository.BalanceRepository;
import com.sharemechat.repository.ModelRepository;
import com.sharemechat.repository.TransactionRepository;
import com.sharemechat.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * ADR-056 Fase S5.a.2: perfil (/me) + KPIs consolidados (/overview) del
 * Master autenticado para el dashboard post-login.
 *
 * <p>Los ingresos agregados que expone son display consolidado — no
 * determinan tramo. Tras la revision D4 (2026-07-30) el motor calcula
 * el % per modelo (individual); el Master recibe la suma de los pagos
 * individuales.
 */
@Service
public class MasterOverviewService {

    private static final Logger log = LoggerFactory.getLogger(MasterOverviewService.class);
    private static final int WINDOW_DAYS = 30;

    private final UserRepository userRepository;
    private final MasterRepository masterRepository;
    private final ModelRepository modelRepository;
    private final TransactionRepository transactionRepository;
    private final BalanceRepository balanceRepository;
    private final MasterContractService masterContractService;

    public MasterOverviewService(UserRepository userRepository,
                                  MasterRepository masterRepository,
                                  ModelRepository modelRepository,
                                  TransactionRepository transactionRepository,
                                  BalanceRepository balanceRepository,
                                  MasterContractService masterContractService) {
        this.userRepository = userRepository;
        this.masterRepository = masterRepository;
        this.modelRepository = modelRepository;
        this.transactionRepository = transactionRepository;
        this.balanceRepository = balanceRepository;
        this.masterContractService = masterContractService;
    }

    /** Perfil del Master autenticado, patron simetrico a ClientDTO/ModelDTO. */
    @Transactional(readOnly = true)
    public MasterMeDTO getMe(User user) {
        MasterMeDTO dto = new MasterMeDTO();
        dto.setUserId(user.getId());
        dto.setEmail(user.getEmail());
        dto.setNickname(user.getNickname());
        dto.setAccountStatus(user.getAccountStatus());
        dto.setVerificationStatus(user.getVerificationStatus());
        dto.setEmailVerified(user.getEmailVerifiedAt() != null);
        dto.setContractAccepted(safeIsContractAccepted(user.getId()));
        dto.setSaldoActual(currentBalance(user.getId()));
        masterRepository.findByUserId(user.getId()).ifPresent(m -> {
            dto.setCompanyName(m.getCompanyName());
            dto.setCompanyCountry(m.getCompanyCountry());
        });
        return dto;
    }

    /** KPIs consolidados para la tab Overview. */
    @Transactional(readOnly = true)
    public MasterOverviewDTO getOverview(User user) {
        MasterOverviewDTO out = new MasterOverviewDTO();

        LocalDateTime windowEnd = LocalDateTime.now();
        LocalDateTime windowStart = windowEnd.minusDays(WINDOW_DAYS);
        BigDecimal gross = transactionRepository.sumGrossBillingForMasterWindow(
                user.getId(), windowStart, windowEnd);
        out.setBilledGrossEur30d(gross != null ? gross.setScale(2, java.math.RoundingMode.HALF_UP)
                                                : BigDecimal.ZERO);

        List<Model> allModels = modelRepository.findAll();
        int active = 0;
        int pending = 0;
        for (Model m : allModels) {
            if (!user.getId().equals(m.getMasterUserId())) continue;
            userRepository.findById(m.getUserId()).ifPresent(u -> {
                // active vs pending: consideramos "active" cualquier modelo con
                // is_active=true; "pending" el resto (invitada sin activar, o
                // desactivada). Simplificado — si en el futuro discriminamos
                // "pending KYC" vs "desactivada", extender aqui.
            });
            User u = userRepository.findById(m.getUserId()).orElse(null);
            if (u == null) continue;
            if (Boolean.TRUE.equals(u.getIsActive())) active++;
            else pending++;
        }
        out.setActiveModelsCount(active);
        out.setPendingModelsCount(pending);

        out.setBalanceCurrent(currentBalance(user.getId()));

        // Ultimo payout del Master (busca cualquier balance PAYOUT_REQUEST
        // reciente propio). Simplificacion: no distinguimos entre
        // solicitados y ejecutados. Se puede refinar cuando S7 muestre
        // estados de payout.
        balanceRepository.findAll().stream()
                .filter(b -> user.getId().equals(b.getUserId())
                          && "PAYOUT_REQUEST".equals(b.getOperationType()))
                .sorted((a, b) -> b.getTimestamp().compareTo(a.getTimestamp()))
                .findFirst()
                .ifPresent(last -> {
                    out.setLastPayoutAt(last.getTimestamp());
                    out.setLastPayoutAmount(last.getAmount() != null
                            ? last.getAmount().abs()
                            : null);
                });

        out.setVerificationStatus(user.getVerificationStatus());
        out.setEmailVerified(user.getEmailVerifiedAt() != null);
        out.setContractAccepted(safeIsContractAccepted(user.getId()));

        // ADR-056 S7.b (2026-08-02): estado de suspensión para el banner
        // del dashboard Master. Un Master suspendido sigue pudiendo ver
        // este endpoint (whitelist en MasterSuspendedFilter para GET).
        masterRepository.findByUserId(user.getId()).ifPresent(m -> {
            out.setSuspendedAt(m.getSuspendedAt());
            out.setSuspensionReason(m.getSuspensionReason());
        });

        log.debug("[MASTER-OVERVIEW] userId={} gross30d={} active={} pending={} balance={}",
                user.getId(), out.getBilledGrossEur30d(),
                out.getActiveModelsCount(), out.getPendingModelsCount(),
                out.getBalanceCurrent());
        return out;
    }

    private BigDecimal currentBalance(Long userId) {
        return balanceRepository.findTopByUserIdOrderByTimestampDescIdDesc(userId)
                .map(Balance::getBalance)
                .orElse(BigDecimal.ZERO);
    }

    /**
     * Wrapper defensivo sobre {@link MasterContractService#isAcceptedCurrent}.
     * Si el manifest del contrato no esta disponible en S3 (bucket TEST sin
     * publicar aun, o timeout momentaneo), tratamos como "no aceptado" para
     * no romper el dashboard entero. El banner "contrato pendiente" ya empuja
     * al Master a firmar cuando el manifest exista.
     */
    private boolean safeIsContractAccepted(Long userId) {
        try {
            return masterContractService.isAcceptedCurrent(userId);
        } catch (Exception ex) {
            log.warn("[MASTER-OVERVIEW] no se pudo verificar aceptacion contrato userId={} (manifest no disponible?): {}",
                    userId, ex.getMessage());
            return false;
        }
    }
}
