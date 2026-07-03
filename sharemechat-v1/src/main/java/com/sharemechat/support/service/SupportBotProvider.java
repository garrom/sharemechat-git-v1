package com.sharemechat.support.service;

import com.sharemechat.entity.User;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.support.config.ClaudeApiProperties;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Resuelve el id del user SUPPORT_BOT por email desde configuracion
 * ({@code support.bot.user-email}) y lo cachea (DEC-B2-8).
 *
 * <p>Failfast en arranque si el user no existe: se prefiere que el backend no
 * arranque a que endpoints que inyectan el bot virtualmente devuelvan un id
 * invalido silenciosamente.
 */
@Service
public class SupportBotProvider {

    private static final Logger log = LoggerFactory.getLogger(SupportBotProvider.class);

    private final ClaudeApiProperties props;
    private final UserRepository userRepository;

    private Long supportBotId;
    private String supportBotNickname;

    public SupportBotProvider(ClaudeApiProperties props, UserRepository userRepository) {
        this.props = props;
        this.userRepository = userRepository;
    }

    @PostConstruct
    void init() {
        String email = props.getBotUserEmail();
        User bot = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalStateException(
                        "[SUPPORT-BOT] user not found for email=" + email
                                + " (support.bot.user-email); required for virtual injection"));
        this.supportBotId = bot.getId();
        String nick = bot.getNickname();
        this.supportBotNickname = (nick == null || nick.isBlank())
                ? props.getBotNicknameDefault()
                : nick;
        log.info("[SUPPORT-BOT] provider initialized: id={} nickname='{}'",
                supportBotId, supportBotNickname);
    }

    public Long getSupportBotId() {
        return supportBotId;
    }

    public String getSupportBotNickname() {
        return supportBotNickname;
    }

    public boolean isSupportBot(Long userId) {
        return userId != null && userId.equals(supportBotId);
    }
}
