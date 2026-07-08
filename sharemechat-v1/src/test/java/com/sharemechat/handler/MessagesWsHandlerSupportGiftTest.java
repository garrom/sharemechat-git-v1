package com.sharemechat.handler;

import com.sharemechat.constants.Constants;
import com.sharemechat.dto.MessageDTO;
import com.sharemechat.entity.Gift;
import com.sharemechat.entity.User;
import com.sharemechat.repository.BalanceRepository;
import com.sharemechat.repository.GiftRepository;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.service.FavoriteService;
import com.sharemechat.service.MessageService;
import com.sharemechat.service.TransactionService;
import com.sharemechat.service.UserBlockService;
import org.json.JSONObject;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

/**
 * Tests unitarios de la validacion de rol + tier en handleMsgGift (Fase 2
 * chat P2P). Cubre los tres caminos criticos:
 *
 *   1. MODEL -> CLIENT con tier=QUICK (FREE_EMOJI): OK, sin charge.
 *   2. MODEL -> CLIENT con tier=PREMIUM (PAID_GIFT): rechazo con msg:error
 *      "Los modelos solo pueden enviar regalos gratuitos".
 *   3. Combinaciones invalidas (CLIENT->CLIENT, MODEL->MODEL): rechazo por
 *      combinacion de roles no permitida.
 *
 * El camino CLIENT -> MODEL (charge economico) sigue delegado a
 * TransactionService y no se ejercita aqui para no acoplar el test a la
 * mecanica de wallet locks; lo cubre el smoke manual del operador.
 *
 * Se invoca handleMsgGift via reflection (metodo privado del handler).
 */
class MessagesWsHandlerSupportGiftTest {

    private static final long MODEL_ID = 100L;
    private static final long CLIENT_ID = 200L;
    private static final String SESSION_ID = "test-session-id";

    private UserRepository userRepository;
    private FavoriteService favoriteService;
    private UserBlockService userBlockService;
    private GiftRepository giftRepository;
    private MessageService messageService;
    private TransactionService transactionService;
    private MessagesRuntimeState state;
    private MessagesWsHandlerSupport handler;
    private WebSocketSession session;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        favoriteService = mock(FavoriteService.class);
        userBlockService = mock(UserBlockService.class);
        giftRepository = mock(GiftRepository.class);
        messageService = mock(MessageService.class);
        transactionService = mock(TransactionService.class);

        session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn(SESSION_ID);
        when(session.isOpen()).thenReturn(true);

        when(userBlockService.isBlockedBetween(anyLong(), anyLong())).thenReturn(false);
        when(favoriteService.canUsersMessage(anyLong(), anyLong())).thenReturn(true);

        state = new MessagesRuntimeState();

