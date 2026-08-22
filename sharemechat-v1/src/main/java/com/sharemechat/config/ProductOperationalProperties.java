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
    private Simulation simulation = new Simulation();
    private Golive golive = new Golive();

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

    public Simulation getSimulation() {
        return simulation;
    }

    public void setSimulation(Simulation simulation) {
        this.simulation = simulation == null ? new Simulation() : simulation;
    }

    public Golive getGolive() {
        return golive;
    }

    public void setGolive(Golive golive) {
        this.golive = golive == null ? new Golive() : golive;
    }

    public static class Access {
        private Mode mode = Mode.OPEN;
        /**
         * Override de modo para usuarios MODELO (rol MODEL o candidata
         * USER+FORM_MODEL). {@code null} = usa {@link #mode} (comportamiento
         * previo intacto). Permite, p.ej., cliente en PRELAUNCH y modelo en
         * OPEN a la vez. Se activa por env {@code PRODUCT_ACCESS_MODE_MODEL}.
         */
        private Mode modeModel = null;
        private Allowlist allowlist = new Allowlist();

        public Mode getMode() {
            return mode;
        }

        public void setMode(Mode mode) {
            this.mode = mode == null ? Mode.OPEN : mode;
        }

        public Mode getModeModel() {
            return modeModel;
        }

        public void setModeModel(Mode modeModel) {
            // null permitido: significa "sin override" -> cae a mode.
            this.modeModel = modeModel;
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

    public static class Simulation {
        private Toggle transactionsDirect = new Toggle(false);

        public Toggle getTransactionsDirect() {
            return transactionsDirect;
        }

        public void setTransactionsDirect(Toggle transactionsDirect) {
            this.transactionsDirect = transactionsDirect == null ? new Toggle(false) : transactionsDirect;
        }
    }

    /**
     * Gate coming-soon de "go-live" por rol (independiente del modo de acceso al
     * producto): con la llave en false el usuario VE la plataforma pero no puede
     * OPERAR. Modelo = emitir; cliente (role=USER) = entrar a videochat/trial y
     * pagar (primer pago). Defaults false (coming-soon). Se activan por env
     * {@code PRODUCT_GOLIVE_MODEL_ENABLED} / {@code PRODUCT_GOLIVE_CLIENT_ENABLED}.
     */
    public static class Golive {
        private Toggle model = new Toggle(false);
        private Toggle client = new Toggle(false);

        public Toggle getModel() {
            return model;
        }

        public void setModel(Toggle model) {
            this.model = model == null ? new Toggle(false) : model;
        }

        public Toggle getClient() {
            return client;
        }

        public void setClient(Toggle client) {
            this.client = client == null ? new Toggle(false) : client;
        }
    }
}
