package com.sharemechat.controller;

import com.sharemechat.constants.Constants;
import com.sharemechat.dto.PublicComplaintCreateDTO;
import com.sharemechat.entity.Complaint;
import com.sharemechat.exception.TooManyRequestsException;
import com.sharemechat.service.ApiRateLimitService;
import com.sharemechat.service.ComplaintService;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.LocalDateTime;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class PublicComplaintControllerTest {

    private ComplaintService complaintService;
    private ApiRateLimitService rateLimitService;
    private HttpServletRequest req;
    private PublicComplaintController controller;

    @BeforeEach
    void setUp() {
        complaintService = mock(ComplaintService.class);
        rateLimitService = mock(ApiRateLimitService.class);
        req = mock(HttpServletRequest.class);
        when(req.getRemoteAddr()).thenReturn("203.0.113.10");
        controller = new PublicComplaintController(complaintService, rateLimitService);
    }

    @Test
    @DisplayName("create 201 con DTO valido")
    void created() {
        PublicComplaintCreateDTO dto = new PublicComplaintCreateDTO();
        dto.setCategory(Constants.ComplaintCategories.HARASSMENT);
        dto.setDescription("Descripcion");

        Complaint c = new Complaint();
        try {
            java.lang.reflect.Field f = Complaint.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(c, 42L);
        } catch (Exception ignore) {}
        c.setCategory(Constants.ComplaintCategories.HARASSMENT);
        c.setStatus(Constants.ComplaintStatuses.OPEN);
        c.setExpectedResolutionAt(LocalDateTime.now().plusDays(5));
        when(complaintService.createPublic(any(PublicComplaintCreateDTO.class), anyString())).thenReturn(c);

        ResponseEntity<?> resp = controller.create(dto, req);

        assertEquals(HttpStatus.CREATED, resp.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) resp.getBody();
        assertNotNull(body);
        assertEquals(42L, body.get("id"));
        assertEquals(Constants.ComplaintStatuses.OPEN, body.get("status"));
        verify(rateLimitService).checkComplaintIp(anyString());
    }

    @Test
    @DisplayName("create 400 cuando service tira IllegalArgumentException")
    void badRequest() {
        PublicComplaintCreateDTO dto = new PublicComplaintCreateDTO();
        dto.setCategory("NOPE");
        dto.setDescription("x");
        when(complaintService.createPublic(any(), anyString()))
                .thenThrow(new IllegalArgumentException("category no valida"));

        ResponseEntity<?> resp = controller.create(dto, req);

        assertEquals(HttpStatus.BAD_REQUEST, resp.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) resp.getBody();
        assertEquals("category no valida", body.get("error"));
    }

    @Test
    @DisplayName("rate limit -> TooManyRequestsException propaga (handler global la convierte en 429)")
    void rateLimitException() {
        doThrow(new TooManyRequestsException("Demasiadas denuncias desde esta IP. Intentalo mas tarde.", 3600000L))
                .when(rateLimitService).checkComplaintIp(anyString());

        PublicComplaintCreateDTO dto = new PublicComplaintCreateDTO();
        dto.setCategory(Constants.ComplaintCategories.HARASSMENT);
        dto.setDescription("Descripcion");

        // Se propaga; el GlobalExceptionHandler la mapea a 429. Aqui solo
        // verificamos que la excepcion no se traga.
        assertThrows(TooManyRequestsException.class, () -> controller.create(dto, req));
        verify(complaintService, never()).createPublic(any(), anyString());
    }
}
