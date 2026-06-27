package com.sharemechat.streammoderation.service;

import com.sharemechat.config.ModerationThresholdsProperties;
import com.sharemechat.config.ModerationThresholdsProperties.Category;
import com.sharemechat.constants.Constants;
import com.sharemechat.streammoderation.dto.ModerationCategoryVerdict;
import com.sharemechat.streammoderation.dto.ModerationVerdictResult;
import com.sharemechat.streammoderation.dto.SightengineWorkflowResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * Traduce el shape vendor-specific de Sightengine al DTO interno
 * agnostico {@link ModerationVerdictResult}. Aplica la tabla de
 * decision DEC-1 de P2.1 sobre los umbrales declarados en
 * {@link ModerationThresholdsProperties}.
 *
 * <p>Sub-clases ignoradas (DEC-1, NO MODERADA): {@code bikini},
 * {@code underwear}, {@code cleavage}. Cualquier score sobre ellas se
 * descarta sin generar entrada en {@code categoryVerdicts}.
 *
 * <p>Sub-clases no mapeadas: log warn + ignorar (DEC-15). No se cae a
 * la categoria {@code OTHER}; preferimos silencio antes que ruido en
 * la cola humana por categorias Sightengine no calibradas.
 *
 * <p>Severity por categoria: GREEN si score por debajo del umbral
 * AMBER (o CRITICAL para MINORS/GORE). El severityOverall del verdict
 * = max severity sobre las categorias acumuladas, orden CRITICAL &gt;
 * RED &gt; AMBER &gt; GREEN.
 */
@Component
public class ModerationCategoryMapper {

    private static final Logger log = LoggerFactory.getLogger(ModerationCategoryMapper.class);

    private static final Set<String> IGNORED_SUBCLASSES = Set.of(
            // sub-claves Sightengine permitidas por el producto (DEC-1 NO MODERADA)
            "bikini", "underwear", "cleavage",
            // sub-claves nudity NO MODERADA del workflow real (calibracion P2.1):
            // scores top-level que el operador NO quiere moderar pero que Sightengine
            // siempre devuelve. Sin esto, el mapper loggea WARN por cada frame.
            "none", "suggestive", "very_suggestive", "mildly_suggestive",
            // weapon.firearm_toy: replica/juguete, no se modera; va aqui para evitar
            // falsos AMBER por niños con pistola de agua, etc.
            "firearm_toy");

    /**
     * Mapeo {@code modelo_sightengine.sub_clase} -> categoria canonica
     * interna. Sub-claves IGNORED_SUBCLASSES interceptadas antes,
     * fuera de este map.
     */
    private static final Map<String, String> SUBCLASS_TO_CATEGORY = buildSubclassMap();

    private static Map<String, String> buildSubclassMap() {
        Map<String, String> m = new HashMap<>();
        // nudity-2.1 -> NUDITY (DEC-1: sexual_activity y erotica mapean a NUDITY)
        m.put("nudity.sexual_activity", Constants.StreamModerationCategory.NUDITY);
        m.put("nudity.erotica", Constants.StreamModerationCategory.NUDITY);
        m.put("nudity.sexual_display", Constants.StreamModerationCategory.NUDITY);
        // gore-2.0 -> GORE
        m.put("gore.prob", Constants.StreamModerationCategory.GORE);
        // weapon -> WEAPONS. Aplanados por el adapter (parseResponse hace
        // flatten de weapon.classes.{firearm,knife,firearm_gesture,firearm_toy}
        // a weapon.{firearm,knife,...}). firearm_toy NO se modera por
        // defecto, va a IGNORED para evitar falsos AMBER con replicas.
        m.put("weapon.firearm", Constants.StreamModerationCategory.WEAPONS);
        m.put("weapon.knife", Constants.StreamModerationCategory.WEAPONS);
        m.put("weapon.firearm_gesture", Constants.StreamModerationCategory.WEAPONS);
        // violence -> VIOLENCE
        m.put("violence.prob", Constants.StreamModerationCategory.VIOLENCE);
        // recreational_drug -> DRUGS
        m.put("recreational_drug.prob", Constants.StreamModerationCategory.DRUGS);
        // self-harm -> SELF_HARM
        m.put("self-harm.prob", Constants.StreamModerationCategory.SELF_HARM);
        // offensive -> OFFENSIVE_SYMBOLS
        m.put("offensive.nazi", Constants.StreamModerationCategory.OFFENSIVE_SYMBOLS);
        m.put("offensive.confederate", Constants.StreamModerationCategory.OFFENSIVE_SYMBOLS);
        m.put("offensive.supremacist", Constants.StreamModerationCategory.OFFENSIVE_SYMBOLS);
        m.put("offensive.terrorist", Constants.StreamModerationCategory.OFFENSIVE_SYMBOLS);
        m.put("offensive.middle_finger", Constants.StreamModerationCategory.OFFENSIVE_SYMBOLS);
        // minor -> MINORS
        m.put("minor.prob", Constants.StreamModerationCategory.MINORS);
        // gambling -> GAMBLING
        m.put("gambling.prob", Constants.StreamModerationCategory.GAMBLING);
        return Map.copyOf(m);
    }

    private final ModerationThresholdsProperties thresholds;

    public ModerationCategoryMapper(ModerationThresholdsProperties thresholds) {
        this.thresholds = thresholds;
    }

