package com.sharemechat.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

/**
 * Pool dedicado para el pipeline de moderacion visual (frente
 * Moderacion IA; P2.1). Aisla las invocaciones {@code @Async} del
 * adapter Sightengine y del uploader de evidencia S3 del executor por
 * defecto de Spring ({@code SimpleAsyncTaskExecutor}, sin pool), que
 * abriria un thread por invocacion sin reuso.
 *
 * <p>El bean se nombra {@code moderationExecutor}; cualquier
 * {@code @Async} del frente debe declarar {@code @Async("moderationExecutor")}
 * para asignarse a este pool. El {@code @Async} preexistente de
 * {@code StreamService.endSessionAsync} NO se mueve a este pool en
 * P2.1 (sigue usando el default Spring); el aislamiento del frente de
 * moderacion es deliberado.
 */
@Configuration
public class ModerationExecutorConfig {

    @Value("${moderation.executor.core-pool-size:20}")
    private int corePoolSize;

    @Value("${moderation.executor.max-pool-size:30}")
    private int maxPoolSize;

    @Value("${moderation.executor.queue-capacity:200}")
    private int queueCapacity;

    @Bean(name = "moderationExecutor")
    public Executor moderationExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(corePoolSize);
        executor.setMaxPoolSize(maxPoolSize);
        executor.setQueueCapacity(queueCapacity);
        executor.setThreadNamePrefix("mod-exec-");
        executor.initialize();
        return executor;
    }
}
