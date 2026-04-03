package com.sharemechat.controller;

import com.sharemechat.dto.ConversationSummaryDTO;
import com.sharemechat.dto.MessageDTO;
import com.sharemechat.entity.User;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.service.ConsentEnforcementService;
import com.sharemechat.service.MessageService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/messages")
public class MessagesController {

    private final MessageService messageService;
    private final UserRepository userRepository;
    private final ConsentEnforcementService consentEnforcementService;

    public MessagesController(MessageService messageService,
                              UserRepository userRepository,
                              ConsentEnforcementService consentEnforcementService) {
        this.messageService = messageService;
        this.userRepository = userRepository;
        this.consentEnforcementService = consentEnforcementService;
    }

    private Long uid(Authentication auth) {
        String email = auth.getName();
        User u = userRepository.findByEmail(email).orElseThrow();
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
}
