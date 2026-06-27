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
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Traduce el shape vendor-specific de Sightengine al DTO interno
 * agnostico {@link ModerationVerdictResult}.
 *
 * <p><b>P2.2 (delegacion a Sightengine summary.action)</b>. La decision
 * de escalado AMBER/RED se delega al {@code summary.action} del response
 * Sightengine — fuente de verdad de la politica operativa que el
 * operador configura desde el dashboard sin tocar codigo. El control
 * plane aplica la decision; no la decide.
 *
 * <p><b>Excepcion innegociable</b>: MINORS y GORE en severidad CRITICAL
 * se calculan EN CODIGO contra los umbrales {@code moderation.thresholds.minors.critical}
 * y {@code moderation.thresholds.gore.critical}. Esto es seguridad
 * (CSAM, gore explicito) y NO se delega a Sightengine ni al workflow
 * dashboard. CRITICAL siempre bypassa {@code summary.action}.
 *
 * <p>Algoritmo:
 * <ol>
 *   <li>Scan de scores MINORS y GORE -> si exceden critical, severity
 *       CRITICAL, suggestedAction=CUT, retornar.</li>
 *   <li>Si {@code summary.action == "accept"}: severity GREEN, suggestedAction=NO_OP.
 *       categoryVerdicts vacio (la trazabilidad granular vive en
 *       {@code vendorMetadataJson}).</li>
 *   <li>Si {@code summary.action == "reject"}: para cada reason de
 *       {@code reject_reason[]} mapeada a categoria canonica, severity=AMBER
 *       (no se distingue RED en P2.2 — politica granular en dashboard,
 *       no en codigo). severityOverall=AMBER, suggestedAction=ENQUEUE.</li>
 *   <li>{@code summary.action} null/desconocido: log WARN, fail-safe
 *       permisivo -> GREEN (postura adult dating).</li>
 * </ol>
 *
 * <p><b>Properties obsoletas tras P2.2</b>: los thresholds
 * {@code moderation.thresholds.nudity/violence/weapons/drugs/self-harm/offensive-symbols/gambling.{amber,red}}
 * NO se usan ya (decision via summary.action). Se mantienen en
 * {@code application.properties} por compatibilidad y para no romper
 * el binding, pero quedan sin efecto. Solo
 * {@code moderation.thresholds.minors.critical} y
 * {@code moderation.thresholds.gore.critical} siguen vivos.
 *
 * <p>Sub-clases IGNORED_SUBCLASSES y mapping SUBCLASS_TO_CATEGORY se
 * mantienen porque siguen sirviendo a (a) localizar el score de MINORS
 * y GORE para los checks CRITICAL, (b) resolver reject_reasons cuando
 * llegan como sub-clase sin prefijo modelo, (c) extraer el score
 * representativo de cada categoria rechazada para trazabilidad en
 * {@code categoryVerdicts.score}.
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
     * Construye el verdict normalizado aplicando el algoritmo P2.2:
     * (1) bypass CRITICAL si MINORS o GORE exceden su umbral; (2)
     * delegacion a {@code summary.action} para el resto; (3) fail-safe
     * permisivo GREEN si {@code summary.action} ausente/desconocido.
     */
    public ModerationVerdictResult buildVerdict(
            SightengineWorkflowResponse response,
            String rawBody,
            Instant frameTimestamp) {

        ModerationVerdictResult result = new ModerationVerdictResult();
        result.setProviderEventId(response != null ? response.getRequestId() : null);
        result.setFrameTimestamp(frameTimestamp);
        result.setVendorMetadataJson(rawBody);

        // Paso 1: bypass CRITICAL (innegociable, NO delegado a summary).
        BigDecimal minorScore = extractScore(response,
                Constants.StreamModerationCategory.MINORS); // minor.prob
        BigDecimal goreScore = extractScore(response,
                Constants.StreamModerationCategory.GORE);  // gore.prob

        boolean minorsCritical = minorScore != null
                && exceedsCritical(Constants.StreamModerationCategory.MINORS, minorScore);
        boolean goreCritical = goreScore != null
                && exceedsCritical(Constants.StreamModerationCategory.GORE, goreScore);

        if (minorsCritical || goreCritical) {
            if (minorsCritical) {
                result.getCategoryVerdicts().put(
                        Constants.StreamModerationCategory.MINORS,
                        new ModerationCategoryVerdict(
                                Constants.StreamModerationCategory.MINORS,
                                minorScore,
                                Constants.StreamModerationSeverity.CRITICAL));
            }
            if (goreCritical) {
                result.getCategoryVerdicts().put(
                        Constants.StreamModerationCategory.GORE,
                        new ModerationCategoryVerdict(
                                Constants.StreamModerationCategory.GORE,
                                goreScore,
                                Constants.StreamModerationSeverity.CRITICAL));
            }
            result.setSeverityOverall(Constants.StreamModerationSeverity.CRITICAL);
            result.setSuggestedAction("CUT");
            log.warn("[STREAM-MOD-SIGHTENGINE] CRITICAL bypass minorsCritical={} goreCritical={} (innegociable, no delegado a summary)",
                    minorsCritical, goreCritical);
            return result;
        }

        // Paso 2: delegacion a summary.action.
        String action = response != null && response.getSummary() != null
                ? response.getSummary().getAction()
                : null;

        if (action == null || action.isBlank()) {
            log.warn("[STREAM-MOD-SIGHTENGINE] summary.action ausente; fail-safe permisivo -> GREEN");
            result.setSeverityOverall(Constants.StreamModerationSeverity.GREEN);
            result.setSuggestedAction("NO_OP");
            return result;
        }

        String actionLower = action.toLowerCase(Locale.ROOT);
        if ("accept".equals(actionLower)) {
            result.setSeverityOverall(Constants.StreamModerationSeverity.GREEN);
            result.setSuggestedAction("NO_OP");
            return result;
        }

        if (!"reject".equals(actionLower)) {
            log.warn("[STREAM-MOD-SIGHTENGINE] summary.action='{}' no reconocido; fail-safe permisivo -> GREEN",
                    action);
            result.setSeverityOverall(Constants.StreamModerationSeverity.GREEN);
            result.setSuggestedAction("NO_OP");
            return result;
        }

        // action == "reject": traducir reject_reason[] a categorias canonicas.
        Map<String, ModerationCategoryVerdict> acc = new LinkedHashMap<>();
        List<String> reasons = response.getSummary().getRejectReasons();
        if (reasons != null) {
            for (String reason : reasons) {
                if (reason == null || reason.isBlank()) continue;
                String canonical = resolveCanonicalFromReason(reason);
                if (canonical == null) {
                    log.warn("[STREAM-MOD-SIGHTENGINE] reject_reason no mapeada reason={}", reason);
                    continue;
                }
                BigDecimal scoreForCat = extractScore(response, canonical);
                if (scoreForCat == null) scoreForCat = BigDecimal.ZERO;
                ModerationCategoryVerdict existing = acc.get(canonical);
                if (existing == null || scoreForCat.compareTo(existing.getScore()) > 0) {
                    acc.put(canonical, new ModerationCategoryVerdict(
                            canonical, scoreForCat,
                            Constants.StreamModerationSeverity.AMBER));
                }
            }
        }

        if (acc.isEmpty()) {
            // reject sin reasons reconocidas -> AMBER sobre OTHER por seguridad.
            log.warn("[STREAM-MOD-SIGHTENGINE] summary.action=reject pero reject_reasons vacias/no reconocidas; AMBER sobre OTHER");
            acc.put(Constants.StreamModerationCategory.OTHER,
                    new ModerationCategoryVerdict(
                            Constants.StreamModerationCategory.OTHER,
                            BigDecimal.ZERO,
                            Constants.StreamModerationSeverity.AMBER));
        }

        result.setSeverityOverall(Constants.StreamModerationSeverity.AMBER);
        result.getCategoryVerdicts().putAll(acc);
        result.setSuggestedAction("ENQUEUE");
        return result;
    }

    /**
     * Extrae el score representativo de una categoria canonica
     * iterando los modelos visuales del response y buscando sub-claves
     * mapeadas a esa categoria. Devuelve el max (peor caso).
     */
    BigDecimal extractScore(SightengineWorkflowResponse response, String canonical) {
        if (response == null || response.getRawScoresByModel() == null) return null;
        BigDecimal best = null;
        for (Map.Entry<String, Object> e : response.getRawScoresByModel().entrySet()) {
            String modelName = e.getKey();
            Object payload = e.getValue();
            if (!(payload instanceof Map)) continue;
            @SuppressWarnings("unchecked")
            Map<String, Object> subscores = (Map<String, Object>) payload;
            for (Map.Entry<String, Object> sub : subscores.entrySet()) {
                String subKey = sub.getKey();
                if (IGNORED_SUBCLASSES.contains(subKey)) continue;
                String mapKey = modelName + "." + subKey;
                String mapped = SUBCLASS_TO_CATEGORY.get(mapKey);
                if (!canonical.equals(mapped)) continue;
                BigDecimal v = toBigDecimal(sub.getValue());
                if (v == null) continue;
                if (best == null || v.compareTo(best) > 0) best = v;
            }
        }
        return best;
    }

    boolean exceedsCritical(String canonical, BigDecimal score) {
        Category c = thresholdsFor(canonical);
        return c != null && c.getCritical() != null
                && score.compareTo(c.getCritical()) > 0;
    }

    /**
     * Resuelve una cadena del array {@code summary.reject_reason} a una
     * categoria canonica interna. Sightengine entrega cada reason como
     * {@code "modelo-version.subclase"} (ej. {@code "nudity-2.1.sexual_activity"})
     * o como sub-clase plana. Aplica heuristicas de match en orden:
     * <ol>
     *   <li>Lookup directo contra SUBCLASS_TO_CATEGORY.</li>
     *   <li>Si la reason TERMINA en una clave conocida (sin importar la
     *       version del modelo prefijada).</li>
     *   <li>Heuristica por prefijo de modelo.</li>
     * </ol>
     * Devuelve null si no resuelve.
     */
    String resolveCanonicalFromReason(String reason) {
        if (reason == null) return null;
        String r = reason.toLowerCase(Locale.ROOT).trim();
        if (r.isEmpty()) return null;
        String direct = SUBCLASS_TO_CATEGORY.get(r);
        if (direct != null) return direct;
        for (Map.Entry<String, String> e : SUBCLASS_TO_CATEGORY.entrySet()) {
            if (r.endsWith("." + e.getKey()) || r.equals(e.getKey())) {
                return e.getValue();
            }
            // tokens del estilo "nudity-2.1.sexual_activity" terminan en
            // un sufijo conocido cuando se le quita el sufijo de version,
            // o el reason puede ser una sub-clave plana ("sexual_activity")
            // que matchea con la parte tras el primer punto del map key.
            int dotIdx = e.getKey().indexOf('.');
            if (dotIdx > 0) {
                String subOnly = e.getKey().substring(dotIdx + 1);
                String suffix = "." + subOnly;
                if (r.endsWith(suffix)) return e.getValue();
                if (r.equals(subOnly)) return e.getValue();
            }
        }
        // Heuristica por prefijo de modelo.
        if (r.startsWith("nudity")) return Constants.StreamModerationCategory.NUDITY;
        if (r.startsWith("weapon")) return Constants.StreamModerationCategory.WEAPONS;
        if (r.startsWith("gore")) return Constants.StreamModerationCategory.GORE;
        if (r.startsWith("violence")) return Constants.StreamModerationCategory.VIOLENCE;
        if (r.startsWith("self-harm") || r.startsWith("self_harm"))
            return Constants.StreamModerationCategory.SELF_HARM;
        if (r.startsWith("offensive") || r.startsWith("hate"))
            return Constants.StreamModerationCategory.OFFENSIVE_SYMBOLS;
        if (r.startsWith("recreational_drug") || r.startsWith("drug"))
            return Constants.StreamModerationCategory.DRUGS;
        if (r.startsWith("gambling")) return Constants.StreamModerationCategory.GAMBLING;
        if (r.startsWith("minor")) return Constants.StreamModerationCategory.MINORS;
        return null;
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
