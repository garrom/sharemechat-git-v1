package com.sharemechat.handler;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.Model;
import com.sharemechat.entity.User;
import com.sharemechat.master.repository.MasterModelSplitRepository;
import com.sharemechat.repository.ModelAssetRepository;
import com.sharemechat.repository.ModelRepository;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.service.ModelWindowService;
import com.sharemechat.service.NextRateLimitService;
import com.sharemechat.service.ProductOperationalModeService;
import com.sharemechat.service.SeenService;
import com.sharemechat.service.StatusService;
import com.sharemechat.service.StreamLockService;
import com.sharemechat.service.StreamService;
import com.sharemechat.service.UserBlockService;
import com.sharemechat.service.UserLanguageService;
import com.sharemechat.service.UserTrialService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * ADR-059: tests del EMPAREJAMIENTO random del WebSocket de matching.
 *
 * <p>Unit tests con {@code WebSocketSession} mockeado (sin Spring, sin Redis, sin BD).
 * La presencia del matching es in-memory (colas de sesiones en {@link MatchingRuntimeState}),
 * NO Redis, así que no hace falta infra. El {@code @BeforeEach} deja montado el "camino
 * feliz" (cliente CLIENT y modelo MODEL individual que casarían); cada test ajusta el
 * mock que quiere romper.
 *
 * <p>Casos: (1) modelo entra con cliente encolado → casa (blinda el bug 2026-08-11);
 * (2) sin oferta → no-client-available; (3) bloqueo mutuo → no casa; (4) modelo bajo
 * Master sin split vigente → excluida del pool (fail-CLOSED, ADR-056); (5) ranking por
 * idioma en el lado cliente (matchClient elige el modelo de mismo idioma aunque otro
 * entre antes); (6) viewer en rol USER → trial (startTrialStream, no startSession);
 * (7) USER sin trial disponible → trial-unavailable y no empareja; (8) next rate-limited
 * → next-ignored/rate-limit sin re-emparejar; (9) next en gracia → next-ignored/grace
 * sin consumir el rate-limit.
 */
class MatchingHandlerSupportMatchTest {

    private static final Long CLIENT_ID = 1L;
    private static final Long MODEL_ID = 2L;

    private UserRepository userRepository;
    private StreamService streamService;
    private SeenService seenService;
    private UserLanguageService userLanguageService;
    private StreamLockService streamLockService;
    private UserBlockService userBlockService;
    private StatusService statusService;
    private ModelRepository modelRepository;
    private MasterModelSplitRepository masterModelSplitRepository;
    private UserTrialService userTrialService;
    private NextRateLimitService nextRateLimitService;
    private ProductOperationalModeService productOperationalModeService;
    private ModelAssetRepository modelAssetRepository;
    private ModelWindowService modelWindowService;

    private MatchingRuntimeState state;
    private MatchingHandlerSupport support;
    private WebSocketSession clientSession;
    private WebSocketSession modelSession;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        streamService = mock(StreamService.class);
        seenService = mock(SeenService.class);
        userLanguageService = mock(UserLanguageService.class);
        streamLockService = mock(StreamLockService.class);
        userBlockService = mock(UserBlockService.class);
        statusService = mock(StatusService.class);
        modelRepository = mock(ModelRepository.class);
        masterModelSplitRepository = mock(MasterModelSplitRepository.class);
        userTrialService = mock(UserTrialService.class);
        nextRateLimitService = mock(NextRateLimitService.class);
        // Fase B go-live: por defecto ABIERTO (golive true + media presente) para
        // que los tests de emparejamiento sigan en el camino feliz.
        productOperationalModeService = mock(ProductOperationalModeService.class);
        when(productOperationalModeService.isModelGoliveEnabled()).thenReturn(true);
        when(productOperationalModeService.isClientGoliveEnabled()).thenReturn(true);
        modelAssetRepository = mock(ModelAssetRepository.class);
        when(modelAssetRepository.existsApprovedPrincipalActiveByUserAndType(anyLong(), anyString())).thenReturn(true);
        // Fase C: gate de ventana APAGADO por defecto (isEnabled()=false) -> no
        // afecta al camino feliz de los tests de emparejamiento.
        modelWindowService = mock(ModelWindowService.class);

        // Cliente CLIENT + FORM_CLIENT + KYC APPROVED.
        User clientUser = new User();
        clientUser.setId(CLIENT_ID);
        clientUser.setRole(Constants.Roles.CLIENT);
        clientUser.setUserType(Constants.UserTypes.FORM_CLIENT);
        clientUser.setClientKycStatus(Constants.VerificationStatuses.APPROVED);
        when(userRepository.findById(CLIENT_ID)).thenReturn(Optional.of(clientUser));

