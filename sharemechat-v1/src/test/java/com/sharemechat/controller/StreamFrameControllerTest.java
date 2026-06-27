package com.sharemechat.controller;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.StreamRecord;
import com.sharemechat.entity.User;
import com.sharemechat.repository.StreamRecordRepository;
import com.sharemechat.service.UserService;
import com.sharemechat.streammoderation.entity.StreamModerationSession;
import com.sharemechat.streammoderation.repository.StreamModerationSessionRepository;
import com.sharemechat.streammoderation.service.StreamFrameIngestionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tests del {@link StreamFrameController}. standaloneSetup sin
 * @SpringBootTest. El Authentication se inyecta en cada request via
 * {@code .principal(auth)} — standaloneSetup no carga filtros de Spring
 * Security y el resolver default toma {@code request.getUserPrincipal()}.
 */
class StreamFrameControllerTest {

    private static final byte[] VALID_JPEG = bytes(0xFF, 0xD8, 0xFF, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46);

    private UserService userService;
    private StreamRecordRepository streamRepo;
    private StreamModerationSessionRepository sessionRepo;
    private StreamFrameIngestionService ingestion;
    private StreamFrameController controller;
    private MockMvc mockMvc;
    private Authentication currentAuth;

    @BeforeEach
    void setUp() {
        userService = mock(UserService.class);
        streamRepo = mock(StreamRecordRepository.class);
        sessionRepo = mock(StreamModerationSessionRepository.class);
        ingestion = mock(StreamFrameIngestionService.class);
        controller = new StreamFrameController(userService, streamRepo, sessionRepo, ingestion);
        mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
        currentAuth = null;
    }

    private static byte[] bytes(int... vals) {
        byte[] out = new byte[vals.length];
        for (int i = 0; i < vals.length; i++) out[i] = (byte) vals[i];
        return out;
    }

    private User user(Long id, String email, String role) {
        User u = new User();
        u.setId(id);
        u.setEmail(email);
        u.setRole(role);
        return u;
    }

    private void setAuth(String email) {
        this.currentAuth = new UsernamePasswordAuthenticationToken(email, "n/a", List.of());
    }

    private void clearAuth() {
        this.currentAuth = null;
    }

    private StreamRecord stream(Long streamId, Long modelId) {
        StreamRecord rec = new StreamRecord();
        rec.setModel(user(modelId, "model@x", Constants.Roles.MODEL));
        return rec;
    }

    private StreamModerationSession activeSession() {
        StreamModerationSession s = new StreamModerationSession();
        s.setStreamRecordId(123L);
        s.setProvider(Constants.StreamModerationProvider.MOCK);
        s.setStatus(Constants.StreamModerationSessionStatus.ACTIVE);
        s.setFramesSubmitted(0);
        return s;
    }

    private MockMultipartFile multipartJpeg(byte[] content) {
        return new MockMultipartFile("frame", "frame.jpg", "image/jpeg", content);
    }

    private ResultActions perform(MockMultipartHttpServletRequestBuilder b) throws Exception {
        if (currentAuth != null) b.principal(currentAuth);
        return mockMvc.perform(b);
    }

    @Test
    @DisplayName("Sin auth -> 401 unauthenticated")
    void unauthenticated() throws Exception {
        clearAuth();
        perform(multipart("/api/streams/123/frames").file(multipartJpeg(VALID_JPEG)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("unauthenticated"));
    }

    @Test
    @DisplayName("Auth pero rol CLIENT (no MODEL) -> 403 not_model_role")
    void nonModelRoleForbidden() throws Exception {
        setAuth("c@x");
        when(userService.findByEmail("c@x")).thenReturn(user(1L, "c@x", Constants.Roles.CLIENT));

        perform(multipart("/api/streams/123/frames").file(multipartJpeg(VALID_JPEG)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("not_model_role"));
    }

    @Test
    @DisplayName("Frame vacio -> 400 empty_frame")
    void emptyFrame() throws Exception {
        setAuth("m@x");
        when(userService.findByEmail("m@x")).thenReturn(user(5L, "m@x", Constants.Roles.MODEL));

        perform(multipart("/api/streams/123/frames")
                        .file(new MockMultipartFile("frame", "f.jpg", "image/jpeg", new byte[0])))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("empty_frame"));
    }

    @Test
    @DisplayName("MIME no permitido (image/gif) -> 400 unsupported_mime")
    void unsupportedMime() throws Exception {
        setAuth("m@x");
        when(userService.findByEmail("m@x")).thenReturn(user(5L, "m@x", Constants.Roles.MODEL));

        perform(multipart("/api/streams/123/frames")
                        .file(new MockMultipartFile("frame", "f.gif", "image/gif", new byte[] {1, 2, 3, 4})))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("unsupported_mime"));
    }

