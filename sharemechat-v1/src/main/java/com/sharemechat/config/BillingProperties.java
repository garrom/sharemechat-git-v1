package com.sharemechat.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import java.math.BigDecimal;

@Component
@ConfigurationProperties(prefix = "billing")
public class BillingProperties {
    private BigDecimal ratePerMinute;       // billing.rate-per-minute
    private BigDecimal modelShare;          // billing.model-share
    private BigDecimal cutoffThresholdEur;  // billing.cutoff-threshold-eur
    public BigDecimal getRatePerMinute(){ return ratePerMinute; }
    public void setRatePerMinute(BigDecimal v){ this.ratePerMinute = v; }
    public BigDecimal getModelShare(){ return modelShare; }
    public void setModelShare(BigDecimal v){ this.modelShare = v; }
    public BigDecimal getCutoffThresholdEur(){ return cutoffThresholdEur; }
    public void setCutoffThresholdEur(BigDecimal v){ this.cutoffThresholdEur = v; }

}
