package com.sharemechat.support.service;

import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;

/**
 * ADR-054 D2 b2: heuristica de deteccion de incidencia en el mensaje del
 * usuario. String matching case-insensitive contra keywords ES+EN por
 * categoria. Cero ML, cero LLM, deterministico. Umbral simple: la categoria
 * con mas keywords matcheadas gana; si empate multiple o cero matches, no hay
 * senyal.
 *
 * <p>Palabras muy genericas ("problema", "issue") sin contexto de dominio se
 * mapean a {@code OTHER} solo si NO hay match en categorias concretas —
 * evita over-flagging de consultas normales que mencionan "problema" de paso.
 *
 * <p>El bot NUNCA abre ticket sin confirmacion del usuario. Este servicio
 * solo emite un candidato; el flow de confirmacion vive en
 * {@link TicketOfferPendingCache} y en el hook de {@link SupportBotService}.
 */
@Service
public class TicketOfferHeuristicService {

    /**
     * Keywords por categoria. Cada keyword se busca como substring
     * case-insensitive sobre el mensaje normalizado. Palabras cortas o muy
     * genericas se excluyen para evitar falsos positivos (p.ej. "corte" solo
     * matchea en "corto el video/stream", pero no en "corte de luz").
     */
    private static final Map<String, List<String>> KEYWORDS = Map.of(
            "STREAM_INTERRUPTED", List.of(
                    // ES
                    "se cayo", "se cayó", "se corto", "se cortó", "corto el stream",
                    "cortó el stream", "corto el video", "cortó el video",
                    "se desconecto", "se desconectó", "video se paro", "video se paró",
                    "el stream no", "stream fallo", "stream falló", "corto la llamada",
                    "cortó la llamada",
                    // EN
                    "stream cut", "stream failed", "call dropped", "video cut",
                    "disconnected mid", "cut off", "connection lost during"
            ),
            "PAYMENT_NOT_CREDITED", List.of(
                    // ES
                    "no me acredito", "no me acreditó", "pague pero no", "pagué pero no",
                    "no llego el saldo", "no llegó el saldo", "no me llego", "no me llegó",
                    "no tengo el saldo", "no aparece el saldo", "no se acredito",
                    "no se acreditó", "pago no acreditado", "no me sumaron",
                    // EN
                    "payment not credited", "paid but no balance", "balance not credited",
                    "top up not credited", "topup not credited", "paid and got nothing"
            ),
            "MODERATION_FALSE_POSITIVE", List.of(
                    // ES
                    "moderacion", "moderación", "me han cortado sin", "cortaron sin razon",
                    "cortaron sin razón", "cortaron sin motivo", "sin motivo la camara",
                    "sin motivo la cámara", "camara desactivada sin", "cámara desactivada sin",
                    "camara cortada sin", "cámara cortada sin",
                    // EN
                    "moderation cut", "camera cut without", "banned without reason",
                    "false moderation", "wrongly moderated"
            ),
            "ACCOUNT_ISSUE", List.of(
                    // ES
                    "no puedo entrar", "no me deja entrar", "no puedo iniciar sesion",
                    "no puedo iniciar sesión", "cuenta bloqueada", "cuenta suspendida",
                    "cuenta cerrada", "no puedo acceder a mi cuenta",
                    // EN
                    "cannot login", "can't login", "cant log in", "account blocked",
                    "account suspended", "account locked", "cannot access my account"
            )
    );

    private static final List<String> GENERIC_ISSUE_KEYWORDS = List.of(
            "reclamacion", "reclamación", "reclamar", "queja formal",
            "complaint", "file a complaint", "want a refund", "quiero un reembolso",
            "devuelvanme", "devuélvanme", "devuelvame", "devuélvame"
    );

    /**
     * Analiza el mensaje y devuelve la categoria de incidencia detectada, o
     * vacio si no hay senyal fuerte. Reglas:
     * <ol>
     *   <li>Cuenta matches por categoria (substring case-insensitive).</li>
     *   <li>Si una categoria concreta gana por >= 1 match unico, devuelve esa.</li>
     *   <li>Si empate entre concretas, devuelve OTHER (que fuerza revision manual).</li>
     *   <li>Si cero matches en concretas y algun match en GENERIC, devuelve OTHER.</li>
     *   <li>Si cero matches en todo, vacio (no ofrecer ticket).</li>
     * </ol>
     */
    public Optional<String> detectCategory(String rawMessage) {
        if (rawMessage == null) return Optional.empty();
        String normalized = rawMessage.toLowerCase(Locale.ROOT);
        if (normalized.trim().isEmpty()) return Optional.empty();

        // TreeMap para orden estable en caso de empate (por comparacion natural).
        TreeMap<String, Integer> matches = new TreeMap<>();
        for (Map.Entry<String, List<String>> e : KEYWORDS.entrySet()) {
            int count = 0;
            for (String kw : e.getValue()) {
                if (normalized.contains(kw)) count++;
            }
            if (count > 0) matches.put(e.getKey(), count);
        }

        if (matches.isEmpty()) {
            for (String kw : GENERIC_ISSUE_KEYWORDS) {
                if (normalized.contains(kw)) {
                    return Optional.of("OTHER");
                }
            }
            return Optional.empty();
        }

        // Selecciona la categoria con mas matches. Empate -> OTHER.
        int maxCount = matches.values().stream().mapToInt(Integer::intValue).max().orElse(0);
        long topCategoriesCount = matches.values().stream().filter(v -> v == maxCount).count();
        if (topCategoriesCount > 1) {
            return Optional.of("OTHER");
        }
        return matches.entrySet().stream()
                .filter(e -> e.getValue() == maxCount)
                .map(Map.Entry::getKey)
                .findFirst();
    }

    /**
     * Interpreta la respuesta del usuario al prompt "¿abrimos ticket?".
     * Case-insensitive. Reglas amplias para tolerar tipeos y variaciones.
     */
    public ConfirmationDecision interpretConfirmation(String rawMessage) {
        if (rawMessage == null) return ConfirmationDecision.AMBIGUOUS;
        String n = rawMessage.toLowerCase(Locale.ROOT).trim();
        if (n.isEmpty()) return ConfirmationDecision.AMBIGUOUS;

        // Rechazo primero (mas especifico) para no confundir "no, quiero..."
        // con un "quiero" positivo.
        for (String neg : List.of("no,", "no ", "no.", "no ", "nope", "cancelar",
                "cancela", "olvida", "olvidalo", "no gracias", "not now",
                "no thanks", "cancel")) {
            if (n.startsWith(neg) || n.equals(neg.trim())) {
                return ConfirmationDecision.REJECT;
            }
        }

        for (String pos : List.of("si", "sí", "yes", "ok", "vale", "confirma",
                "confirmar", "abre", "abrir", "abrelo", "ábrelo", "abridlo",
                "yeah", "yep", "sure", "go ahead", "haz", "adelante")) {
            if (n.startsWith(pos + " ") || n.equals(pos)
                    || n.startsWith(pos + ",") || n.startsWith(pos + ".")
                    || n.startsWith(pos + "!") || n.startsWith(pos + "?")) {
                return ConfirmationDecision.ACCEPT;
            }
        }
        return ConfirmationDecision.AMBIGUOUS;
    }

    public enum ConfirmationDecision {
        ACCEPT, REJECT, AMBIGUOUS
    }
}
