package com.sharemechat.master.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.Balance;
import com.sharemechat.entity.Model;
import com.sharemechat.entity.PayoutRequest;
import com.sharemechat.entity.User;
import com.sharemechat.master.dto.AdminMasterDetailDTO;
import com.sharemechat.master.dto.AdminMasterListItemDTO;
import com.sharemechat.master.entity.Master;
import com.sharemechat.master.entity.MasterModelSplit;
import com.sharemechat.master.repository.MasterModelSplitRepository;
import com.sharemechat.master.repository.MasterRepository;
import com.sharemechat.repository.BalanceRepository;
import com.sharemechat.repository.ModelRepository;
import com.sharemechat.repository.PayoutRequestRepository;
import com.sharemechat.repository.TransactionRepository;
import com.sharemechat.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * ADR-056 Fase S7.a: soporte para el panel admin de Masters. Solo
 * consultas — la suspensión D11 (S7.b) irá en un servicio separado
 * con auditoría.
 *
 * <p>Enriquecimiento en el servicio (no JPA JOIN nativo): batch lookup
 * de {@link User} por userId + resolución del contrato y balance por
 * consulta separada. El coste extra por página no compensa complicar
 * el modelo JPA de una tabla que va a crecer despacio.
 */
@Service
public class AdminMasterService {

    private static final Logger log = LoggerFactory.getLogger(AdminMasterService.class);

    private final MasterRepository masterRepository;
    private final UserRepository userRepository;
    private final ModelRepository modelRepository;
    private final BalanceRepository balanceRepository;
    private final MasterContractService masterContractService;
    private final MasterModelSplitRepository masterModelSplitRepository;
    private final PayoutRequestRepository payoutRequestRepository;
    private final TransactionRepository transactionRepository;

    public AdminMasterService(MasterRepository masterRepository,
                              UserRepository userRepository,
                              ModelRepository modelRepository,
                              BalanceRepository balanceRepository,
                              MasterContractService masterContractService,
                              MasterModelSplitRepository masterModelSplitRepository,
                              PayoutRequestRepository payoutRequestRepository,
                              TransactionRepository transactionRepository) {
        this.masterRepository = masterRepository;
        this.userRepository = userRepository;
        this.modelRepository = modelRepository;
        this.balanceRepository = balanceRepository;
        this.masterContractService = masterContractService;
        this.masterModelSplitRepository = masterModelSplitRepository;
        this.payoutRequestRepository = payoutRequestRepository;
        this.transactionRepository = transactionRepository;
    }

