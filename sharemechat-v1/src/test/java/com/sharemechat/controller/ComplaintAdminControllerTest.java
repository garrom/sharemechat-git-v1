package com.sharemechat.controller;

import com.sharemechat.constants.Constants;
import com.sharemechat.dto.ComplaintDTO;
import com.sharemechat.dto.ComplaintEscalateDTO;
import com.sharemechat.dto.ComplaintReviewDTO;
import com.sharemechat.dto.ComplaintStatsDTO;
import com.sharemechat.entity.User;
import com.sharemechat.service.ComplaintService;
import com.sharemechat.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class ComplaintAdminControllerTest {

    private ComplaintService complaintService;
    private UserService userService;
    private Authentication auth;
    private ComplaintAdminController controller;

    @BeforeEach
    void setUp() {
        complaintService = mock(ComplaintService.class);
        userService = mock(UserService.class);
        auth = mock(Authentication.class);
        when(auth.getName()).thenReturn("admin@sharemechat.com");

        User u = new User();
        try {
            java.lang.reflect.Field f = User.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(u, 99L);
        } catch (Exception ignore) {}
        u.setEmail("admin@sharemechat.com");
        when(userService.findByEmail("admin@sharemechat.com")).thenReturn(u);

        controller = new ComplaintAdminController(complaintService, userService);
    }

    @Test
    @DisplayName("list sin filtros -> delega a service y devuelve 200")
    void listNoFilters() {
        when(complaintService.adminList(null, null)).thenReturn(List.of());
        ResponseEntity<List<ComplaintDTO>> resp = controller.list(null, null);
        assertEquals(HttpStatus.OK, resp.getStatusCode());
        verify(complaintService).adminList(null, null);
    }

    @Test
    @DisplayName("list con status+category -> propaga filtros")
    void listWithFilters() {
        when(complaintService.adminList("OPEN", "HARASSMENT")).thenReturn(List.of());
        controller.list("OPEN", "HARASSMENT");
        verify(complaintService).adminList("OPEN", "HARASSMENT");
    }

    @Test
    @DisplayName("stats devuelve 200 + DTO")
    void stats() {
        ComplaintStatsDTO s = new ComplaintStatsDTO();
        s.setTotal(10L);
        when(complaintService.stats()).thenReturn(s);
        ResponseEntity<ComplaintStatsDTO> resp = controller.stats();
        assertEquals(HttpStatus.OK, resp.getStatusCode());
        assertEquals(10L, resp.getBody().getTotal());
    }

    @Test
    @DisplayName("getById OK -> 200")
    void getByIdOk() {
        ComplaintDTO dto = new ComplaintDTO();
        dto.setId(7L);
        when(complaintService.adminGetById(7L)).thenReturn(dto);
        ResponseEntity<?> resp = controller.getById(7L);
        assertEquals(HttpStatus.OK, resp.getStatusCode());
    }

    @Test
    @DisplayName("getById no existe -> 404 con error body")
    void getByIdNotFound() {
        when(complaintService.adminGetById(7L)).thenThrow(new IllegalArgumentException("Complaint no encontrada"));
        ResponseEntity<?> resp = controller.getById(7L);
        assertEquals(404, resp.getStatusCode().value());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) resp.getBody();
        assertEquals("Complaint no encontrada", body.get("error"));
    }

    @Test
    @DisplayName("review OK -> 200 con dto reflejado, adminUserId resuelto desde auth")
    void reviewOk() {
        ComplaintReviewDTO body = new ComplaintReviewDTO();
        body.setNewStatus(Constants.ComplaintStatuses.REVIEWING);

        ComplaintDTO out = new ComplaintDTO();
        out.setId(5L);
        out.setStatus(Constants.ComplaintStatuses.REVIEWING);
        when(complaintService.adminReview(eq(5L), any(ComplaintReviewDTO.class), eq(99L))).thenReturn(out);

        ResponseEntity<?> resp = controller.review(5L, body, auth);
        assertEquals(HttpStatus.OK, resp.getStatusCode());
        verify(complaintService).adminReview(eq(5L), any(ComplaintReviewDTO.class), eq(99L));
    }

    @Test
    @DisplayName("review bad request -> 400")
    void reviewBadRequest() {
        ComplaintReviewDTO body = new ComplaintReviewDTO();
        body.setNewStatus(Constants.ComplaintStatuses.RESOLVED);
        when(complaintService.adminReview(anyLong(), any(), anyLong()))
                .thenThrow(new IllegalArgumentException("decisionCode requerido al pasar a RESOLVED o REJECTED"));

        ResponseEntity<?> resp = controller.review(5L, body, auth);
        assertEquals(HttpStatus.BAD_REQUEST, resp.getStatusCode());
    }

    @Test
    @DisplayName("escalate OK -> 200")
    void escalateOk() {
        ComplaintDTO out = new ComplaintDTO();
        out.setId(5L);
        out.setStatus(Constants.ComplaintStatuses.ESCALATED);
        when(complaintService.adminEscalate(eq(5L), any(), eq(99L))).thenReturn(out);

        ComplaintEscalateDTO body = new ComplaintEscalateDTO();
        body.setNotes("notas escalate");

        ResponseEntity<?> resp = controller.escalate(5L, body, auth);
        assertEquals(HttpStatus.OK, resp.getStatusCode());
    }

    @Test
    @DisplayName("review sin auth -> 400 (IllegalArgumentException con 'No autenticado')")
    void reviewNoAuth() {
        ComplaintReviewDTO body = new ComplaintReviewDTO();
        body.setNewStatus(Constants.ComplaintStatuses.REVIEWING);
        ResponseEntity<?> resp = controller.review(5L, body, null);
        assertEquals(HttpStatus.BAD_REQUEST, resp.getStatusCode());
    }
}
