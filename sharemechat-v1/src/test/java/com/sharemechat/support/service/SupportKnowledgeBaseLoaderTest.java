package com.sharemechat.support.service;

import com.sharemechat.support.config.ClaudeApiProperties;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SupportKnowledgeBaseLoaderTest {

    @Test
    @DisplayName("classpath:knowledge-base/ -> carga al menos 1 md (00-placeholder.md)")
    void loadsPlaceholder() {
        ClaudeApiProperties props = mock(ClaudeApiProperties.class);
        when(props.getKbDirectory()).thenReturn("classpath:knowledge-base/");
        SupportKnowledgeBaseLoader loader = new SupportKnowledgeBaseLoader(props);
        loader.reload();
        assertTrue(loader.getFileCount() >= 1);
        assertTrue(loader.getKnowledgeBase().length() > 100);
        assertTrue(loader.getKnowledgeBase().contains("SharemeChat"));
    }

    @Test
    @DisplayName("directory blank -> KB queda vacio sin throw")
    void directoryBlank() {
        ClaudeApiProperties props = mock(ClaudeApiProperties.class);
        when(props.getKbDirectory()).thenReturn("");
        SupportKnowledgeBaseLoader loader = new SupportKnowledgeBaseLoader(props);
        loader.reload();
        assertEquals(0, loader.getFileCount());
        assertEquals("", loader.getKnowledgeBase());
    }

    @Test
    @DisplayName("classpath sin pattern trailing slash -> aun asi carga")
    void noTrailingSlash() {
        ClaudeApiProperties props = mock(ClaudeApiProperties.class);
        when(props.getKbDirectory()).thenReturn("classpath:knowledge-base");
        SupportKnowledgeBaseLoader loader = new SupportKnowledgeBaseLoader(props);
        loader.reload();
        assertTrue(loader.getFileCount() >= 1);
    }

    @Test
    @DisplayName("KB no incluye README.md (excluido por convencion)")
    void readmeExcluded() {
        ClaudeApiProperties props = mock(ClaudeApiProperties.class);
        when(props.getKbDirectory()).thenReturn("classpath:knowledge-base/");
        SupportKnowledgeBaseLoader loader = new SupportKnowledgeBaseLoader(props);
        loader.reload();
        assertFalse(loader.getKnowledgeBase().contains("Knowledge Base — SharemeChat Support Bot"));
    }
}
