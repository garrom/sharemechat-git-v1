package com.sharemechat.support.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * @ConfigurationProperties equivalent para el sub-paquete Support.
 * Se lee desde application.properties + secrets.env.
 */
@Component
public class ClaudeApiProperties {

    @Value("${claude.api.enabled:false}")
    private boolean enabled;

    @Value("${claude.api.model:claude-haiku-4-5}")
    private String model;

    @Value("${claude.api.base-url:https://api.anthropic.com}")
    private String baseUrl;

    @Value("${claude.api.max-output-tokens:800}")
    private int maxOutputTokens;

    @Value("${claude.api.timeout-seconds:30}")
    private int timeoutSeconds;

    @Value("${claude.api.prompt-caching-enabled:true}")
    private boolean promptCachingEnabled;

    @Value("${claude.api.key:}")
    private String apiKey;

    @Value("${support.rate-limit.messages-per-day:30}")
    private int rateLimitMessagesPerDay;

    @Value("${support.rate-limit.tokens-per-day:50000}")
    private long rateLimitTokensPerDay;

    @Value("${support.bot.user-email:bot+support@sharemechat.com}")
    private String botUserEmail;

    @Value("${support.bot.nickname-default:Soporte SharemeChat}")
    private String botNicknameDefault;

    @Value("${support.kb.directory:classpath:knowledge-base/}")
    private String kbDirectory;

    @Value("${support.history.messages-window:10}")
    private int historyMessagesWindow;

    public boolean isEnabled() { return enabled; }
    public String getModel() { return model; }
    public String getBaseUrl() { return baseUrl; }
    public int getMaxOutputTokens() { return maxOutputTokens; }
    public int getTimeoutSeconds() { return timeoutSeconds; }
    public boolean isPromptCachingEnabled() { return promptCachingEnabled; }
    public String getApiKey() { return apiKey; }
    public int getRateLimitMessagesPerDay() { return rateLimitMessagesPerDay; }
    public long getRateLimitTokensPerDay() { return rateLimitTokensPerDay; }
    public String getBotUserEmail() { return botUserEmail; }
    public String getBotNicknameDefault() { return botNicknameDefault; }
    public String getKbDirectory() { return kbDirectory; }
    public int getHistoryMessagesWindow() { return historyMessagesWindow; }
}
