package com.sharemechat.accountingaudit.job;

import com.sharemechat.accountingaudit.dto.AuditJobRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class AccountingAuditScheduler {

    private final AccountingAuditJob job;

    public AccountingAuditScheduler(AccountingAuditJob job) {
        this.job = job;
    }

    // MVP: una vez al día a las 03:30 (hora del servidor)
    @Scheduled(cron = "0 30 3 * * *")
    public void runDaily() {

        AuditJobRequest req = new AuditJobRequest();
        req.setTrigger("SCHEDULED");
        req.setScope("DEFAULT");
        req.setDryRun(false); // auditoría real (persistirá si detecta)

        job.execute(req);
    }
}
