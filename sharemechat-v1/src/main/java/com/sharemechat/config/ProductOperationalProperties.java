package com.sharemechat.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.util.Collections;
import java.util.List;

/**
 * Binding de propiedades para Product Operational Mode (ADR-009).
 *
 * Defaults seguros y compatibles con el comportamiento previo a esta capa:
 *  - access.mode = OPEN
 *  - registration.client.enabled = true
 *  - registration.model.enabled = true
 *  - access.allowlist.user-ids = lista vacía
 *
 * Las activaciones reales por entorno se hacen mediante variables de entorno
 * en el host del backend; las properties versionadas no cambian comportamiento.
 */
@Configuration
@ConfigurationProperties(prefix = "product")
public class ProductOperationalProperties {

    public enum Mode {
        OPEN,
        PRELAUNCH,
        MAINTENANCE,
        CLOSED
    }

    private Access access = new Access();
    private Registration registration = new Registration();

    public Access getAccess() {
        return access;
    }

    public void setAccess(Access access) {
        this.access = access == null ? new Access() : access;
    }

    public Registration getRegistration() {
        return registration;
    }

    public void setRegistration(Registration registration) {
        this.registration = registration == null ? new Registration() : registration;
    }

    public static class Access {
        private Mode mode = Mode.OPEN;
        private Allowlist allowlist = new Allowlist();

        public Mode getMode() {
            return mode;
        }

        public void setMode(Mode mode) {
            this.mode = mode == null ? Mode.OPEN : mode;
        }

        public Allowlist getAllowlist() {
            return allowlist;
        }

        public void setAllowlist(Allowlist allowlist) {
            this.allowlist = allowlist == null ? new Allowlist() : allowlist;
        }
    }

    public static class Allowlist {
        private List<Long> userIds = Collections.emptyList();

        public List<Long> getUserIds() {
            return userIds;
        }

        public void setUserIds(List<Long> userIds) {
            this.userIds = userIds == null ? Collections.emptyList() : userIds;
        }
    }

    public static class Registration {
        private Toggle client = new Toggle(true);
        private Toggle model = new Toggle(true);

        public Toggle getClient() {
            return client;
        }

        public void setClient(Toggle client) {
            this.client = client == null ? new Toggle(true) : client;
        }

        public Toggle getModel() {
            return model;
        }

        public void setModel(Toggle model) {
            this.model = model == null ? new Toggle(true) : model;
        }
    }

    public static class Toggle {
        private boolean enabled = true;

        public Toggle() {
        }

        public Toggle(boolean enabled) {
            this.enabled = enabled;
        }

        public boolean isEnabled() {
            return enabled;
        }

        public void setEnabled(boolean enabled) {
            this.enabled = enabled;
        }
    }
}
