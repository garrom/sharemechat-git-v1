package com.sharemechat.support.service;

import com.sharemechat.support.config.ClaudeApiProperties;
import com.sharemechat.support.entity.SupportRateLimitDaily;
import com.sharemechat.support.repository.SupportRateLimitDailyRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Optional;

/**
 * Rate limit por usuario (DEC-CS-11). Cap doble: 30 mensajes/dia OR
 * 50.000 tokens/dia. Reset a las 00:00 UTC (usamos LocalDate en UTC).
 *
 * <p>API mental:
 * <ol>
 *   <li>{@link #shouldRateLimit}: consultar antes de llamar Claude.
 *       Devuelve true si ya se supero el cap (mensaje del usuario se
 *       persiste pero no se llama al LLM).</li>
 *   <li>{@link #registerUsage}: llamar despues de cada llamada Claude
 *       con tokens_input y tokens_output.</li>
 * </ol>
 */
@Service
public class SupportRateLimitService {

    private final SupportRateLimitDailyRepository repo;
    private final ClaudeApiProperties props;

    public SupportRateLimitService(SupportRateLimitDailyRepository repo,
                                    ClaudeApiProperties props) {
        this.repo = repo;
        this.props = props;
    }

    /**
     * Devuelve true si el usuario ya supero cualquiera de los dos caps y
     * NO debe llamarse al LLM en este request.
     */
    @Transactional(readOnly = true)
    public boolean shouldRateLimit(Long userId) {
        LocalDate today = todayUtc();
        Optional<SupportRateLimitDaily> rl = repo.findByUserIdAndUsageDate(userId, today);
        if (rl.isEmpty()) return false;
        SupportRateLimitDaily r = rl.get();
        return r.getMessagesCount() >= props.getRateLimitMessagesPerDay()
                || r.getTokensCount() >= props.getRateLimitTokensPerDay();
    }

    /**
     * Registra 1 mensaje + tokens_input+tokens_output. Si tras la actualizacion
     * se cruza cualquier cap, poblamos exceeded_at.
     */
    @Transactional
    public SupportRateLimitDaily registerUsage(Long userId, int tokensUsed) {
        LocalDate today = todayUtc();
        SupportRateLimitDaily r = repo.findByUserIdAndUsageDate(userId, today).orElse(null);
        if (r == null) {
            r = new SupportRateLimitDaily();
            r.setUserId(userId);
            r.setUsageDate(today);
        }
        r.setMessagesCount(r.getMessagesCount() + 1);
        r.setTokensCount(r.getTokensCount() + Math.max(0, tokensUsed));
        boolean exceededNow = r.getMessagesCount() >= props.getRateLimitMessagesPerDay()
                || r.getTokensCount() >= props.getRateLimitTokensPerDay();
        if (exceededNow && r.getExceededAt() == null) {
            r.setExceededAt(LocalDateTime.now());
        }
        r.setUpdatedAt(LocalDateTime.now());
        return repo.save(r);
    }

    public int remainingMessages(Long userId) {
        SupportRateLimitDaily r = repo.findByUserIdAndUsageDate(userId, todayUtc()).orElse(null);
        int used = r == null ? 0 : r.getMessagesCount();
        return Math.max(0, props.getRateLimitMessagesPerDay() - used);
    }

    public long remainingTokens(Long userId) {
        SupportRateLimitDaily r = repo.findByUserIdAndUsageDate(userId, todayUtc()).orElse(null);
        long used = r == null ? 0L : r.getTokensCount();
        return Math.max(0L, props.getRateLimitTokensPerDay() - used);
    }

    private static LocalDate todayUtc() {
        return LocalDate.now(ZoneOffset.UTC);
    }
}