    @Test
    @DisplayName("Magic bytes invalido (declarado image/jpeg pero contenido no JPEG) -> 400 invalid_image")
    void invalidMagicBytes() throws Exception {
        setAuth("m@x");
        when(userService.findByEmail("m@x")).thenReturn(user(5L, "m@x", Constants.Roles.MODEL));

        perform(multipart("/api/streams/123/frames")
                        .file(new MockMultipartFile("frame", "f.jpg", "image/jpeg", new byte[] {0x00, 0x01, 0x02, 0x03})))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("invalid_image"));
    }

    @Test
    @DisplayName("StreamRecord no existe -> 404 stream_not_found")
    void streamNotFound() throws Exception {
        setAuth("m@x");
        when(userService.findByEmail("m@x")).thenReturn(user(5L, "m@x", Constants.Roles.MODEL));
        when(streamRepo.findById(123L)).thenReturn(Optional.empty());

        perform(multipart("/api/streams/123/frames").file(multipartJpeg(VALID_JPEG)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("stream_not_found"));
    }

    @Test
    @DisplayName("Modelo autenticado != modelo del stream -> 403 not_stream_model")
    void notStreamModel() throws Exception {
        setAuth("m@x");
        when(userService.findByEmail("m@x")).thenReturn(user(5L, "m@x", Constants.Roles.MODEL));
        when(streamRepo.findById(123L)).thenReturn(Optional.of(stream(123L, 99L)));

        perform(multipart("/api/streams/123/frames").file(multipartJpeg(VALID_JPEG)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("not_stream_model"));
    }

    @Test
    @DisplayName("Sesion moderacion no existe -> 409 moderation_session_not_active")
    void sessionNotActive() throws Exception {
        setAuth("m@x");
        when(userService.findByEmail("m@x")).thenReturn(user(5L, "m@x", Constants.Roles.MODEL));
        when(streamRepo.findById(123L)).thenReturn(Optional.of(stream(123L, 5L)));
        when(sessionRepo.findByStreamRecordId(123L)).thenReturn(Optional.empty());

        perform(multipart("/api/streams/123/frames").file(multipartJpeg(VALID_JPEG)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("moderation_session_not_active"));
    }

    @Test
    @DisplayName("Sesion STOPPED -> 409 moderation_session_not_active")
    void sessionStopped() throws Exception {
        setAuth("m@x");
        when(userService.findByEmail("m@x")).thenReturn(user(5L, "m@x", Constants.Roles.MODEL));
        when(streamRepo.findById(123L)).thenReturn(Optional.of(stream(123L, 5L)));
        StreamModerationSession s = activeSession();
        s.setStatus(Constants.StreamModerationSessionStatus.STOPPED);
        when(sessionRepo.findByStreamRecordId(123L)).thenReturn(Optional.of(s));

        perform(multipart("/api/streams/123/frames").file(multipartJpeg(VALID_JPEG)))
                .andExpect(status().isConflict());
        verify(ingestion, never()).processFrame(anyLong(), any(byte[].class), any());
    }

    @Test
    @DisplayName("Happy path: 202 queued, contador frames_submitted +1, processFrame invocado")
    void happyPath() throws Exception {
        setAuth("m@x");
        when(userService.findByEmail("m@x")).thenReturn(user(5L, "m@x", Constants.Roles.MODEL));
        when(streamRepo.findById(123L)).thenReturn(Optional.of(stream(123L, 5L)));
        StreamModerationSession s = activeSession();
        when(sessionRepo.findByStreamRecordId(123L)).thenReturn(Optional.of(s));

        perform(multipart("/api/streams/123/frames").file(multipartJpeg(VALID_JPEG)))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.status").value("queued"));

        assertTrue(s.getFramesSubmitted() == 1);
        verify(sessionRepo).save(s);
        verify(ingestion).processFrame(any(), any(byte[].class), any());
    }

    @Test
    @DisplayName("isValidImage: PNG magic bytes aceptados")
    void isValidImagePng() {
        byte[] png = bytes(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00);
        assertTrue(StreamFrameController.isValidImage(png));
    }

    @Test
    @DisplayName("isValidImage: head muy corto rechazado")
    void isValidImageShort() {
        org.junit.jupiter.api.Assertions.assertFalse(
                StreamFrameController.isValidImage(new byte[] {0x00, 0x01}));
        org.junit.jupiter.api.Assertions.assertFalse(
                StreamFrameController.isValidImage(null));
    }
}
