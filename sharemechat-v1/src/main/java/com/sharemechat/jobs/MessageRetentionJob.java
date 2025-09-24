// src/main/java/com/sharemechat/jobs/MessageRetentionJob.java
package com.sharemechat.jobs;

import com.sharemechat.repository.MessageRepository;
import org.slf4j.Logger; import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
@EnableScheduling
public class MessageRetentionJob {
    private static final Logger log = LoggerFactory.getLogger(MessageRetentionJob.class);

    private final MessageRepository repo;

    // Tiempo de guardado del contenido del chat
    // Configuración simple (podrías mover a application.properties)
    private final int daysToKeep = 90;
    private final int perConversationKeep = 2000;

    public MessageRetentionJob(MessageRepository repo) { this.repo = repo; }

    @Scheduled(cron = "0 5 3 * * *") // cada día 03:05
    public void prune() {
        int a = repo.deleteOlderThan(LocalDateTime.now().minusDays(daysToKeep));
        int b = repo.trimOversizeConversations(perConversationKeep);
        log.info("MessageRetentionJob: deletedOld={}, trimmedOversize={}", a, b);
    }
}
