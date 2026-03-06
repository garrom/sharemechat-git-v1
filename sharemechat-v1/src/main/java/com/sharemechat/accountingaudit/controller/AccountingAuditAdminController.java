// src/main/java/com/sharemechat/accountingaudit/controller/AccountingAuditAdminController.java
package com.sharemechat.accountingaudit.controller;

import com.sharemechat.accountingaudit.dto.AuditJobRequest;
import com.sharemechat.accountingaudit.dto.AuditJobResult;
import com.sharemechat.accountingaudit.job.AccountingAuditJob;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/audit")
public class AccountingAuditAdminController {

    private final AccountingAuditJob job;

    @PersistenceContext
    private EntityManager em;

    public AccountingAuditAdminController(AccountingAuditJob job) {
        this.job = job;
    }

    @PostMapping("/run")
    public AuditJobResult run(@RequestBody AuditJobRequest req) {
        req.setTrigger("API");
        return job.execute(req);
    }

    @GetMapping("/anomalies")
    public List<Map<String, Object>> listAnomalies(
            @RequestParam(defaultValue = "20") int limit,
            @RequestParam(required = false) String typePrefix
    ) {
        int safeLimit = Math.max(1, Math.min(limit, 200));
        String safePrefix = normalizePrefix(typePrefix);

        StringBuilder sql = new StringBuilder("""
            SELECT
              id,
              anomaly_type,
              severity,
              user_id,
              stream_record_id,
              transaction_id,
              platform_transaction_id,
              expected_value,
              actual_value,
              delta_value,
              description,
              status,
              detected_at,
              resolved_at,
              resolution_note,
              audit_run_id,
              created_at
            FROM accounting_anomalies
            """);

        if (safePrefix != null) {
            sql.append(" WHERE anomaly_type LIKE :typePrefix ");
        }

        sql.append(" ORDER BY id DESC LIMIT :limit ");

        var query = em.createNativeQuery(sql.toString())
                .setParameter("limit", safeLimit);

        if (safePrefix != null) {
            query.setParameter("typePrefix", safePrefix + "%");
        }

        @SuppressWarnings("unchecked")
        List<Object[]> rows = query.getResultList();

        List<Map<String, Object>> out = new ArrayList<>(rows.size());
        for (Object[] r : rows) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", r[0]);
            m.put("anomalyType", r[1]);
            m.put("severity", r[2]);
            m.put("userId", r[3]);
            m.put("streamRecordId", r[4]);
            m.put("transactionId", r[5]);
            m.put("platformTransactionId", r[6]);
            m.put("expectedValue", r[7]);
            m.put("actualValue", r[8]);
            m.put("deltaValue", r[9]);
            m.put("description", r[10]);
            m.put("status", r[11]);
            m.put("detectedAt", r[12]);
            m.put("resolvedAt", r[13]);
            m.put("resolutionNote", r[14]);
            m.put("auditRunId", r[15]);
            m.put("createdAt", r[16]);
            out.add(m);
        }

        return out;
    }

    private String normalizePrefix(String raw) {
        if (raw == null) {
            return null;
        }
        String s = raw.trim();
        return s.isEmpty() ? null : s;
    }
}