    /**
     * Listado admin paginado + filtros básicos aplicados en Java (la tabla
     * masters va a crecer despacio; no compensa por ahora un Specification
     * o query dinámica).
     *
     * @param q búsqueda substring sobre email/nickname/companyName (case-insensitive)
     * @param kycStatus filtro exacto sobre users.verification_status (PENDING|APPROVED|REJECTED)
     * @param emailVerified filtro tri-state (null=todos)
     * @param contractAccepted filtro tri-state (null=todos)
     */
    public Map<String, Object> listMasters(int page, int size, String q,
                                           String kycStatus, Boolean emailVerified,
                                           Boolean contractAccepted, Boolean suspended) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(size, 100));

        Page<Master> pageResult = masterRepository.findAll(
                PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "userId")));

        Set<Long> userIds = pageResult.getContent().stream()
                .map(Master::getUserId)
                .collect(Collectors.toSet());
        Map<Long, User> userById = userIds.isEmpty()
                ? Map.of()
                : userRepository.findAllById(userIds).stream()
                        .collect(Collectors.toMap(User::getId, u -> u));

        String qNorm = q != null ? q.trim().toLowerCase() : null;

        List<AdminMasterListItemDTO> items = pageResult.getContent().stream()
                .map(m -> toListItem(m, userById.get(m.getUserId())))
                .filter(dto -> filterMatches(dto, qNorm, kycStatus, emailVerified, contractAccepted, suspended))
                .toList();

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("items", items);
        out.put("page", pageResult.getNumber());
        out.put("size", pageResult.getSize());
        out.put("totalPages", pageResult.getTotalPages());
        out.put("totalElements", pageResult.getTotalElements());
        return out;
    }

    /**
     * Detalle drill-down con modelos bajo la cuenta + KPIs 30d. Todas
     * las lecturas contra repositorios ya existentes (no queries
     * nuevas específicas de admin).
     */
    public AdminMasterDetailDTO getDetail(Long masterUserId) {
        Master master = masterRepository.findByUserId(masterUserId)
                .orElseThrow(() -> new IllegalArgumentException("Master no encontrado: " + masterUserId));
        User user = userRepository.findById(masterUserId).orElse(null);
        AdminMasterListItemDTO head = toListItem(master, user);

        List<Model> models = modelRepository.findAllByMasterUserIdOrderByUserIdAsc(masterUserId);
        Set<Long> modelUserIds = models.stream().map(Model::getUserId).collect(Collectors.toSet());
        Map<Long, User> modelUserById = modelUserIds.isEmpty()
                ? Map.of()
                : userRepository.findAllById(modelUserIds).stream()
                        .collect(Collectors.toMap(User::getId, u -> u));

        // Splits vigentes por modelo — para exponer internalSharePct pactado.
        // Query individual per modelo (el nº de modelos bajo un Master es
        // pequeño: acepto N+1 para evitar añadir query batch nueva).
        List<AdminMasterDetailDTO.ModelUnderMasterItem> modelItems = models.stream().map(m -> {
            User mu = modelUserById.get(m.getUserId());
            AdminMasterDetailDTO.ModelUnderMasterItem item = new AdminMasterDetailDTO.ModelUnderMasterItem();
            item.setModelUserId(m.getUserId());
            item.setNickname(mu != null ? mu.getNickname() : null);
            item.setActive(mu != null && Constants.Roles.MODEL.equals(mu.getRole()));
            item.setVerificationStatus(mu != null ? mu.getVerificationStatus() : null);
            item.setChosenRateEurPerMin(mu != null ? mu.getChosenRateEurPerMin() : null);
            item.setInternalSharePct(
                    masterModelSplitRepository
                            .findFirstByMasterUserIdAndModelUserIdAndEffectiveToIsNullOrderByIdDesc(
                                    masterUserId, m.getUserId())
                            .map(MasterModelSplit::getInternalSharePct)
                            .orElse(null));
            item.setCreatedAt(mu != null ? mu.getCreatedAt() : null);
            return item;
        }).sorted(Comparator.comparing(
                AdminMasterDetailDTO.ModelUnderMasterItem::getNickname,
                Comparator.nullsLast(Comparator.naturalOrder())))
        .toList();

        // KPIs 30d: bruto atribuido al Master + nº de payouts solicitados.
        LocalDateTime to = LocalDateTime.now();
        LocalDateTime from = to.minusDays(30);
        BigDecimal billed = transactionRepository.sumStreamChargeGrossForMasterWindow(
                masterUserId, from, to);
        if (billed == null) billed = BigDecimal.ZERO;

        List<PayoutRequest> allPayouts = payoutRequestRepository
                .findAllByModelUserIdOrderByCreatedAtDesc(masterUserId);
        int payoutsIn30d = (int) allPayouts.stream()
                .filter(pr -> pr.getCreatedAt() != null && !pr.getCreatedAt().isBefore(from))
                .count();

        AdminMasterDetailDTO dto = new AdminMasterDetailDTO();
        dto.setMaster(head);
        dto.setModels(modelItems);
        dto.setBilledGrossEur30d(billed);
        dto.setPayoutRequestsLast30d(payoutsIn30d);
        return dto;
    }

    // ============================================================
    // Internos
    // ============================================================

    private AdminMasterListItemDTO toListItem(Master m, User user) {
        AdminMasterListItemDTO dto = new AdminMasterListItemDTO();
        dto.setUserId(m.getUserId());
        dto.setCompanyName(m.getCompanyName());
        dto.setCompanyCountry(m.getCompanyCountry());
        dto.setTotalModelsActive(m.getTotalModelsActive());
        dto.setTotalPaidOutEur(m.getTotalPaidOutEur());
        dto.setOnboardedAt(m.getOnboardedAt());
        dto.setCreatedAt(m.getCreatedAt());
        dto.setSuspendedAt(m.getSuspendedAt());
        dto.setSuspensionReason(m.getSuspensionReason());

        if (user != null) {
            dto.setEmail(user.getEmail());
            dto.setNickname(user.getNickname());
            dto.setVerificationStatus(user.getVerificationStatus());
            dto.setEmailVerified(user.getEmailVerifiedAt() != null);
        }

        BigDecimal balance = balanceRepository
                .findTopByUserIdOrderByTimestampDescIdDesc(m.getUserId())
                .map(Balance::getBalance)
                .orElse(BigDecimal.ZERO);
        dto.setBalanceCurrent(balance);

        // Contrato: safe (traga excepciones y devuelve false); es lectura
        // pesada porque toca S3 manifest.
        boolean contract = false;
        try {
            contract = masterContractService.isAcceptedCurrent(m.getUserId());
        } catch (Exception ex) {
            log.debug("[ADMIN-MASTERS] contract check failed userId={} err={}",
                    m.getUserId(), ex.getMessage());
        }
        dto.setContractAccepted(contract);

        return dto;
    }

    private boolean filterMatches(AdminMasterListItemDTO dto, String qNorm,
                                   String kycStatus, Boolean emailVerified,
                                   Boolean contractAccepted, Boolean suspended) {
        if (qNorm != null && !qNorm.isEmpty()) {
            String haystack = ((dto.getEmail() != null ? dto.getEmail() : "") + " "
                    + (dto.getNickname() != null ? dto.getNickname() : "") + " "
                    + (dto.getCompanyName() != null ? dto.getCompanyName() : "")).toLowerCase();
            if (!haystack.contains(qNorm)) return false;
        }
        if (kycStatus != null && !kycStatus.isBlank()) {
            if (!kycStatus.equalsIgnoreCase(dto.getVerificationStatus())) return false;
        }
        if (emailVerified != null && emailVerified != dto.isEmailVerified()) return false;
        if (contractAccepted != null && contractAccepted != dto.isContractAccepted()) return false;
        if (suspended != null) {
            boolean isSusp = dto.getSuspendedAt() != null;
            if (suspended != isSusp) return false;
        }
        return true;
    }
}