        // Modelo MODEL + verification APPROVED + activa.
        User modelUser = new User();
        modelUser.setId(MODEL_ID);
        modelUser.setRole(Constants.Roles.MODEL);
        modelUser.setVerificationStatus(Constants.VerificationStatuses.APPROVED);
        modelUser.setIsActive(true);
        modelUser.setUnsubscribe(false);
        when(userRepository.findById(MODEL_ID)).thenReturn(Optional.of(modelUser));

        // Defaults del camino feliz (cada test rompe lo que necesite).
        when(userBlockService.isBlockedBetween(anyLong(), anyLong())).thenReturn(false);
        when(modelRepository.findById(anyLong())).thenReturn(Optional.empty()); // no ban, no Master
        when(seenService.hasSeen(anyLong(), anyLong())).thenReturn(false);
        when(userLanguageService.languageMatchScore(anyLong(), anyLong())).thenReturn(100);
        when(streamLockService.newOwnerToken()).thenReturn("owner-1");
        when(streamLockService.tryLockClient(anyLong(), anyString(), any(Duration.class))).thenReturn(true);
        when(streamLockService.tryLockModel(anyLong(), anyString(), any(Duration.class))).thenReturn(true);
        when(statusService.getActiveSession(anyLong(), anyLong())).thenReturn(Optional.empty());

        state = new MatchingRuntimeState();
        support = new MatchingHandlerSupport(
                state, null, userRepository, streamService, null, null, null,
                statusService, null, null, userTrialService, userBlockService, seenService,
                streamLockService, nextRateLimitService, userLanguageService, null, null, null, null,
                modelRepository, masterModelSplitRepository,
                productOperationalModeService, modelAssetRepository, modelWindowService, 60);

