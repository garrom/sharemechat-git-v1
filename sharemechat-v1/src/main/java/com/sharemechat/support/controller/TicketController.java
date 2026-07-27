package com.sharemechat.support.controller;

import com.sharemechat.entity.User;
import com.sharemechat.service.UserService;
import com.sharemechat.support.dto.OpenTicketRequestDTO;
import com.sharemechat.support.dto.TicketResponseDTO;
import com.sharemechat.support.entity.SupportTicket;
import com.sharemechat.support.service.TicketService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * ADR-054 Fase T2: endpoints cliente para gestion de tickets propios.
 * Acceso restringido a ROLE_CLIENT via {@code SecurityConfig}. Ownership
 * (userId del cookie == userId del ticket) se enforca aqui en cada endpoint
 * — ni el DTO ni el path admiten userId externo.
 */
@RestController
@RequestMapping("/api/tickets")
public class TicketController {

    private final TicketService ticketService;
    private final UserService userService;

    public TicketController(TicketService ticketService, UserService userService) {
        this.ticketService = ticketService;
        this.userService = userService;
    }

    /** D2 b1: abrir un ticket desde el formulario cliente. */
    @PostMapping
    public ResponseEntity<?> open(@RequestBody OpenTicketRequestDTO body, Authentication auth) {
        try {
            Long userId = requireUserId(auth);
            if (body == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "Body requerido"));
            }
            SupportTicket t = ticketService.openTicket(
                    userId,
                    body.getCategory(),
                    body.getDescription(),
                    body.getReportedIncidentAt(),
                    body.getLinkedStreamRecordId(),
                    body.getLinkedPaymentSessionId());
            return ResponseEntity.ok(TicketResponseDTO.from(t));
        } catch (TicketService.RateLimitExceededException ex) {
            return ResponseEntity.status(429).body(Map.of("error", ex.getMessage()));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    /** Listado de tickets propios ordenado por id DESC. */
    @GetMapping
    public ResponseEntity<?> listMine(Authentication auth) {
        try {
            Long userId = requireUserId(auth);
            List<TicketResponseDTO> out = ticketService.listByUser(userId).stream()
                    .map(TicketResponseDTO::from)
                    .toList();
            return ResponseEntity.ok(out);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    /** Detalle de un ticket propio. Ownership verificada (404 si no matchea). */
    @GetMapping("/{id}")
    public ResponseEntity<?> getMine(@PathVariable Long id, Authentication auth) {
        try {
            Long userId = requireUserId(auth);
            SupportTicket t = ticketService.findByIdForUser(id, userId);
            return ResponseEntity.ok(TicketResponseDTO.from(t));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(404).body(Map.of("error", ex.getMessage()));
        }
    }

    private Long requireUserId(Authentication auth) {
        if (auth == null || auth.getName() == null) {
            throw new IllegalArgumentException("No autenticado");
        }
        User u = userService.findByEmail(auth.getName());
        if (u == null) throw new IllegalArgumentException("Usuario no encontrado");
        return u.getId();
    }
}