    /**
     * Construye el verdict normalizado a partir de los scores granulares
     * de Sightengine. {@code rawScoresByModel} es el map plano
     * {@code modelo -> objeto-con-sub-scores} extraido del JSON. El
     * payload crudo se persiste como {@code vendorMetadataJson} para
     * auditoria.
     */
    public ModerationVerdictResult buildVerdict(
            SightengineWorkflowResponse response,
            String rawBody,
            Instant frameTimestamp) {

        ModerationVerdictResult result = new ModerationVerdictResult();
        result.setProviderEventId(response != null ? response.getRequestId() : null);
        result.setFrameTimestamp(frameTimestamp);
        result.setVendorMetadataJson(rawBody);

        Map<String, ModerationCategoryVerdict> acc = new LinkedHashMap<>();

        if (response != null && response.getRawScoresByModel() != null) {
            for (Map.Entry<String, Object> modelEntry : response.getRawScoresByModel().entrySet()) {
                String modelName = modelEntry.getKey();
                Object payload = modelEntry.getValue();
                if (!(payload instanceof Map)) continue;

                @SuppressWarnings("unchecked")
                Map<String, Object> subscores = (Map<String, Object>) payload;
                for (Map.Entry<String, Object> sub : subscores.entrySet()) {
                    String subKey = sub.getKey();
                    // Sub-clases NO MODERADAS de DEC-1
                    if (IGNORED_SUBCLASSES.contains(subKey)) {
                        continue;
                    }
                    BigDecimal score = toBigDecimal(sub.getValue());
                    if (score == null) continue;

                    String mapKey = modelName + "." + subKey;
                    String canonical = SUBCLASS_TO_CATEGORY.get(mapKey);
                    if (canonical == null) {
                        // DEC-15: sub-clase no mapeada -> log warn + ignorar
                        log.warn("[STREAM-MOD-SIGHTENGINE] sub-clase no mapeada model={} sub={} score={}",
                                modelName, subKey, score);
                        continue;
                    }
                    String severity = computeSeverity(canonical, score);
                    if (Constants.StreamModerationSeverity.GREEN.equals(severity)) {
                        continue;
                    }
                    ModerationCategoryVerdict existing = acc.get(canonical);
                    if (existing == null || score.compareTo(existing.getScore()) > 0) {
                        acc.put(canonical, new ModerationCategoryVerdict(canonical, score, severity));
                    }
                }
            }
        }

        if (acc.isEmpty()) {
            result.setSeverityOverall(Constants.StreamModerationSeverity.GREEN);
            result.setSuggestedAction("NO_OP");
            return result;
        }

        String worst = Constants.StreamModerationSeverity.GREEN;
        for (ModerationCategoryVerdict v : acc.values()) {
            if (rank(v.getSeverity()) > rank(worst)) {
                worst = v.getSeverity();
            }
        }
        result.setSeverityOverall(worst);
        result.getCategoryVerdicts().putAll(acc);
        result.setSuggestedAction(Constants.StreamModerationSeverity.CRITICAL.equals(worst)
                ? "CUT"
                : "ENQUEUE");
        return result;
    }

    /**
     * Computa la severity de una categoria contra los umbrales
     * configurados. MINORS y GORE solo conocen CRITICAL (no AMBER/RED).
     * Las demas solo conocen AMBER/RED. SELF_HARM/GAMBLING solo AMBER.
     */
    String computeSeverity(String canonical, BigDecimal score) {
        Category c = thresholdsFor(canonical);
        if (c == null) return Constants.StreamModerationSeverity.GREEN;

        if (Constants.StreamModerationCategory.MINORS.equals(canonical)
                || Constants.StreamModerationCategory.GORE.equals(canonical)) {
            if (c.getCritical() != null && score.compareTo(c.getCritical()) > 0) {
                return Constants.StreamModerationSeverity.CRITICAL;
            }
            return Constants.StreamModerationSeverity.GREEN;
        }

        if (c.getRed() != null && score.compareTo(c.getRed()) > 0) {
            return Constants.StreamModerationSeverity.RED;
        }
        if (c.getAmber() != null && score.compareTo(c.getAmber()) > 0) {
            return Constants.StreamModerationSeverity.AMBER;
        }
        return Constants.StreamModerationSeverity.GREEN;
    }

    private Category thresholdsFor(String canonical) {
        switch (canonical) {
            case Constants.StreamModerationCategory.MINORS:            return thresholds.getMinors();
            case Constants.StreamModerationCategory.GORE:              return thresholds.getGore();
            case Constants.StreamModerationCategory.NUDITY:            return thresholds.getNudity();
            case Constants.StreamModerationCategory.VIOLENCE:          return thresholds.getViolence();
            case Constants.StreamModerationCategory.WEAPONS:           return thresholds.getWeapons();
            case Constants.StreamModerationCategory.DRUGS:             return thresholds.getDrugs();
            case Constants.StreamModerationCategory.SELF_HARM:         return thresholds.getSelfHarm();
            case Constants.StreamModerationCategory.OFFENSIVE_SYMBOLS: return thresholds.getOffensiveSymbols();
            case Constants.StreamModerationCategory.GAMBLING:          return thresholds.getGambling();
            default: return null;
        }
    }

    private static int rank(String severity) {
        if (Constants.StreamModerationSeverity.CRITICAL.equals(severity)) return 3;
        if (Constants.StreamModerationSeverity.RED.equals(severity)) return 2;
        if (Constants.StreamModerationSeverity.AMBER.equals(severity)) return 1;
        return 0;
    }

    private static BigDecimal toBigDecimal(Object v) {
        if (v == null) return null;
        if (v instanceof BigDecimal) return (BigDecimal) v;
        if (v instanceof Number) return new BigDecimal(v.toString());
        return null;
    }

    static Set<String> ignoredSubclasses() {
        return IGNORED_SUBCLASSES;
    }

    static Map<String, String> subclassMap() {
        return SUBCLASS_TO_CATEGORY;
    }
}
