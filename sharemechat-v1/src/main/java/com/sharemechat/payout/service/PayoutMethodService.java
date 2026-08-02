package com.sharemechat.payout.service;

import com.sharemechat.payout.dto.PayoutMethodDTO;
import com.sharemechat.payout.dto.PayoutMethodRequestDTO;
import com.sharemechat.payout.entity.PayoutMethod;
import com.sharemechat.payout.repository.PayoutMethodRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.regex.Pattern;

/**
 * ADR-056 Fase S6.a: gestión CRUD de PayoutMethod para user Master
 * (y modelo en iter posterior). Autoservicio: el user gestiona sus
 * propios métodos, guard ownership en cada operación.
 *
 * <p>Validaciones semánticas de {@code accountRef} según {@code rail}:
 * <ul>
 *   <li>PAXUM → email válido (regex mínimo).</li>
 *   <li>SEPA_MANUAL / YOURSAFE → IBAN longitud 15-34, alfanumérico.</li>
 *   <li>NOWPAYMENTS_CRYPTO → wallet address 20-100 chars alfanumérica.</li>
 * </ul>
 *
 * <p>Mutual exclusion del {@code isDefault}: cuando el user marca uno
 * como default (o lo crea con {@code setAsDefault=true}), este servicio
 * desmarca cualquier otro método del mismo user en la misma transacción.
 */
@Service
public class PayoutMethodService {

    private static final Logger log = LoggerFactory.getLogger(PayoutMethodService.class);

    private static final Pattern EMAIL_RE = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    private static final Pattern IBAN_RE = Pattern.compile("^[A-Z0-9]{15,34}$");
    private static final Pattern WALLET_RE = Pattern.compile("^[A-Za-z0-9]{20,100}$");

    private final PayoutMethodRepository repository;

    public PayoutMethodService(PayoutMethodRepository repository) {
        this.repository = repository;
    }

    public List<PayoutMethodDTO> listByUser(Long userId) {
        return repository.findAllByUserIdOrderByIdDesc(userId).stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional
    public PayoutMethodDTO create(Long userId, PayoutMethodRequestDTO req) {
        validateSemantic(req.getRail(), req.getAccountRef());

        PayoutMethod pm = new PayoutMethod();
        pm.setUserId(userId);
        pm.setRail(req.getRail());
        pm.setAccountRef(req.getAccountRef().trim());
        pm.setDisplayAlias(req.getDisplayAlias() != null ? req.getDisplayAlias().trim() : null);

        // Si es el primer método del user, forzar isDefault=true aunque no
        // lo haya pedido — así siempre hay un default disponible.
        boolean anyExisting = !repository.findAllByUserIdOrderByIdDesc(userId).isEmpty();
        boolean shouldBeDefault = req.isSetAsDefault() || !anyExisting;
        pm.setDefault(shouldBeDefault);

        PayoutMethod saved = repository.save(pm);

        if (shouldBeDefault) {
            applyDefaultMutex(userId, saved.getId());
        }

        log.info("[PAYOUT-METHOD] created userId={} id={} rail={} isDefault={}",
                userId, saved.getId(), saved.getRail(), saved.isDefault());
        return toDto(saved);
    }

    @Transactional
    public PayoutMethodDTO update(Long userId, Long id, PayoutMethodRequestDTO req) {
        PayoutMethod pm = repository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new IllegalArgumentException("Método de cobro no encontrado"));

        validateSemantic(req.getRail(), req.getAccountRef());

        boolean railChanged = !pm.getRail().equals(req.getRail());
        boolean refChanged = !pm.getAccountRef().equals(req.getAccountRef().trim());

        pm.setRail(req.getRail());
        pm.setAccountRef(req.getAccountRef().trim());
        pm.setDisplayAlias(req.getDisplayAlias() != null ? req.getDisplayAlias().trim() : null);

        // Si cambia rail o accountRef, invalidar verificación previa
        // (el admin/adapter tendrá que revalidar).
        if (railChanged || refChanged) {
            pm.setVerifiedAt(null);
        }

        if (req.isSetAsDefault() && !pm.isDefault()) {
            pm.setDefault(true);
            applyDefaultMutex(userId, id);
        }

        PayoutMethod saved = repository.save(pm);
        log.info("[PAYOUT-METHOD] updated userId={} id={} rail={} isDefault={} reset_verified={}",
                userId, id, saved.getRail(), saved.isDefault(), railChanged || refChanged);
        return toDto(saved);
    }

