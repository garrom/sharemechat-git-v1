package com.sharemechat.accountingaudit.job;

import com.sharemechat.accountingaudit.dto.AuditJobRequest;
import com.sharemechat.accountingaudit.dto.AuditJobResult;

public interface AccountingAuditJob {

    AuditJobResult execute(AuditJobRequest request);

}
