package com.sharemechat.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.AffiliateClickEvent;
import com.sharemechat.entity.FavoriteClient;
import com.sharemechat.entity.FavoriteModel;
import com.sharemechat.entity.User;
import com.sharemechat.exception.IllegalReferralOverwriteException;
import com.sharemechat.repository.AffiliateClickEventRepository;
import com.sharemechat.repository.FavoriteClientRepository;
import com.sharemechat.repository.FavoriteModelRepository;
import com.sharemechat.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.LocalDateTime;
import java.util.Optional;

/**
 * ADR-049 Subpasada 2B: atribucion del cliente atribuido a la modelo
 * referidora en el registro (D3+D5+D6+D7).
 *
 * <p><b>Transaccionalidad (brief 2B, detalle CRITICO)</b>: los pasos 1-3
 * (set {@code users.referred_by_user_id}+{@code referred_at}, primer
 * favorito con {@code invited='REFERRAL'} + {@code favorite_source=
 * 'AFFILIATE_INVITATION'}, evento REGISTERED en {@code
 * affiliate_click_events}) van dentro de la misma transaccion via
 * {@code @Transactional}. Si algo falla en ese bloque, rollback completo.
 *
 * <p>El paso 4 (envio email {@code REFERRAL_INVITATION} al cliente) queda
 * <b>fuera</b> de la transaccion: se agenda con
 * {@code TransactionSynchronizationManager.registerSynchronization()} en
 * fase {@code afterCommit}. Si el commit falla, el email nunca sale. Si
 * el email falla, la atribucion NO se revierte (patron best-effort,
 * coherente con {@code sendWelcomeEmail} y las notificaciones h1 del
 * proyecto).
 *
 * <p>El bono de bienvenida (D7) se otorga <b>dentro</b> de la misma
 * transaccion invocando a {@link AffiliateBonusService}. Idempotente:
 * si el cliente ya tenia bono previo, se salta silenciosamente. Un
 * fallo del bono SI revierte la atribucion — deja el registro sin
 * medio saldo referral.
 */
@Service
public class AffiliateAttributionService {

    private static final Logger log = LoggerFactory.getLogger(AffiliateAttributionService.class);

    private final UserRepository userRepository;
    private final FavoriteModelRepository favoriteModelRepository;
    private final FavoriteClientRepository favoriteClientRepository;
    private final AffiliateClickEventRepository clickEventRepository;
    private final AffiliateBonusService bonusService;
    private final EmailService emailService;
    private final EmailCopyRenderer emailCopyRenderer;

    public AffiliateAttributionService(UserRepository userRepository,
                                       FavoriteModelRepository favoriteModelRepository,
                                       FavoriteClientRepository favoriteClientRepository,
                                       AffiliateClickEventRepository clickEventRepository,
                                       AffiliateBonusService bonusService,
                                       EmailService emailService,
                                       EmailCopyRenderer emailCopyRenderer) {
        this.userRepository = userRepository;
        this.favoriteModelRepository = favoriteModelRepository;
        this.favoriteClientRepository = favoriteClientRepository;
        this.clickEventRepository = clickEventRepository;
        this.bonusService = bonusService;
        this.emailService = emailService;
        this.emailCopyRenderer = emailCopyRenderer;
    }

