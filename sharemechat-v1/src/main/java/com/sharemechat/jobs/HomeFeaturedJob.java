package com.sharemechat.jobs;

import com.sharemechat.service.HomeFeaturedService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class HomeFeaturedJob {

    private static final Logger log = LoggerFactory.getLogger(HomeFeaturedJob.class);

    private final HomeFeaturedService homeFeaturedService;

    public HomeFeaturedJob(HomeFeaturedService homeFeaturedService) {
        this.homeFeaturedService = homeFeaturedService;
    }

    // Cada 1 hora (cron: segundo, minuto, hora, día, mes, díaSemana)
    @Scheduled(cron = "0 */15 * * * *") // cada 15 minutos: 00,15,30,45
    public void refreshHomeFeatured() {
        log.info("HomeFeaturedJob: reconstruyendo home_featured_models...");
        homeFeaturedService.rebuildHomeFeatured();
        log.info("HomeFeaturedJob: reconstrucción completada.");
    }
}
