package com.sharemechat.support.service;

import com.sharemechat.support.entity.SupportBotPrompt;
import com.sharemechat.support.repository.SupportBotPromptRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * ADR-060: UPSERT idempotente ({@link KnowledgeBaseService#sync}) y estado con
 * hashes ({@link KnowledgeBaseService#state}). Repo mockeado, sin contexto Spring.
 */
class KnowledgeBaseServiceTest {

    private SupportBotPromptRepository repository;
    private KnowledgeBaseService svc;

    @BeforeEach
    void setUp() {
        repository = mock(SupportBotPromptRepository.class);
        // reload() (invocado al final de sync) lee active=true; irrelevante para el diff.
        when(repository.findAllByActive(true)).thenReturn(List.of());
        svc = new KnowledgeBaseService(repository);
    }

    private static SupportBotPrompt row(String caseKey, String role, String content,
                                        int version, boolean active) {
        SupportBotPrompt p = new SupportBotPrompt();
        p.setCaseKey(caseKey);
        p.setRole(role);
        p.setContent(content);
        p.setVersion(version);
        p.setActive(active);
        return p;
    }

    @Test
    @DisplayName("sync: INSERT nuevo, UPDATE cambiado (bump version), UNCHANGED igual")
    void sync_upsert_diff() {
        SupportBotPrompt a = row("a", "BOTH", "content-a", 1, true);
        SupportBotPrompt b = row("b", "BOTH", "content-b", 1, true);
        when(repository.findAll()).thenReturn(new ArrayList<>(List.of(a, b)));

        List<KnowledgeBaseService.SyncInput> inputs = List.of(
                new KnowledgeBaseService.SyncInput("a", "BOTH", "content-a", null, true),
                new KnowledgeBaseService.SyncInput("b", "BOTH", "content-b-NEW", null, true),
                new KnowledgeBaseService.SyncInput("c", "CLIENT", "content-c", null, true));

        KnowledgeBaseService.SyncResult r = svc.sync(inputs);

        assertEquals(List.of("c"), r.created);
        assertEquals(List.of("b"), r.updated);
        assertEquals(List.of("a"), r.unchanged);
        assertTrue(r.deactivated.isEmpty());
        assertEquals(2, b.getVersion(), "content cambiado debe subir version");
        assertEquals(1, a.getVersion(), "sin cambios no toca version");
    }

    @Test
    @DisplayName("sync: cambio SOLO de metadatos actualiza sin bump de version")
    void sync_metadata_only_no_version_bump() {
        SupportBotPrompt a = row("a", "BOTH", "same-content", 5, true);
        when(repository.findAll()).thenReturn(new ArrayList<>(List.of(a)));

        // mismo content, distinta description
        KnowledgeBaseService.SyncResult r = svc.sync(List.of(
                new KnowledgeBaseService.SyncInput("a", "BOTH", "same-content", "nueva desc", true)));

        assertEquals(List.of("a"), r.updated);
        assertEquals(5, a.getVersion(), "cambio de metadatos no sube version");
        assertEquals("nueva desc", a.getDescription());
    }

    @Test
    @DisplayName("sync: case_key ausente del payload -> soft-delete (active=false), nunca borra")
    void sync_soft_delete_missing() {
        SupportBotPrompt a = row("a", "BOTH", "x", 1, true);
        when(repository.findAll()).thenReturn(new ArrayList<>(List.of(a)));

        KnowledgeBaseService.SyncResult r = svc.sync(List.of(
                new KnowledgeBaseService.SyncInput("b", "BOTH", "y", null, true)));

        assertEquals(List.of("b"), r.created);
        assertEquals(List.of("a"), r.deactivated);
        assertFalse(a.isActive(), "el ausente queda inactivo");
        verify(repository, never()).delete(any());
        verify(repository, never()).deleteById(any());
    }

    @Test
    @DisplayName("sync idempotente: segunda pasada sin cambios = 0 updates")
    void sync_idempotent() {
        SupportBotPrompt a = row("a", "BOTH", "content-a", 1, true);
        when(repository.findAll()).thenReturn(new ArrayList<>(List.of(a)));

        KnowledgeBaseService.SyncResult r = svc.sync(List.of(
                new KnowledgeBaseService.SyncInput("a", "BOTH", "content-a", null, true)));

        assertTrue(r.created.isEmpty());
        assertTrue(r.updated.isEmpty());
        assertEquals(List.of("a"), r.unchanged);
        assertTrue(r.deactivated.isEmpty());
    }

    @Test
    @DisplayName("state: devuelve hash SHA-256 del content, nunca el content")
    void state_returns_hash_not_content() {
        SupportBotPrompt a = row("a", "BOTH", "hello", 3, true);
        when(repository.findAll()).thenReturn(new ArrayList<>(List.of(a)));

        List<Map<String, Object>> st = svc.state();

        assertEquals(1, st.size());
        Map<String, Object> m = st.get(0);
        assertEquals("a", m.get("caseKey"));
        assertEquals(3, m.get("version"));
        assertEquals(true, m.get("active"));
        assertEquals(KnowledgeBaseService.sha256("hello"), m.get("contentHash"));
        assertFalse(m.containsValue("hello"), "no debe filtrar el content");
    }

    @Test
    @DisplayName("sha256: determinista y distinto por input")
    void sha256_deterministic() {
        assertEquals(KnowledgeBaseService.sha256("abc"), KnowledgeBaseService.sha256("abc"));
        assertNotEquals(KnowledgeBaseService.sha256("abc"), KnowledgeBaseService.sha256("abd"));
        assertNull(KnowledgeBaseService.sha256(null));
    }
}
