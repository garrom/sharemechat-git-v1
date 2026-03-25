package com.sharemechat.dto;

import java.math.BigDecimal;

public class GiftPublicDTO {

    private Long id;
    private String code;
    private String name;
    private String description;
    private String icon;
    private BigDecimal cost;
    private String tier;
    private Boolean featured;
    private String animationKey;
    private String localeKey;

    public GiftPublicDTO(Long id, String code, String name, String description, String icon, BigDecimal cost, String tier, Boolean featured, String animationKey, String localeKey) {
        this.id = id;
        this.code = code;
        this.name = name;
        this.description = description;
        this.icon = icon;
        this.cost = cost;
        this.tier = tier;
        this.featured = featured;
        this.animationKey = animationKey;
        this.localeKey = localeKey;
    }

    public Long getId() { return id; }
    public String getCode() { return code; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public String getIcon() { return icon; }
    public BigDecimal getCost() { return cost; }
    public String getTier() { return tier; }
    public Boolean getFeatured() { return featured; }
    public String getAnimationKey() { return animationKey; }
    public String getLocaleKey() { return localeKey; }
}
