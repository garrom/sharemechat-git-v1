package com.sharemechat.streammoderation.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Parseo perezoso de la respuesta sincrona de Sightengine al endpoint
 * {@code POST /1.0/check-workflow.json}. Solo extrae los campos que el
 * {@code ModerationCategoryMapper} necesita; el resto del payload se
 * preserva opaco en {@code vendorMetadataJson} para auditoria.
 *
 * <p>Sightengine devuelve un objeto con metadata de la peticion y un
 * objeto por cada modelo activo en el workflow:
 * {@code nudity}, {@code gore}, {@code weapon}, {@code violence},
 * {@code recreational_drug}, {@code self-harm}, {@code offensive},
 * {@code minor}, {@code gambling}.
 *
 * <p>Cada modelo expone sub-scores en el rango [0,1] cuya forma exacta
 * depende del modelo. El mapeo a categorias canonicas vive en
 * {@code ModerationCategoryMapper}; este DTO solo deja accesibles los
 * objetos por nombre via {@link #getRawScoresByModel()}, evitando una
 * jerarquia POJO especifica que se quede rapidamente desfasada.
 *
 * <p>Si el shape de Sightengine evoluciona, el ajuste vive en el
 * mapper y no en este DTO.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class SightengineWorkflowResponse {

    private Status status;
    private String requestId;
    private Map<String, Object> rawScoresByModel = new HashMap<>();
    private Summary summary;

    public Status getStatus() {
        return status;
    }

    public void setStatus(Status status) {
        this.status = status;
    }

    public String getRequestId() {
        return requestId;
    }

    public void setRequestId(String requestId) {
        this.requestId = requestId;
    }

    public Map<String, Object> getRawScoresByModel() {
        return rawScoresByModel;
    }

    public void setRawScoresByModel(Map<String, Object> rawScoresByModel) {
        this.rawScoresByModel = rawScoresByModel;
    }

    public Summary getSummary() {
        return summary;
    }

    public void setSummary(Summary summary) {
        this.summary = summary;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Status {
        private String code;
        private String message;

        public String getCode() { return code; }
        public void setCode(String code) { this.code = code; }

        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }
    }

    /**
     * Decisión consolidada del workflow Sightengine (P2.2). El operador
     * configura desde el dashboard qué sub-clases disparan ACCEPT/REJECT
     * por categoría; el control plane delega la decisión NO-CRITICAL a
     * este objeto. CRITICAL (MINORS / GORE) se sigue calculando en
     * código por seguridad.
     *
     * <p>{@code action} = {@code "accept"} | {@code "reject"}.
     * {@code rejectReasons} = lista de tokens textuales por los que
     * Sightengine disparó el reject; el mapper los traduce a categorías
     * canónicas internas.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Summary {
        private String action;
        private List<String> rejectReasons = new ArrayList<>();

        public String getAction() { return action; }
        public void setAction(String action) { this.action = action; }

        public List<String> getRejectReasons() { return rejectReasons; }
        public void setRejectReasons(List<String> rejectReasons) { this.rejectReasons = rejectReasons; }
    }
}
