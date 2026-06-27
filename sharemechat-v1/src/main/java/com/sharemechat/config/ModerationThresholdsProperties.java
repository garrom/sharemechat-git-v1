package com.sharemechat.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

/**
 * Umbrales por categoria canonica del catalogo de moderacion del
 * producto (DEC-1 de P2.1).
 *
 * <p>Modelo de moderacion:
 * <ul>
 *   <li>HARD-BLOCK CRITICAL (kill stream automatico): MINORS (&gt;0.3),
 *       GORE (&gt;0.5). Aplicado por
 *       {@code StreamModerationActionService.triggerAutoCut}.</li>
 *   <li>REVISION HUMANA AMBER/RED (cola admin, sin interrumpir stream):
 *       NUDITY, VIOLENCE, WEAPONS, DRUGS, OFFENSIVE_SYMBOLS,
 *       SELF_HARM, GAMBLING. Aplicado por
 *       {@code StreamModerationActionService.createReview}.</li>
 * </ul>
 *
 * <p>Los umbrales son ajustables sin recompilar via
 * {@code moderation.thresholds.<categoria>.<nivel>} en
 * {@code application.properties} o env vars (Spring relaxed binding).
 *
 * <p>Categorias NO MODERADAS (DEC-1): bikini, underwear, cleavage
 * (sub-clases Sightengine permitidas por el producto). Hardcoded en
 * {@code ModerationCategoryMapper.IGNORED_SUBCLASSES}, no expuestas
 * aqui como properties.
 */
@Component
@ConfigurationProperties(prefix = "moderation.thresholds")
public class ModerationThresholdsProperties {

    private Category minors = onlyCritical("0.3");
    private Category gore = onlyCritical("0.5");
    private Category nudity = amberRed("0.5", "0.7");
    private Category violence = amberRed("0.5", "0.7");
    private Category weapons = amberRed("0.5", "0.7");
    private Category drugs = amberRed("0.5", "0.7");
    private Category selfHarm = onlyAmber("0.4");
    private Category offensiveSymbols = amberRed("0.5", "0.7");
    private Category gambling = onlyAmber("0.5");

    private static Category onlyCritical(String critical) {
        Category c = new Category();
        c.setCritical(new BigDecimal(critical));
        return c;
    }

    private static Category onlyAmber(String amber) {
        Category c = new Category();
        c.setAmber(new BigDecimal(amber));
        return c;
    }

    private static Category amberRed(String amber, String red) {
        Category c = new Category();
        c.setAmber(new BigDecimal(amber));
        c.setRed(new BigDecimal(red));
        return c;
    }

    public Category getMinors() { return minors; }
    public void setMinors(Category minors) { this.minors = minors; }

    public Category getGore() { return gore; }
    public void setGore(Category gore) { this.gore = gore; }

    public Category getNudity() { return nudity; }
    public void setNudity(Category nudity) { this.nudity = nudity; }

    public Category getViolence() { return violence; }
    public void setViolence(Category violence) { this.violence = violence; }

    public Category getWeapons() { return weapons; }
    public void setWeapons(Category weapons) { this.weapons = weapons; }

    public Category getDrugs() { return drugs; }
    public void setDrugs(Category drugs) { this.drugs = drugs; }

    public Category getSelfHarm() { return selfHarm; }
    public void setSelfHarm(Category selfHarm) { this.selfHarm = selfHarm; }

    public Category getOffensiveSymbols() { return offensiveSymbols; }
    public void setOffensiveSymbols(Category offensiveSymbols) { this.offensiveSymbols = offensiveSymbols; }

    public Category getGambling() { return gambling; }
    public void setGambling(Category gambling) { this.gambling = gambling; }

    /**
     * Niveles configurables por categoria. Solo se rellenan los que
     * apliquen segun el catalogo (MINORS/GORE solo critical;
     * SELF_HARM/GAMBLING solo amber; resto amber+red).
     */
    public static class Category {
        private BigDecimal amber;
        private BigDecimal red;
        private BigDecimal critical;

        public BigDecimal getAmber() { return amber; }
        public void setAmber(BigDecimal amber) { this.amber = amber; }

        public BigDecimal getRed() { return red; }
        public void setRed(BigDecimal red) { this.red = red; }

        public BigDecimal getCritical() { return critical; }
        public void setCritical(BigDecimal critical) { this.critical = critical; }
    }
}
