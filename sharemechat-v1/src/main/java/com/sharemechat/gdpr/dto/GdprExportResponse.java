package com.sharemechat.gdpr.dto;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * GDPR art. 15: respuesta estructurada del export de datos personales
 * de un usuario. Materializa las 7 categorias del runbook manual
 * documentado en {@code docs/04-operations/runbooks.md} (seccion
 * "Runbook de peticion GDPR art. 15").
 *
 * <p>Se usa un {@link LinkedHashMap} para preservar el orden de las
 * secciones en el JSON emitido (importante para la lectura humana del
 * DPO y del interesado que recibe el fichero). Cada seccion contiene
 * un mapa con listas de filas serializadas como {@code Map<String, Object>}.
 *
 * <p>Los datos de terceros que aparecen en las relaciones (peer de un
 * mensaje, agente humano de soporte, etc.) NO se anonimizan a nivel
 * de servicio: se emiten con el id interno y el nickname publico si
 * existe, dejando la interpretacion final al DPO al empaquetar el
 * envio (paso 6 del runbook).
 */
public class GdprExportResponse {

    private final Instant exportedAt = Instant.now();
    private final Long targetUserId;
    private final String targetUserEmail;
    private final Long requestedByAdminId;

    private final Map<String, Object> identity = new LinkedHashMap<>();
    private final Map<String, Object> client = new LinkedHashMap<>();
    private final Map<String, Object> model = new LinkedHashMap<>();
    private final Map<String, Object> streaming = new LinkedHashMap<>();
    private final Map<String, Object> communications = new LinkedHashMap<>();
    private final Map<String, Object> compliance = new LinkedHashMap<>();
    private final Map<String, Object> backoffice = new LinkedHashMap<>();

    public GdprExportResponse(Long targetUserId, String targetUserEmail, Long requestedByAdminId) {
        this.targetUserId = targetUserId;
        this.targetUserEmail = targetUserEmail;
        this.requestedByAdminId = requestedByAdminId;
    }

    public void addToIdentity(String key, List<Map<String, Object>> rows) { identity.put(key, rows); }
    public void addToClient(String key, List<Map<String, Object>> rows) { client.put(key, rows); }
    public void addToModel(String key, List<Map<String, Object>> rows) { model.put(key, rows); }
    public void addToStreaming(String key, List<Map<String, Object>> rows) { streaming.put(key, rows); }
    public void addToCommunications(String key, List<Map<String, Object>> rows) { communications.put(key, rows); }
    public void addToCompliance(String key, List<Map<String, Object>> rows) { compliance.put(key, rows); }
    public void addToBackoffice(String key, List<Map<String, Object>> rows) { backoffice.put(key, rows); }

    public Instant getExportedAt() { return exportedAt; }
    public Long getTargetUserId() { return targetUserId; }
    public String getTargetUserEmail() { return targetUserEmail; }
    public Long getRequestedByAdminId() { return requestedByAdminId; }
    public Map<String, Object> getIdentity() { return identity; }
    public Map<String, Object> getClient() { return client; }
    public Map<String, Object> getModel() { return model; }
    public Map<String, Object> getStreaming() { return streaming; }
    public Map<String, Object> getCommunications() { return communications; }
    public Map<String, Object> getCompliance() { return compliance; }
    public Map<String, Object> getBackoffice() { return backoffice; }
}
