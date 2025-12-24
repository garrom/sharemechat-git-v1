package com.sharemechat.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import java.math.BigDecimal;

@Component
@ConfigurationProperties(prefix = "gift")
public class GiftProperties {

    private BigDecimal modelShare; // gift.model-share

    public BigDecimal getModelShare() { return modelShare; }
    public void setModelShare(BigDecimal v) { this.modelShare = v; }
}