        clientSession = newSession("sid-client", CLIENT_ID);
        modelSession = newSession("sid-model", MODEL_ID);
    }

    private WebSocketSession newSession(String sid, Long userId) {
        WebSocketSession s = mock(WebSocketSession.class);
        when(s.getId()).thenReturn(sid);
        when(s.isOpen()).thenReturn(true);
        state.getSessionsById().put(sid, s);
        state.getSessionUserIds().put(sid, userId);
        return s;
    }

    private void setRole(WebSocketSession s) throws Exception {
        support.handleTextMessage(s, new TextMessage("{\"type\":\"set-role\"}"));
    }

    private void startMatch(WebSocketSession s) throws Exception {
        support.handleTextMessage(s, new TextMessage("{\"type\":\"start-match\"}"));
    }

    private void next(WebSocketSession s) throws Exception {
        support.handleTextMessage(s, new TextMessage("{\"type\":\"next\"}"));
    }

    /** Registra un User MODEL aprobado y activo para {@code id} y devuelve su sesion en el pool. */
    private WebSocketSession newApprovedModel(Long id, String sid) {
        User m = new User();
        m.setId(id);
        m.setRole(Constants.Roles.MODEL);
        m.setVerificationStatus(Constants.VerificationStatuses.APPROVED);
        m.setIsActive(true);
        m.setUnsubscribe(false);
        when(userRepository.findById(id)).thenReturn(Optional.of(m));
        return newSession(sid, id);
    }

    /** Reemplaza el user del cliente por uno con el rol dado (userType FORM_CLIENT + KYC APPROVED). */
    private void setClientRole(String role) {
        User u = new User();
        u.setId(CLIENT_ID);
        u.setRole(role);
        u.setUserType(Constants.UserTypes.FORM_CLIENT);
        u.setClientKycStatus(Constants.VerificationStatuses.APPROVED);
        when(userRepository.findById(CLIENT_ID)).thenReturn(Optional.of(u));
    }

    private List<String> payloadsSentTo(WebSocketSession s) throws Exception {
        ArgumentCaptor<TextMessage> cap = ArgumentCaptor.forClass(TextMessage.class);
        verify(s, atLeast(0)).sendMessage(cap.capture());
        return cap.getAllValues().stream().map(TextMessage::getPayload).collect(Collectors.toList());
    }

    private boolean receivedType(WebSocketSession s, String type) throws Exception {
        return payloadsSentTo(s).stream().anyMatch(p -> p.contains("\"type\":\"" + type + "\""));
    }

    // --- Tests ---

    @Test
    void modelo_entra_con_cliente_encolado_empareja_y_notifica_a_ambos() throws Exception {
        setRole(clientSession);   // cliente encolado
        setRole(modelSession);    // modelo entra después -> matchModel proactivo

        verify(streamService).startSession(CLIENT_ID, MODEL_ID, Constants.StreamTypes.RANDOM);
        assertThat(receivedType(clientSession, "match")).isTrue();
        assertThat(receivedType(modelSession, "match")).isTrue();
        assertThat(state.getPairs().get("sid-model")).isEqualTo(clientSession);
        assertThat(state.getPairs().get("sid-client")).isEqualTo(modelSession);
    }

    @Test
    void modelo_sin_clientes_en_cola_recibe_no_client_available() throws Exception {
        setRole(modelSession);    // no hay ningún cliente encolado

        verify(streamService, never()).startSession(anyLong(), anyLong(), anyString());
        assertThat(receivedType(modelSession, "match")).isFalse();
        assertThat(receivedType(modelSession, "no-client-available")).isTrue();
    }

    @Test
    void modelo_golive_false_no_empareja_y_recibe_coming_soon() throws Exception {
        // Fase B: con la llave modelo en false, la modelo no entra al pool.
        when(productOperationalModeService.isModelGoliveEnabled()).thenReturn(false);

        setRole(clientSession);   // cliente encolado
        setRole(modelSession);    // modelo intenta -> bloqueada por coming-soon

        verify(streamService, never()).startSession(anyLong(), anyLong(), anyString());
        assertThat(receivedType(modelSession, "golive-coming-soon")).isTrue();
        assertThat(receivedType(modelSession, "match")).isFalse();
    }

    @Test
    void cliente_golive_false_no_empareja_y_recibe_coming_soon() throws Exception {
        // Fase B: con la llave cliente en false, el cliente (role=USER) no entra
        // al pool de videochat.
        when(productOperationalModeService.isClientGoliveEnabled()).thenReturn(false);

        setRole(clientSession);   // cliente intenta -> bloqueado por coming-soon
        setRole(modelSession);    // modelo entra pero no hay cliente en pool

        verify(streamService, never()).startSession(anyLong(), anyLong(), anyString());
        assertThat(receivedType(clientSession, "golive-coming-soon")).isTrue();
        assertThat(receivedType(clientSession, "match")).isFalse();
    }

    @Test
    void modelo_sin_video_aprobado_recibe_media_required_y_no_empareja() throws Exception {
        // Fase B: foto+video aprobados obligatorios. Sin VIDEO, no emite (aunque
        // golive este en true, que es el default del camino feliz).
        when(modelAssetRepository.existsApprovedPrincipalActiveByUserAndType(
                eq(MODEL_ID), eq(com.sharemechat.entity.ModelAsset.AssetType.VIDEO))).thenReturn(false);

        setRole(clientSession);
        setRole(modelSession);

        verify(streamService, never()).startSession(anyLong(), anyLong(), anyString());
        assertThat(receivedType(modelSession, "model-media-required")).isTrue();
        assertThat(receivedType(modelSession, "match")).isFalse();
    }

    @Test
    void modelo_fuera_de_ventana_horaria_recibe_window_closed_y_no_empareja() throws Exception {
        // Fase C: con el gate de ventana activo y la modelo fuera de su franja,
        // no entra al pool (golive+media están en true por el camino feliz).
        when(modelWindowService.isEnabled()).thenReturn(true);
        when(modelWindowService.isWithinWindow(any())).thenReturn(false);

        setRole(clientSession);
        setRole(modelSession);

        verify(streamService, never()).startSession(anyLong(), anyLong(), anyString());
        assertThat(receivedType(modelSession, "window-closed")).isTrue();
        assertThat(receivedType(modelSession, "match")).isFalse();
    }

    @Test
    void bloqueo_mutuo_no_empareja() throws Exception {
        when(userBlockService.isBlockedBetween(anyLong(), anyLong())).thenReturn(true); // canMatch=false

        setRole(clientSession);
        setRole(modelSession);

        verify(streamService, never()).startSession(anyLong(), anyLong(), anyString());
        assertThat(receivedType(clientSession, "match")).isFalse();
        assertThat(receivedType(modelSession, "match")).isFalse();
    }

    @Test
    void modelo_bajo_master_sin_split_vigente_no_empareja() throws Exception {
        // La modelo tiene master pero no hay split vigente -> isMasterModelWithoutSplit=true (fail-CLOSED).
        Model modelWithMaster = new Model();
        modelWithMaster.setMasterUserId(99L);
        when(modelRepository.findById(MODEL_ID)).thenReturn(Optional.of(modelWithMaster));
        when(masterModelSplitRepository
                .findFirstByMasterUserIdAndModelUserIdAndEffectiveToIsNullOrderByIdDesc(eq(99L), eq(MODEL_ID)))
                .thenReturn(Optional.empty());

        setRole(clientSession);
        setRole(modelSession);

        verify(streamService, never()).startSession(anyLong(), anyLong(), anyString());
        assertThat(receivedType(modelSession, "match")).isFalse();
    }

    @Test
    void cliente_elige_el_modelo_de_mejor_idioma_aunque_entre_antes_otro() throws Exception {
        // Dos modelos en cola: X (id 3, idioma distinto score<100) entra ANTES;
        // Y (MODEL_ID, mismo idioma score 100) entra DESPUES. El ranking del lado
        // cliente (rank 0 = mismo idioma) debe elegir a Y pese al orden FIFO.
        WebSocketSession modelX = newApprovedModel(3L, "sid-model-x");
        when(userLanguageService.languageMatchScore(CLIENT_ID, 3L)).thenReturn(50);
        // (CLIENT_ID, MODEL_ID) -> 100 por el default del @BeforeEach (mismo idioma).

        setRole(modelX);            // X se encola (matchModel proactivo, sin clientes)
        setRole(modelSession);      // Y se encola
        setRole(clientSession);     // cliente enrolado (set-role de cliente solo encola)
        startMatch(clientSession);  // cliente escanea modelos -> matchClient

        verify(streamService).startSession(CLIENT_ID, MODEL_ID, Constants.StreamTypes.RANDOM);
        verify(streamService, never()).startSession(eq(CLIENT_ID), eq(3L), anyString());
        assertThat(receivedType(clientSession, "match")).isTrue();
        assertThat(receivedType(modelSession, "match")).isTrue();   // Y casado
        assertThat(receivedType(modelX, "match")).isFalse();        // X descartado por peor idioma
    }

    @Test
    void viewer_en_rol_USER_dispara_trial_no_sesion_de_pago() throws Exception {
        setClientRole(Constants.Roles.USER);            // el cliente es USER (trial)
        when(userTrialService.canStartTrial(CLIENT_ID)).thenReturn(true);

        setRole(clientSession);   // USER se encola como "client"
        setRole(modelSession);    // modelo entra -> matchModel encuentra al USER

        verify(userTrialService).startTrialStream(CLIENT_ID, MODEL_ID);
        verify(streamService, never()).startSession(anyLong(), anyLong(), anyString());
        assertThat(receivedType(clientSession, "match")).isTrue();
        assertThat(receivedType(modelSession, "match")).isTrue();
    }

    @Test
    void viewer_USER_sin_trial_disponible_recibe_trial_unavailable_y_no_empareja() throws Exception {
        setClientRole(Constants.Roles.USER);
        when(userTrialService.canStartTrial(CLIENT_ID)).thenReturn(false);

        setRole(clientSession);
        setRole(modelSession);

        assertThat(receivedType(clientSession, "trial-unavailable")).isTrue();
        verify(userTrialService, never()).startTrialStream(anyLong(), anyLong());
        verify(streamService, never()).startSession(anyLong(), anyLong(), anyString());
        assertThat(receivedType(modelSession, "match")).isFalse();
    }

    @Test
    void next_rate_limited_devuelve_next_ignored_y_no_rematch() throws Exception {
        when(nextRateLimitService.checkAndConsume(CLIENT_ID)).thenReturn(Optional.of(3000L));

        next(clientSession);

        assertThat(payloadsSentTo(clientSession).stream().anyMatch(p ->
                p.contains("\"type\":\"next-ignored\"")
                        && p.contains("\"reason\":\"rate-limit\"")
                        && p.contains("\"retryAfterMs\":3000"))).isTrue();
        verify(streamService, never()).startSession(anyLong(), anyLong(), anyString());
    }

    @Test
    void next_en_periodo_de_gracia_devuelve_grace_sin_consumir_rate_limit() throws Exception {
        // lastMatchAt reciente (<1500ms) -> grace, corta antes del rate-limit.
        state.getLastMatchAt().put(clientSession.getId(), System.currentTimeMillis());

        next(clientSession);

        assertThat(receivedType(clientSession, "next-ignored")).isTrue();
        assertThat(payloadsSentTo(clientSession).stream()
                .anyMatch(p -> p.contains("\"reason\":\"grace\""))).isTrue();
        verify(nextRateLimitService, never()).checkAndConsume(anyLong());
        verify(streamService, never()).startSession(anyLong(), anyLong(), anyString());
    }

    @Test
    void cliente_sin_modelos_disponibles_recibe_no_model_available() throws Exception {
        // Cliente hace set-role + start-match sin ninguna modelo en el pool.
        setRole(clientSession);
        startMatch(clientSession);

        verify(streamService, never()).startSession(anyLong(), anyLong(), anyString());
        assertThat(receivedType(clientSession, "no-model-available")).isTrue();
    }
}