    @Transactional
    public void delete(Long userId, Long id) {
        PayoutMethod pm = repository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new IllegalArgumentException("Método de cobro no encontrado"));
        boolean wasDefault = pm.isDefault();
        repository.delete(pm);
        log.info("[PAYOUT-METHOD] deleted userId={} id={} wasDefault={}", userId, id, wasDefault);

        // Si borré el default y quedan otros métodos, promover el más
        // reciente a default para que siempre haya uno disponible.
        if (wasDefault) {
            List<PayoutMethod> remaining = repository.findAllByUserIdOrderByIdDesc(userId);
            if (!remaining.isEmpty()) {
                PayoutMethod promote = remaining.get(0);
                promote.setDefault(true);
                repository.save(promote);
                log.info("[PAYOUT-METHOD] promoted userId={} id={} to default (previous default deleted)",
                        userId, promote.getId());
            }
        }
    }

    @Transactional
    public PayoutMethodDTO setDefault(Long userId, Long id) {
        PayoutMethod pm = repository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new IllegalArgumentException("Método de cobro no encontrado"));
        if (!pm.isDefault()) {
            pm.setDefault(true);
            repository.save(pm);
            applyDefaultMutex(userId, id);
        }
        return toDto(pm);
    }

    // ============================================================
    // Internos
    // ============================================================

    private void applyDefaultMutex(Long userId, Long keepId) {
        List<PayoutMethod> all = repository.findAllByUserIdOrderByIdDesc(userId);
        for (PayoutMethod other : all) {
            if (other.getId().equals(keepId)) continue;
            if (other.isDefault()) {
                other.setDefault(false);
                repository.save(other);
            }
        }
    }

    private void validateSemantic(String rail, String accountRef) {
        if (rail == null || accountRef == null) {
            throw new IllegalArgumentException("rail y accountRef son obligatorios");
        }
        String ref = accountRef.trim();
        switch (rail) {
            case "PAXUM":
                if (!EMAIL_RE.matcher(ref).matches()) {
                    throw new IllegalArgumentException("Paxum requiere un email válido");
                }
                break;
            case "SEPA_MANUAL":
            case "YOURSAFE":
                String iban = ref.replace(" ", "").toUpperCase();
                if (!IBAN_RE.matcher(iban).matches()) {
                    throw new IllegalArgumentException("Se requiere un IBAN válido (15-34 caracteres alfanuméricos)");
                }
                break;
            case "NOWPAYMENTS_CRYPTO":
                if (!WALLET_RE.matcher(ref).matches()) {
                    throw new IllegalArgumentException("Dirección de wallet inválida (20-100 caracteres alfanuméricos)");
                }
                break;
            default:
                throw new IllegalArgumentException("Rail no soportado: " + rail);
        }
    }

    private PayoutMethodDTO toDto(PayoutMethod pm) {
        PayoutMethodDTO dto = new PayoutMethodDTO();
        dto.setId(pm.getId());
        dto.setRail(pm.getRail());
        dto.setAccountRef(pm.getAccountRef());
        dto.setDisplayAlias(pm.getDisplayAlias());
        dto.setDefault(pm.isDefault());
        dto.setVerifiedAt(pm.getVerifiedAt());
        dto.setCreatedAt(pm.getCreatedAt());
        return dto;
    }
}
