package com.sharemechat.dto;

import java.math.BigDecimal;

/**
 * DTO expuesto por GET /api/products/emojis/available.
 *
 * A diferencia del legacy GiftPublicDTO que expone `tier` (QUICK / PREMIUM,
 * el vocabulario historico de la BD), este DTO expone `category` con los
 * valores FREE_EMOJI / PAID_GIFT como categoria canonica del contrato
 * publico. La BD sigue con la columna `tier` intacta: el mapping se hace
 * en EmojiCatalogService.
 *
 * Se preserva ademas el campo `tier` en el payload para retrocompat con
 * consumidores frontend que ya lo leen (normalizeGiftTier del picker,
 * renderGiftVisual, etc.). Las dos claves siempre coinciden en semantica:
 *   tier=QUICK   -> category=FREE_EMOJI
 *   tier=PREMIUM -> category=PAID_GIFT
 */
public class EmojiPublicDTO {

    public static final String CATEGORY_FREE_EMOJI = "FREE_EMOJI";
    public static final String CATEGORY_PAID_GIFT = "PAID_GIFT";

    private Long id;
    private String code;
    private String name;
    private String description;
    private String icon;
    private BigDecimal cost;
    private String category;
    private String tier;
    private Boolean featured;
    private String animationKey;
    private String localeKey;

    public EmojiPublicDTO(Long id, String code, String name, String description, String icon,
                          BigDecimal cost, String category, String tier, Boolean featured,
                          String animationKey, String localeKey) {
        this.id = id;
        this.code = code;
        this.name = name;
        this.description = description;
        this.icon = icon;
        this.cost = cost;
        this.category = category;
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
    public String getCategory() { return category; }
    public String getTier() { return tier; }
    public Boolean getFeatured() { return featured; }
    public String getAnimationKey() { return animationKey; }
    public String getLocaleKey() { return localeKey; }
}
