package com.sharemechat.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "gifts")
public class Gift {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "code")
    private String code;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "description")
    private String description;

    @Column(name = "tier", nullable = false)
    private String tier = "QUICK";

    @Column(name = "featured", nullable = false)
    private Boolean featured = false;

    @Column(name = "animation_key")
    private String animationKey;

    @Column(name = "locale_key")
    private String localeKey;

    @Column(name = "icon", nullable = false)
    private String icon;

    @Column(name = "cost", nullable = false, precision = 10, scale = 2)
    private BigDecimal cost;

    @Column(name = "active", nullable = false)
    private Boolean active = true;

    @Column(name = "sort_order", nullable = false)
    private Integer displayOrder = 0;


    public Gift() {}

    //getter y setters

    public Long getId() { return id; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getTier() { return tier; }
    public void setTier(String tier) { this.tier = tier; }

    public Boolean getFeatured() { return featured; }
    public void setFeatured(Boolean featured) { this.featured = featured; }

    public String getAnimationKey() { return animationKey; }
    public void setAnimationKey(String animationKey) { this.animationKey = animationKey; }

    public String getLocaleKey() { return localeKey; }
    public void setLocaleKey(String localeKey) { this.localeKey = localeKey; }

    public String getIcon() { return icon; }
    public void setIcon(String icon) { this.icon = icon; }

    public BigDecimal getCost() { return cost; }
    public void setCost(BigDecimal cost) { this.cost = cost; }

    public Boolean getActive() {return active;}
    public void setActive(Boolean active) {this.active = active; }

    public Integer getDisplayOrder() {return displayOrder;}

    public void setDisplayOrder(Integer displayOrder) {this.displayOrder = displayOrder;}
}
