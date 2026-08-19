package com.sharemechat.support.dto;

import java.util.List;

/**
 * ADR-060: payload de sincronización de la Base de Conocimiento del Agente IA
 * desde la fuente en git ({@code support-kb/*.md}). Lo envía
 * {@code ops/scripts/sync-support-kb.ps1} al endpoint
 * {@code POST /api/admin/knowledge-base/sync}.
 *
 * <p>Cada {@link Item} corresponde a un fichero: su front-matter
 * ({@code case_key}, {@code role}, {@code active}, {@code description}) más el
 * cuerpo markdown ({@code content}).</p>
 */
public class SupportKbSyncRequestDTO {

    private List<Item> prompts;

    public List<Item> getPrompts() {
        return prompts;
    }

    public void setPrompts(List<Item> prompts) {
        this.prompts = prompts;
    }

    public static class Item {
        private String caseKey;
        private String role;
        private String content;
        private String description;
        private Boolean active;

        public String getCaseKey() {
            return caseKey;
        }

        public void setCaseKey(String caseKey) {
            this.caseKey = caseKey;
        }

        public String getRole() {
            return role;
        }

        public void setRole(String role) {
            this.role = role;
        }

        public String getContent() {
            return content;
        }

        public void setContent(String content) {
            this.content = content;
        }

        public String getDescription() {
            return description;
        }

        public void setDescription(String description) {
            this.description = description;
        }

        public Boolean getActive() {
            return active;
        }

        public void setActive(Boolean active) {
            this.active = active;
        }
    }
}
