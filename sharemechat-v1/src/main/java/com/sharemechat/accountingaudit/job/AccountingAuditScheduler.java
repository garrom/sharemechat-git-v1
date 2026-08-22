package com.sharemechat.accountingaudit.job;

import com.sharemechat.accountingaudit.dto.AuditJobRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class AccountingAuditScheduler {

    private static final Logger log = LoggerFactory.getLogger(AccountingAuditScheduler.class);

    // Scopes que corren de forma desatendida cada noche.
    //  - DEFAULT           : cuadre contable del ledger + invariante BFPM (ya corría).
    //  - SESSION_INTEGRITY : ciclo de vida de streams RANDOM/CALLING.
    //  - RUNTIME_HEALTH    : reconciliación memoria/Redis vs BD del motor de videochat.
    // SESSION_INTEGRITY y RUNTIME_HEALTH eran solo-manuales (nadie los lanzaba);
    // se añaden al cron (2026-08-22, depuración "control interno") para que de
    // verdad vigilen y no queden como herramientas muertas.
    private static final String[] SCHEDULED_SCOPES = { "DEFAULT", "SESSION_INTEGRITY", "RUNTIME_HEALTH" };

    private final AccountingAuditJob job;

    public AccountingAuditScheduler(AccountingAuditJob job) {
        this.job = job;
    }

    // Una vez al día a las 03:30 (hora del servidor).
    @Scheduled(cron = "0 30 3 * * *")
    public void runDaily() {
        for (String scope : SCHEDULED_SCOPES) {
            runScope(scope);
        }
    }

    // Cada scope en su propio try/catch: el fallo de uno no debe impedir los demás.
    private void runScope(String scope) {
        try {
            AuditJobRequest req = new AuditJobRequest();
            req.setTrigger("SCHEDULED");
            req.setScope(scope);
            req.setDryRun(false); // auditoría real (persistirá si detecta)
            job.execute(req);
        } catch (Exception e) {
            log.error("[accounting-audit] scope {} falló en la ejecución programada: {}",
                    scope, e.getMessage(), e);
        }
    }
}
