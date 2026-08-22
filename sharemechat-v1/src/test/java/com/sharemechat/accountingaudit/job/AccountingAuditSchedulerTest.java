package com.sharemechat.accountingaudit.job;

import com.sharemechat.accountingaudit.dto.AuditJobRequest;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/**
 * Depuración "control interno" (2026-08-22): el cron nocturno pasa a ejecutar los
 * tres scopes desatendidos (antes solo DEFAULT; SESSION_INTEGRITY y RUNTIME_HEALTH
 * eran solo-manuales).
 */
class AccountingAuditSchedulerTest {

    @Test
    void runDailyEjecutaLosTresScopesComoAuditoriaReal() {
        AccountingAuditJob job = mock(AccountingAuditJob.class);

        new AccountingAuditScheduler(job).runDaily();

        ArgumentCaptor<AuditJobRequest> cap = ArgumentCaptor.forClass(AuditJobRequest.class);
        verify(job, times(3)).execute(cap.capture());

        List<AuditJobRequest> reqs = cap.getAllValues();
        assertEquals(
                List.of("DEFAULT", "SESSION_INTEGRITY", "RUNTIME_HEALTH"),
                reqs.stream().map(AuditJobRequest::getScope).toList());
        reqs.forEach(r -> {
            assertEquals("SCHEDULED", r.getTrigger());
            assertFalse(r.isDryRun()); // auditoría real (persiste si detecta)
        });
    }

    @Test
    void elFalloDeUnScopeNoImpideLosDemas() {
        AccountingAuditJob job = mock(AccountingAuditJob.class);
        doThrow(new RuntimeException("boom")).when(job).execute(any(AuditJobRequest.class));

        // No debe propagar la excepción; los tres scopes se intentan igualmente.
        new AccountingAuditScheduler(job).runDaily();

        verify(job, times(3)).execute(any(AuditJobRequest.class));
    }
}
