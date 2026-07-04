package com.sharemechat.support.service;

import com.sharemechat.support.entity.SupportBotPrompt;
import com.sharemechat.support.repository.SupportBotPromptRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class KnowledgeBaseServiceTest {

    private static SupportBotPrompt prompt(String caseKey, String role, String content, boolean active) {
        SupportBotPrompt p = new SupportBotPrompt();
        p.setCaseKey(caseKey);
        p.setRole(role);
        p.setContent(content);
        p.setActive(active);
        return p;
    }

    @Test
    @DisplayName("hydrateOnStartup + getPromptContent — happy path con 2 prompts activos")
    void hydrateAndGet() {
        SupportBotPromptRepository repo = mock(SupportBotPromptRepository.class);
        when(repo.findAllByActive(true)).thenReturn(List.of(
                prompt("comportamiento-agente-ia", "BOTH", "reglas del agente", true),
                prompt("producto", "BOTH", "que es sharemechat", true)
        ));

        KnowledgeBaseService service = new KnowledgeBaseService(repo);
        service.hydrateOnStartup();

        assertEquals(Optional.of("reglas del agente"),
                service.getPromptContent("comportamiento-agente-ia"));
        assertEquals(Optional.of("que es sharemechat"),
                service.getPromptContent("producto"));
        assertEquals(Optional.empty(), service.getPromptContent("no-existe"));
        assertEquals(Optional.empty(), service.getPromptContent(null));
        assertEquals(Optional.empty(), service.getPromptContent(""));
    }

    @Test
    @DisplayName("reload — sustituye la caché con el snapshot actual del repo")
    void reloadSwapsCache() {
        SupportBotPromptRepository repo = mock(SupportBotPromptRepository.class);

        when(repo.findAllByActive(true)).thenReturn(List.of(
                prompt("producto", "BOTH", "v1", true)
        ));
        KnowledgeBaseService service = new KnowledgeBaseService(repo);
        service.hydrateOnStartup();
        assertEquals(Optional.of("v1"), service.getPromptContent("producto"));

        when(repo.findAllByActive(true)).thenReturn(List.of(
                prompt("producto", "BOTH", "v2", true),
                prompt("onboarding-cliente", "CLIENT", "flujo alta", true)
        ));
        long loaded = service.reload();

        assertEquals(2L, loaded);
        assertEquals(Optional.of("v2"), service.getPromptContent("producto"));
        assertEquals(Optional.of("flujo alta"), service.getPromptContent("onboarding-cliente"));
    }

    @Test
    @DisplayName("getStats — devuelve conteos y timestamp tras carga; no expone content")
    void statsExposeCountsNotContent() {
        SupportBotPromptRepository repo = mock(SupportBotPromptRepository.class);
        when(repo.findAllByActive(true)).thenReturn(List.of(
                prompt("producto", "BOTH", "contenido no debe filtrarse por getStats", true)
        ));

        KnowledgeBaseService service = new KnowledgeBaseService(repo);
        service.hydrateOnStartup();
        Map<String, Object> stats = service.getStats();

        assertEquals(1L, stats.get("cachedPromptCount"));
        assertEquals(1L, stats.get("lastLoadedCount"));
        assertNotNull(stats.get("lastLoadedAt"));
        assertFalse(stats.values().stream()
                        .anyMatch(v -> v instanceof String && ((String) v).contains("contenido")),
                "getStats no debe exponer content");
    }

    @Test
    @DisplayName("filtra entradas con caseKey o content nulo")
    void ignoresNulls() {
        SupportBotPromptRepository repo = mock(SupportBotPromptRepository.class);
        SupportBotPrompt nullKey = new SupportBotPrompt();
        nullKey.setCaseKey(null);
        nullKey.setContent("orphan");
        SupportBotPrompt nullContent = new SupportBotPrompt();
        nullContent.setCaseKey("empty");
        nullContent.setContent(null);
        when(repo.findAllByActive(true)).thenReturn(List.of(
                prompt("ok", "BOTH", "valido", true),
                nullKey,
                nullContent
        ));

        KnowledgeBaseService service = new KnowledgeBaseService(repo);
        service.hydrateOnStartup();

        assertEquals(Optional.of("valido"), service.getPromptContent("ok"));
        assertEquals(Optional.empty(), service.getPromptContent("empty"));
        // La caché estimada puede reportar sólo los entries efectivamente puestos
        assertEquals(1L, service.getStats().get("cachedPromptCount"));
    }
}
