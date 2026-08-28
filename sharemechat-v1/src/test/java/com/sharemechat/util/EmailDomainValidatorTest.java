package com.sharemechat.util;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Casos deterministas (sin DNS): emails malformados o con dominio sin forma
 * válida se rechazan antes de cualquier lookup. El comportamiento DNS
 * (NXDOMAIN -> false, timeout -> fail-open) es de integración y no se prueba aquí
 * para no depender de la red en CI.
 */
class EmailDomainValidatorTest {

    @Test
    void rechazaEmailsMalformadosSinTocarDns() {
        assertThat(EmailDomainValidator.domainLikelyValid(null)).isFalse();
        assertThat(EmailDomainValidator.domainLikelyValid("")).isFalse();
        assertThat(EmailDomainValidator.domainLikelyValid("noarroba")).isFalse();
        assertThat(EmailDomainValidator.domainLikelyValid("nada@")).isFalse();
        assertThat(EmailDomainValidator.domainLikelyValid("nada@sindominioconpunto")).isFalse();
        assertThat(EmailDomainValidator.domainLikelyValid("nada@.com")).isFalse();
        assertThat(EmailDomainValidator.domainLikelyValid("nada@dom.")).isFalse();
        assertThat(EmailDomainValidator.domainLikelyValid("@dom.com")).isFalse();
    }

    @Test
    void extractDomainNormalizaYValidaForma() {
        assertThat(EmailDomainValidator.extractDomain("User@Gmail.COM")).isEqualTo("gmail.com");
        assertThat(EmailDomainValidator.extractDomain("  a@b.co  ")).isEqualTo("b.co");
        assertThat(EmailDomainValidator.extractDomain("a@sub.dominio.org")).isEqualTo("sub.dominio.org");
        assertThat(EmailDomainValidator.extractDomain(null)).isNull();
        assertThat(EmailDomainValidator.extractDomain("sinarroba")).isNull();
        assertThat(EmailDomainValidator.extractDomain("a@sinpunto")).isNull();
    }
}
