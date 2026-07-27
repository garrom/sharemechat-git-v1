package com.sharemechat.support.controller;

import com.sharemechat.entity.User;
import com.sharemechat.service.UserService;
import com.sharemechat.support.dto.TicketResponseDTO;
import com.sharemechat.support.dto.TransitionTicketStatusRequestDTO;
import com.sharemechat.support.entity.SupportTicket;
import com.sharemechat.support.repository.SupportTicketRepository;
import com.sharemechat.support.service.TicketService;
import com.sharemechat.support.service.TicketVerificationService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * ADR-054 Fase T2: endpoints admin para gestion de tickets. Auth restringido
 * por matcher {@code /api/admin/tickets/**} a ROLE_ADMIN + ROLE_SUPPORT +
 * PERM_SUPPORT_TICKETS_HANDLE en {@code SecurityConfig}.
 *
 * <p>La compensacion economica NO se expone aqui — reutiliza el endpoint
 * existente {@code POST /api/admin/finance/refund/{userId}} pasando
 * {@code ticketId} en el body (D4). Esto simplifica el guard: el agente
 * necesita ambos permisos (tickets_handle para operar el ticket +
 * finance.*.refund para acreditar).
 */
@RestController
@RequestMapping("/api/admin/tickets")
public class AdminTicketController {

    private final TicketService ticketService;
    private final TicketVerificationService verificationService;
    private final SupportTicketRepository ticketRepo;
    private final UserService userService;

    public AdminTicketController(TicketService ticketService,
                                  TicketVerificationService verificationService,
                                  SupportTicketRepository ticketRepo,
                                  UserService userService) {
        this.ticketService = ticketService;
        this.verificationService = verificationService;
        this.ticketRepo = ticketRepo;
        this.userService = userService;
    }

    /** Listado paginado con filtros opcionales de categoria/estado. */
    @GetMapping
    public ResponseEntity<?> listAll(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication auth) {
        try {
            requireUserId(auth);
            if (size <= 0 || size > 100) size = 20;
            Page<SupportTicket> pageResult = ticketRepo.findFiltered(
                    isBlank(category) ? null : category,
                    isBlank(status) ? null : status,
                    PageRequest.of(page, size));
            return ResponseEntity.ok(Map.of(
                    "content", pageResult.getContent().stream().map(TicketResponseDTO::from).toList(),
                    "page", pageResult.getNumber(),
                    "size", pageResult.getSize(),
                    "totalElements", pageResult.getTotalElements(),
                    "totalPages", pageResult.getTotalPages()
            ));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    /** Detalle admin (cualquier userId). */
    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable Long id, Authentication auth) {
        try {
            requireUserId(auth);
            SupportTicket t = ticketService.findByIdOrThrow(id);
            return ResponseEntity.ok(TicketResponseDTO.from(t));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(404).body(Map.of("error", ex.getMessage()));
        }
    }

    /**
     * D3: ejecuta la verificacion automatica y devuelve el JSON estructurado.
     * Response type application/json para que el admin pueda pretty-printear.
     * El ticket queda actualizado con verification_last_* persistido.
     */
    @PostMapping(value = "/{id}/verify", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> verify(@PathVariable Long id, Authentication auth) {
        try {
            requireUserId(auth);
            String json = verificationService.verify(id);
            return ResponseEntity.ok(json);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(404).body(Map.of("error", ex.getMessage()));
        }
    }

    /**
     * D6: transiciona el estado del ticket. Solo transiciones validas del
     * enum permitidas — otras dan 400. Reserva
     * OPEN -> RESOLVED_COMPENSATED_PENDING_CREDIT: NO permitido (fuerza pasar
     * por INVESTIGATING primero). Reserva
     * RESOLVED_COMPENSATED_PENDING_CREDIT -> RESOLVED_COMPENSATED: se ejecuta
     * automaticamente desde {@code manualRefundToClient} al acreditar; llamar
     * a este endpoint con esa transicion falla porque no hay refund adjunto.
     */
    @PatchMapping("/{id}/status")
    public ResponseEntity<?> transition(@PathVariable Long id,
                                         @RequestBody TransitionTicketStatusRequestDTO body,
                                         Authentication auth) {
        try {
            Long adminId = requireUserId(auth);
            if (body == null || body.getNewStatus() == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "newStatus requerido"));
            }
            // Bloqueo defensivo: la transicion final a RESOLVED_COMPENSATED
            // debe salir de manualRefundToClient, no de este endpoint (sino
            // dejariamos ticket cerrado sin acreditacion asociada).
            if ("RESOLVED_COMPENSATED".equals(body.getNewStatus())) {
                return ResponseEntity.badRequest().body(Map.of(
                        "error", "Usa POST /api/admin/finance/refund/{userId} con ticketId para acreditar y cerrar."));
            }
            SupportTicket updated = ticketService.transitionStatus(id, body.getNewStatus(),
                    adminId, body.getNotes());
            return ResponseEntity.ok(TicketResponseDTO.from(updated));
        } catch (IllegalStateException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
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

    private static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }
}
