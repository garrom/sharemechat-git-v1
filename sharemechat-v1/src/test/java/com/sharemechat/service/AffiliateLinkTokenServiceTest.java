package com.sharemechat.service;

import com.sharemechat.entity.AffiliateLinkToken;
import com.sharemechat.repository.AffiliateLinkTokenRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * ADR-049 Subpasada 2B: unit test de {@link AffiliateLinkTokenService}.
 * Cubre generate + invalidacion previa D17 + consume happy + consume
 * expired/consumed/not_found.
 */
class AffiliateLinkTokenServiceTest {

    private AffiliateLinkTokenRepository repo;
    private AffiliateLinkTokenService svc;

    @BeforeEach
    void setUp() {
        repo = mock(AffiliateLinkTokenRepository.class);
        when(repo.save(any(AffiliateLinkToken.class))).thenAnswer(inv -> inv.getArgument(0));
        svc = new AffiliateLinkTokenService(repo, 72);
    }

    @Test
    @DisplayName("Generate happy: persiste token con expires_at futuro y devuelve plain no vacio")
    void generate_happy() {
        when(repo.findByModelUserIdAndEmailAndConsumedAtIsNullOrderByCreatedAtDesc(eq(97L), any()))
                .thenReturn(List.of());

        String tokenPlain = svc.generate(97L, "visitor@x.com");
        assertNotNull(tokenPlain);
        assertTrue(tokenPlain.length() >= 32);

        ArgumentCaptor<AffiliateLinkToken> cap = ArgumentCaptor.forClass(AffiliateLinkToken.class);
        verify(repo, times(1)).save(cap.capture());
        AffiliateLinkToken saved = cap.getValue();
        assertEquals(97L, saved.getModelUserId());
        assertEquals("visitor@x.com", saved.getEmail());
        assertNotNull(saved.getTokenHash());
        assertEquals(64, saved.getTokenHash().length(), "SHA-256 hex debe tener 64 chars.");
        assertTrue(saved.getExpiresAt().isAfter(LocalDateTime.now().plusHours(70)));
    }

    @Test
    @DisplayName("D17: invalida tokens previos vivos (consumed_at NULL) al generar nuevo para mismo email")
    void generate_invalidatesPreviousToken() {
        AffiliateLinkToken previous = new AffiliateLinkToken();
        previous.setTokenHash("prevhash");
        previous.setModelUserId(97L);
        previous.setEmail("visitor@x.com");
        previous.setExpiresAt(LocalDateTime.now().plusHours(24));

        when(repo.findByModelUserIdAndEmailAndConsumedAtIsNullOrderByCreatedAtDesc(eq(97L), eq("visitor@x.com")))
                .thenReturn(List.of(previous));

        svc.generate(97L, "visitor@x.com");

        verify(repo, times(2)).save(any(AffiliateLinkToken.class));
        assertNotNull(previous.getConsumedAt(), "El token previo debe quedar marcado consumido.");
    }

    @Test
    @DisplayName("Consume happy: hasheo del plain coincide, marca consumed_at, devuelve modelUserId+email")
    void consume_happy() {
        String plain = "abcdef1234567890";
        String hash = sha256(plain);
        AffiliateLinkToken token = new AffiliateLinkToken();
        token.setTokenHash(hash);
        token.setModelUserId(97L);
        token.setEmail("v@x.com");
        token.setExpiresAt(LocalDateTime.now().plusHours(1));
        when(repo.findByTokenHash(hash)).thenReturn(Optional.of(token));

        AffiliateLinkTokenService.ConsumeResult result = svc.consume(plain);
        assertEquals(97L, result.modelUserId());
        assertEquals("v@x.com", result.email());
        assertNotNull(token.getConsumedAt());
    }

    @Test
    @DisplayName("Consume: token no existe → IllegalStateException(token_not_found)")
    void consume_notFound() {
        when(repo.findByTokenHash(any())).thenReturn(Optional.empty());
        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> svc.consume("xxxx"));
        assertEquals(AffiliateLinkTokenService.ERR_TOKEN_NOT_FOUND, ex.getMessage());
    }

    @Test
    @DisplayName("Consume: token ya consumido → IllegalStateException(token_consumed)")
    void consume_alreadyConsumed() {
        String plain = "plain12";
        AffiliateLinkToken token = new AffiliateLinkToken();
        token.setTokenHash(sha256(plain));
        token.setModelUserId(97L);
        token.setEmail("v@x.com");
        token.setExpiresAt(LocalDateTime.now().plusHours(1));
        token.setConsumedAt(LocalDateTime.now().minusMinutes(5));
        when(repo.findByTokenHash(any())).thenReturn(Optional.of(token));

        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> svc.consume(plain));
        assertEquals(AffiliateLinkTokenService.ERR_TOKEN_CONSUMED, ex.getMessage());
    }

    @Test
    @DisplayName("Consume: token expirado → IllegalStateException(token_expired)")
    void consume_expired() {
        String plain = "plainX";
        AffiliateLinkToken token = new AffiliateLinkToken();
        token.setTokenHash(sha256(plain));
        token.setModelUserId(97L);
        token.setEmail("v@x.com");
        token.setExpiresAt(LocalDateTime.now().minusHours(1));
        when(repo.findByTokenHash(any())).thenReturn(Optional.of(token));

        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> svc.consume(plain));
        assertEquals(AffiliateLinkTokenService.ERR_TOKEN_EXPIRED, ex.getMessage());
    }

    private static String sha256(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] d = md.digest(input.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(64);
            for (byte b : d) sb.append(String.format("%02x", b & 0xff));
            return sb.toString();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
