package com.sharemechat.controller;

import com.sharemechat.constants.SupportedChatLanguages;
import com.sharemechat.dto.ConversationSummaryDTO;
import com.sharemechat.dto.MessageDTO;
import com.sharemechat.dto.MessageTranslationDTO;
import com.sharemechat.entity.User;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.service.ConsentEnforcementService;
import com.sharemechat.service.MessageService;
import com.sharemechat.service.MessageTranslationService;
import com.sharemechat.service.ProductAccessGuardService;
import com.sharemechat.service.translation.TranslationProvider;
import com.sharemechat.service.translation.TranslationUnavailableException;
import com.sharemechat.support.service.SupportBotProvider;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/messages")
public class MessagesController {

    private final MessageService messageService;
    private final MessageTranslationService messageTranslationService;
    private final TranslationProvider translationProvider;
    private final UserRepository userRepository;
    private final ConsentEnforcementService consentEnforcementService;
    private final ProductAccessGuardService productAccessGuardService;
    private final SupportBotProvider supportBotProvider;

    public MessagesController(MessageService messageService,
                              MessageTranslationService messageTranslationService,
                              TranslationProvider translationProvider,
                              UserRepository userRepository,
                              ConsentEnforcementService consentEnforcementService,
                              ProductAccessGuardService productAccessGuardService,
                              SupportBotProvider supportBotProvider) {
        this.messageService = messageService;
        this.messageTranslationService = messageTranslationService;
        this.translationProvider = translationProvider;
        this.userRepository = userRepository;
        this.consentEnforcementService = consentEnforcementService;
        this.productAccessGuardService = productAccessGuardService;
        this.supportBotProvider = supportBotProvider;
    }

    private Long uid(Authentication auth) {
        String email = auth.getName();
        User u = userRepository.findByEmail(email).orElseThrow();
        productAccessGuardService.requireNotSupport(u);
        return u.getId();
    }

    @GetMapping("/conversations")
    public ResponseEntity<List<ConversationSummaryDTO>> conversations(Authentication auth) {
        consentEnforcementService.assertAuthenticatedUserCompliant(auth, "GET /api/messages/conversations");
        Long me = uid(auth);
        return ResponseEntity.ok(messageService.conversations(me));
    }

    @GetMapping("/with/{userId}")
    public ResponseEntity<List<MessageDTO>> history(Authentication auth, @PathVariable Long userId,
                                                    @RequestParam(value="beforeId", required=false) Long beforeId) {
        consentEnforcementService.assertAuthenticatedUserCompliant(auth, "GET /api/messages/with/{userId}");
        Long me = uid(auth);
        return ResponseEntity.ok(messageService.history(me, userId, beforeId));
    }

    @PostMapping("/to/{userId}")
    public ResponseEntity<MessageDTO> send(Authentication auth, @PathVariable Long userId, @RequestBody Body body) {
        consentEnforcementService.assertAuthenticatedUserCompliant(auth, "POST /api/messages/to/{userId}");
        Long me = uid(auth);
        // Guard B.2.1: mensajes al Agente IA no van por P2P; el frontend debe usar /api/support/message.
        if (supportBotProvider.isSupportBot(userId)) {
            throw new IllegalArgumentException(
                    "This user cannot receive P2P messages, use /api/support/message endpoint");
        }
        MessageDTO dto = messageService.send(me, userId, body.body());
        return ResponseEntity.ok(dto);
    }

    @PostMapping("/with/{userId}/read")
    public ResponseEntity<Integer> markRead(Authentication auth, @PathVariable Long userId) {
        consentEnforcementService.assertAuthenticatedUserCompliant(auth, "POST /api/messages/with/{userId}/read");
        Long me = uid(auth);
        return ResponseEntity.ok(messageService.markRead(me, userId));
    }

    public record Body(String body) {}

    // ================================================================
    // pending-hardening §5.3: traduccion automatica chat P2P cross-language.
    // Cache tabla message_translations + provider Google Cloud Translate.
    // ================================================================

    @PostMapping("/{id}/translate")
    public ResponseEntity<?> translateMessage(Authentication auth,
                                              @PathVariable Long id,
                                              @RequestBody TranslateRequest req) {
        consentEnforcementService.assertAuthenticatedUserCompliant(auth, "POST /api/messages/{id}/translate");
        Long me = uid(auth);
        try {
            MessageTranslationDTO dto = messageTranslationService.translateOnDemand(id, req.lang(), me);
            return ResponseEntity.ok(dto);
        } catch (SecurityException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(java.util.Map.of("code", "NOT_PARTICIPANT", "message", e.getMessage()));
        } catch (TranslationUnavailableException e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(java.util.Map.of("code", "TRANSLATION_UNAVAILABLE", "message", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(java.util.Map.of("code", "BAD_REQUEST", "message", e.getMessage()));
        }
    }

    @PostMapping("/translate-batch")
    public ResponseEntity<?> translateBatch(Authentication auth, @RequestBody TranslateBatchRequest req) {
        consentEnforcementService.assertAuthenticatedUserCompliant(auth, "POST /api/messages/translate-batch");
        Long me = uid(auth);
        try {
            List<MessageTranslationDTO> out = messageTranslationService.translateBatch(req.ids(), req.lang(), me);
            return ResponseEntity.ok(out);
        } catch (SecurityException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(java.util.Map.of("code", "NOT_PARTICIPANT", "message", e.getMessage()));
        } catch (TranslationUnavailableException e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(java.util.Map.of("code", "TRANSLATION_UNAVAILABLE", "message", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(java.util.Map.of("code", "BAD_REQUEST", "message", e.getMessage()));
        }
    }

    /**
     * pending-hardening §5.3: expone al frontend la lista de idiomas
     * soportados y el estado del proveedor. Sin auth: la lista de langs
     * no es sensible y el frontend la necesita para renderizar el selector
     * del perfil y decidir si mostrar la UI de traduccion.
     */
    @GetMapping("/translation-config")
    public ResponseEntity<?> translationConfig() {
        return ResponseEntity.ok(java.util.Map.of(
                "provider", translationProvider.providerName(),
                "enabled", translationProvider.isConfigured(),
                "langs", SupportedChatLanguages.CODES
        ));
    }

    public record TranslateRequest(String lang) {}
    public record TranslateBatchRequest(List<Long> ids, String lang) {}
}