        handler = new MessagesWsHandlerSupport(
                state, null, userRepository, favoriteService, messageService,
                transactionService, null, null, null, null, null,
                userBlockService, mock(BalanceRepository.class), null, null,
                null, null, null, giftRepository);
    }

    private User userWith(long id, String role) {
        User u = new User();
        u.setRole(role);
        try {
            java.lang.reflect.Field f = User.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(u, id);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
        return u;
    }

    private Gift giftWith(long id, String tier) {
        Gift g = new Gift();
        g.setTier(tier);
        g.setCost(new BigDecimal("QUICK".equals(tier) ? "0.00" : "5.00"));
        g.setName("gift-" + id);
        g.setIcon("/img/gift-" + id + ".png");
        try {
            java.lang.reflect.Field f = Gift.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(g, id);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
        return g;
    }

    private void bindSessionTo(long userId) {
        state.getSessionUserIds().put(SESSION_ID, userId);
    }

    private void invokeHandle(long to, long giftId) throws Exception {
        JSONObject json = new JSONObject()
                .put("type", "msg:gift")
                .put("to", String.valueOf(to))
                .put("giftId", giftId);
        Method m = MessagesWsHandlerSupport.class.getDeclaredMethod(
                "handleMsgGift", WebSocketSession.class, JSONObject.class);
        m.setAccessible(true);
        m.invoke(handler, session, json);
    }

    private List<String> allSentPayloads() throws IOException {
        ArgumentCaptor<TextMessage> captor = ArgumentCaptor.forClass(TextMessage.class);
        verify(session, atLeastOnce()).sendMessage(captor.capture());
        return captor.getAllValues().stream().map(TextMessage::getPayload).toList();
    }

    @Test
    @DisplayName("MODEL -> CLIENT con tier=PREMIUM: rechazo con mensaje 'Los modelos solo pueden enviar regalos gratuitos'")
    void modelToClientPaidRejected() throws Exception {
        bindSessionTo(MODEL_ID);
        when(userRepository.findById(MODEL_ID)).thenReturn(Optional.of(userWith(MODEL_ID, Constants.Roles.MODEL)));
        when(userRepository.findById(CLIENT_ID)).thenReturn(Optional.of(userWith(CLIENT_ID, Constants.Roles.CLIENT)));
        Gift paid = giftWith(77L, "PREMIUM");
        when(giftRepository.findByIdAndActiveTrue(77L)).thenReturn(Optional.of(paid));

        invokeHandle(CLIENT_ID, 77L);

        List<String> sent = allSentPayloads();
        String last = sent.get(sent.size() - 1);
        assertTrue(last.contains("Los modelos solo pueden enviar regalos gratuitos"),
                "Debe rechazar con mensaje explicito. Payload real: " + last);
        assertTrue(last.contains("msg:error"), "Tipo msg:error esperado. Payload: " + last);
        verify(messageService, never()).sendGift(anyLong(), anyLong(), any(Gift.class));
        verify(transactionService, never()).processGift(anyLong(), anyLong(), anyLong(), any());
        verify(transactionService, never()).processGiftInChat(anyLong(), anyLong(), anyLong());
    }

    @Test
    @DisplayName("MODEL -> CLIENT con tier=QUICK: OK, messageService.sendGift llamado sin charge")
    void modelToClientFreeOk() throws Exception {
        bindSessionTo(MODEL_ID);
        when(userRepository.findById(MODEL_ID)).thenReturn(Optional.of(userWith(MODEL_ID, Constants.Roles.MODEL)));
        when(userRepository.findById(CLIENT_ID)).thenReturn(Optional.of(userWith(CLIENT_ID, Constants.Roles.CLIENT)));
        Gift free = giftWith(88L, "QUICK");
        when(giftRepository.findByIdAndActiveTrue(88L)).thenReturn(Optional.of(free));

        MessageDTO fakeSaved = new MessageDTO(
                999L, MODEL_ID, CLIENT_ID, null,
                java.time.LocalDateTime.now(), null,
                new MessageDTO.GiftSnapshotDTO(88L, null, "gift-88", "/img/gift-88.png",
                        BigDecimal.ZERO, "QUICK", Boolean.FALSE));
        when(messageService.sendGift(MODEL_ID, CLIENT_ID, free)).thenReturn(fakeSaved);

        invokeHandle(CLIENT_ID, 88L);

        verify(messageService, times(1)).sendGift(MODEL_ID, CLIENT_ID, free);
        verify(transactionService, never()).processGift(anyLong(), anyLong(), anyLong(), any());
        verify(transactionService, never()).processGiftInChat(anyLong(), anyLong(), anyLong());
    }

    @Test
    @DisplayName("MODEL -> MODEL: rechazo por combinacion de roles no permitida")
    void modelToModelRejected() throws Exception {
        long peerModelId = 300L;
        bindSessionTo(MODEL_ID);
        when(userRepository.findById(MODEL_ID)).thenReturn(Optional.of(userWith(MODEL_ID, Constants.Roles.MODEL)));
        when(userRepository.findById(peerModelId)).thenReturn(Optional.of(userWith(peerModelId, Constants.Roles.MODEL)));

        invokeHandle(peerModelId, 55L);

        List<String> sent = allSentPayloads();
        String last = sent.get(sent.size() - 1);
        assertTrue(last.contains("Combinacion de roles no permitida"),
                "Debe rechazar por combinacion de roles. Payload: " + last);
        verify(messageService, never()).sendGift(anyLong(), anyLong(), any(Gift.class));
        verify(giftRepository, never()).findByIdAndActiveTrue(anyLong());
    }

    @Test
    @DisplayName("CLIENT -> CLIENT: rechazo por combinacion de roles no permitida")
    void clientToClientRejected() throws Exception {
        long peerClientId = 400L;
        bindSessionTo(CLIENT_ID);
        when(userRepository.findById(CLIENT_ID)).thenReturn(Optional.of(userWith(CLIENT_ID, Constants.Roles.CLIENT)));
        when(userRepository.findById(peerClientId)).thenReturn(Optional.of(userWith(peerClientId, Constants.Roles.CLIENT)));

        invokeHandle(peerClientId, 55L);

        List<String> sent = allSentPayloads();
        String last = sent.get(sent.size() - 1);
        assertTrue(last.contains("Combinacion de roles no permitida"),
                "Debe rechazar por combinacion de roles. Payload: " + last);
        verify(messageService, never()).sendGift(anyLong(), anyLong(), any(Gift.class));
    }

    @Test
    @DisplayName("MODEL -> CLIENT con giftId inexistente: rechazo con 'Regalo inexistente o inactivo'")
    void modelToClientUnknownGiftRejected() throws Exception {
        bindSessionTo(MODEL_ID);
        when(userRepository.findById(MODEL_ID)).thenReturn(Optional.of(userWith(MODEL_ID, Constants.Roles.MODEL)));
        when(userRepository.findById(CLIENT_ID)).thenReturn(Optional.of(userWith(CLIENT_ID, Constants.Roles.CLIENT)));
        when(giftRepository.findByIdAndActiveTrue(999L)).thenReturn(Optional.empty());

        invokeHandle(CLIENT_ID, 999L);

        List<String> sent = allSentPayloads();
        String last = sent.get(sent.size() - 1);
        assertTrue(last.contains("Regalo inexistente o inactivo"),
                "Debe rechazar si el gift no existe. Payload: " + last);
        verify(messageService, never()).sendGift(anyLong(), anyLong(), any(Gift.class));
    }
}
