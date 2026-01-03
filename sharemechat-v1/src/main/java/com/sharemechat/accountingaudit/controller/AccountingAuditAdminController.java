package com.sharemechat.accountingaudit.controller;

import com.sharemechat.accountingaudit.dto.AuditJobRequest;
import com.sharemechat.accountingaudit.dto.AuditJobResult;
import com.sharemechat.accountingaudit.job.AccountingAuditJob;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/audit")
public class AccountingAuditAdminController {

    private final AccountingAuditJob job;

    public AccountingAuditAdminController(AccountingAuditJob job) {
        this.job = job;
    }

    @PostMapping("/run")
    public AuditJobResult run(@RequestBody AuditJobRequest req) {
        // Forzamos trigger "API" para trazabilidad
        req.setTrigger("API");
        return job.execute(req);
    }
}
