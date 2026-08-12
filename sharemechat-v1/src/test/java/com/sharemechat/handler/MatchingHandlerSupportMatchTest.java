package com.sharemechat.handler;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.User;
import com.sharemechat.repository.ModelRepository;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.service.SeenService;
import com.sharemechat.service.StatusService;
import com.sharemechat.service.StreamLockService;
import com.sharemechat.service.StreamService;
import com.sharemechat.service.UserBlockService;
import com.sharemechat.service.UserLanguageService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.time.Duration;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * ADR-059: test del EMPAREJAMIENTO random del WebSocket de matching.
 *
 * <p>Reproduce y blinda el escenario del bug corregido el 2026-08-11: un cliente
 * encolado + una modelo que entra DESPUÉS deben casar. Antes el path {@code set-role}
 * de la modelo solo encolaba y no re-escaneaba la cola de clientes, así que un
 * cliente que llegó primero no casaba nunca; el fix añadió {@code matchModel(session)}
 * en ese path (empareja proactivamente).
 *
 * <p>Unit test con {@code WebSocketSession} mockeado (sin Spring, sin Redis, sin BD):
 * la presencia del matching es in-memory (colas de sesiones en {@link MatchingRuntimeState}),
 * NO Redis, así que no hace falta infra. Solo se stubbean los servicios que el flujo
 * usa de verdad; las dependencias con try/catch defensivo (liveness, balance) se
 * pasan null y su NPE queda tragado (gate pasa / balance 0).
 */
class MatchingHandlerSupportMatchTest {

    @Test
    void modelo_entra_con_cliente_encolado_empareja_y_notifica_a_ambos() throws Exception {
        UserRepository userRepository = mock(UserRepository.class);
        StreamService streamService = mock(StreamService.class);
        SeenService seenService = mock(SeenService.class);
        UserLanguageService userLanguageService = mock(UserLanguageService.class);
        StreamLockService streamLockService = mock(StreamLockService.class);
        UserBlockService userBlockService = mock(UserBlockService.class);
        StatusService statusService = mock(StatusService.class);
        ModelRepository modelRepository = mock(ModelRepository.class);

        final Long clientId = 1L, modelId = 2L;

        // Cliente: CLIENT + FORM_CLIENT + KYC APPROVED (pasa isApprovedClient, viewer no-trial).
        User clientUser = new User();
        clientUser.setId(clientId);
        clientUser.setRole(Constants.Roles.CLIENT);
        clientUser.setUserType(Constants.UserTypes.FORM_CLIENT);
        clientUser.setClientKycStatus(Constants.VerificationStatuses.APPROVED);
        when(userRepository.findById(clientId)).thenReturn(Optional.of(clientUser));

        // Modelo: MODEL + verification APPROVED + activa (pasa isApprovedActiveModel).
        User modelUser = new User();
        modelUser.setId(modelId);
        modelUser.setRole(Constants.Roles.MODEL);
        modelUser.setVerificationStatus(Constants.VerificationStatuses.APPROVED);
        modelUser.setIsActive(true);
        modelUser.setUnsubscribe(false);
        when(userRepository.findById(modelId)).thenReturn(Optional.of(modelUser));

        // Gates y flujo de emparejamiento.
        when(userBlockService.isBlockedBetween(anyLong(), anyLong())).thenReturn(false);
        when(modelRepository.findById(anyLong())).thenReturn(Optional.empty()); // no ban, no Master
        when(seenService.hasSeen(anyLong(), anyLong())).thenReturn(false);
        when(userLanguageService.languageMatchScore(anyLong(), anyLong())).thenReturn(100);
        when(streamLockService.newOwnerToken()).thenReturn("owner-1");
        when(streamLockService.tryLockClient(anyLong(), anyString(), any(Duration.class))).thenReturn(true);
        when(streamLockService.tryLockModel(anyLong(), anyString(), any(Duration.class))).thenReturn(true);
        when(statusService.getActiveSession(anyLong(), anyLong())).thenReturn(Optional.empty());

        MatchingRuntimeState state = new MatchingRuntimeState();

        // Constructor de 23 args: null para lo que el flujo no usa (o traga NPE).
        MatchingHandlerSupport support = new MatchingHandlerSupport(
                state,               // MatchingRuntimeState (real)
                null,                // JwtUtil
                userRepository,
                streamService,
                null,                // TransactionService
                null,                // MessageService
                null,                // MessagesWsHandler
                statusService,
                null,                // BalanceRepository (getCurrentBalanceOrZero traga NPE -> 0)
                null,                // StreamRecordRepository
                null,                // UserTrialService (cliente no-trial no lo toca)
                userBlockService,
                seenService,
                streamLockService,
                null,                // NextRateLimitService
                userLanguageService,
                null,                // AgeGatePolicyService
                null,                // ProductAccessGuardService
                null,                // LivenessChallengeService
                null,                // LivenessProperties (null -> gate liveness pasa)
                modelRepository,
                null,                // MasterModelSplitRepository (no se llega: modelo individual)
                60                   // seenMaxScan
        );

        // Dos sesiones WS.
        WebSocketSession clientSession = mock(WebSocketSession.class);
        when(clientSession.getId()).thenReturn("sid-client");
        when(clientSession.isOpen()).thenReturn(true);
        WebSocketSession modelSession = mock(WebSocketSession.class);
        when(modelSession.getId()).thenReturn("sid-model");
        when(modelSession.isOpen()).thenReturn(true);

        // Simular la conexión (lo que haría afterConnectionEstablished vía JWT).
        state.getSessionsById().put("sid-client", clientSession);
        state.getSessionUserIds().put("sid-client", clientId);
        state.getSessionsById().put("sid-model", modelSession);
        state.getSessionUserIds().put("sid-model", modelId);

        // 1) El cliente hace set-role -> queda encolado (aún no hay modelo).
        support.handleTextMessage(clientSession, new TextMessage("{\"type\":\"set-role\"}"));

        // 2) La modelo hace set-role DESPUÉS -> matchModel proactivo casa con el cliente.
        support.handleTextMessage(modelSession, new TextMessage("{\"type\":\"set-role\"}"));

        // Se creó la sesión de streaming del par.
        verify(streamService).startSession(clientId, modelId, Constants.StreamTypes.RANDOM);

        // Ambos peers recibieron un mensaje "match".
        ArgumentCaptor<TextMessage> clientMsg = ArgumentCaptor.forClass(TextMessage.class);
        verify(clientSession, atLeastOnce()).sendMessage(clientMsg.capture());
        assertThat(clientMsg.getAllValues())
                .anyMatch(m -> m.getPayload().contains("\"type\":\"match\""));

        ArgumentCaptor<TextMessage> modelMsg = ArgumentCaptor.forClass(TextMessage.class);
        verify(modelSession, atLeastOnce()).sendMessage(modelMsg.capture());
        assertThat(modelMsg.getAllValues())
                .anyMatch(m -> m.getPayload().contains("\"type\":\"match\""));

        // El par quedó registrado en el estado runtime (ambos sentidos).
        assertThat(state.getPairs().get("sid-model")).isEqualTo(clientSession);
        assertThat(state.getPairs().get("sid-client")).isEqualTo(modelSession);
    }
}
