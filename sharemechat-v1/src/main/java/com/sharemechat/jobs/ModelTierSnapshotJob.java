package com.sharemechat.jobs;

import com.sharemechat.repository.ModelRepository;
import com.sharemechat.service.ModelTierService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

@Component
public class ModelTierSnapshotJob {

    private static final Logger log = LoggerFactory.getLogger(ModelTierSnapshotJob.class);

    private final ModelRepository modelRepository;
    private final ModelTierService modelTierService;

    public ModelTierSnapshotJob(ModelRepository modelRepository, ModelTierService modelTierService) {
        this.modelRepository = modelRepository;
        this.modelTierService = modelTierService;
    }

    // Diario a las 03:10 (server time)
    @Scheduled(cron = "0 10 3 * * *")
    public void runDaily() {

        LocalDate snapshotDate = LocalDate.now().minusDays(1); // AYER
        List<Long> modelIds = modelRepository.findAllModelUserIds();

        log.info("ModelTierSnapshotJob: snapshotDate={}, modelos={}", snapshotDate, modelIds != null ? modelIds.size() : 0);

        if (modelIds == null || modelIds.isEmpty()) return;

        for (Long modelId : modelIds) {
            try {
                modelTierService.computeAndUpsertSnapshot(modelId, snapshotDate);
            } catch (Exception e) {
                log.warn("ModelTierSnapshotJob: error modelId={} -> {}", modelId, e.getMessage());
            }
        }
    }
}