    /**
     * Intenta atribuir el cliente recien registrado a la modelo referidora
     * asociada al codigo. Silent-return si el codigo no resuelve a una
     * modelo APPROVED activa (D18).
     *
     * @param clientUserId user id del cliente recien creado.
     * @param referralCode codigo de referral extraido de la cookie
     *                     {@code sharemechat_affiliate_ref}. Puede llegar
     *                     con espacios o mayusculas; se normaliza.
     * @return {@link Optional} con el resultado (client + model) si la
     *         atribucion se aplico; {@link Optional#empty()} si se salto
     *         silenciosamente por codigo invalido o modelo no APPROVED.
     */
    @Transactional
    public Optional<AttributionResult> attributeOnRegister(Long clientUserId, String referralCode) {
        if (clientUserId == null) {
            throw new IllegalArgumentException("clientUserId requerido");
        }
        if (referralCode == null || referralCode.isBlank()) {
            return Optional.empty();
        }
        String normalizedCode = referralCode.trim().toUpperCase();

        Optional<User> modelOpt = userRepository.findByReferralCodeOwner(normalizedCode);
        if (modelOpt.isEmpty()) {
            log.warn("[AFFILIATE-ATTR] silent_skip clientUserId={} reason=code_not_found code_len={}",
                    clientUserId, normalizedCode.length());
            return Optional.empty();
        }
        User model = modelOpt.get();
        if (!Constants.Roles.MODEL.equals(model.getRole())) {
            log.warn("[AFFILIATE-ATTR] silent_skip clientUserId={} reason=owner_not_model modelUserId={}",
                    clientUserId, model.getId());
            return Optional.empty();
        }
        if (!Constants.VerificationStatuses.APPROVED.equals(model.getVerificationStatus())) {
            log.warn("[AFFILIATE-ATTR] silent_skip clientUserId={} reason=model_not_approved modelUserId={} status={}",
                    clientUserId, model.getId(), model.getVerificationStatus());
            return Optional.empty();
        }
        if (Constants.AccountStatuses.SUSPENDED.equals(model.getAccountStatus())) {
            log.warn("[AFFILIATE-ATTR] silent_skip clientUserId={} reason=model_suspended modelUserId={}",
                    clientUserId, model.getId());
            return Optional.empty();
        }

        User client = userRepository.findById(clientUserId)
                .orElseThrow(() -> new IllegalStateException("client_not_found:" + clientUserId));

        if (client.getReferredByUserId() != null) {
            throw new IllegalReferralOverwriteException(
                    clientUserId, client.getReferredByUserId(), model.getId());
        }

        LocalDateTime now = LocalDateTime.now();
        client.setReferredByUserId(model.getId());
        client.setReferredAt(now);
        userRepository.save(client);

        // 2026-07-15: invited='accepted' (no 'REFERRAL' como estaba originalmente):
        // 'invited' es un enum funcional (pending/sent/accepted/rejected) usado por
        // canUsersMessage y multiples filtros frontend para autorizar chat/gifts/
        // llamadas. Poner 'REFERRAL' aqui bloqueaba silenciosamente el chat entre
        // referrer y referido pese a que la relacion es efectivamente aceptada
        // (el modelo compartio el link, el cliente se registro siguiendolo).
        // La marca de origen se conserva en favorite_source='AFFILIATE_INVITATION'
        // (columna canonica de trazabilidad economica en favorites_models).
        FavoriteModel fav = new FavoriteModel(clientUserId, model.getId());
        fav.setStatus("active");
        fav.setInvited("accepted");
        fav.setFavoriteSource("AFFILIATE_INVITATION");
        favoriteModelRepository.save(fav);

        // Fila reciproca en favorites_clients: sin este save el modelo no veia
        // al cliente aunque el cliente si veia al modelo (bug detectado
        // 2026-07-15 en 4/4 registros AFFILIATE_INVITATION desde el 11-jul).
        // favorites_clients no tiene columna favorite_source (asimetria de
        // schema preexistente aceptada como legacy).
        FavoriteClient favReciprocal = new FavoriteClient(model.getId(), clientUserId);
        favReciprocal.setStatus("active");
        favReciprocal.setInvited("accepted");
        favoriteClientRepository.save(favReciprocal);

        AffiliateClickEvent evt = new AffiliateClickEvent();
        evt.setModelUserId(model.getId());
        evt.setEventType("REGISTERED");
        evt.setClientUserId(clientUserId);
        clickEventRepository.save(evt);

        bonusService.grantWelcomeBonusIfEligible(clientUserId, model.getId());

        AttributionResult result = new AttributionResult(client, model);
        scheduleInvitationEmailAfterCommit(result);

        log.info("[AFFILIATE-ATTR] attributed clientUserId={} modelUserId={} favoriteId={} favReciprocalId={} eventId={}",
                clientUserId, model.getId(), fav.getId(), favReciprocal.getId(), evt.getId());
        return Optional.of(result);
    }

    /**
     * Agenda el envio del email de invitacion para AFTER_COMMIT. Si no hay
     * transaccion activa (test standalone, uso directo), envia inmediatamente
     * best-effort.
     */
    private void scheduleInvitationEmailAfterCommit(AttributionResult result) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    sendInvitationBestEffort(result);
                }
            });
        } else {
            sendInvitationBestEffort(result);
        }
    }

    private void sendInvitationBestEffort(AttributionResult result) {
        try {
            EmailCopyRenderer.EmailContent content =
                    emailCopyRenderer.renderReferralInvitation(result.client(), result.model());
            EmailMessage msg = new EmailMessage(
                    result.client().getEmail(),
                    content.subject(),
                    content.body(),
                    EmailMessage.Category.REFERRAL_INVITATION,
                    EmailMessage.Priority.BEST_EFFORT
            );
            emailService.send(msg);
            log.info("[AFFILIATE-INVITATION] sent clientUserId={} modelUserId={}",
                    result.client().getId(), result.model().getId());
        } catch (Exception ex) {
            log.warn("[AFFILIATE-INVITATION] send_failed clientUserId={} modelUserId={}",
                    result.client().getId(), result.model().getId(), ex);
        }
    }

    public record AttributionResult(User client, User model) { }
}
