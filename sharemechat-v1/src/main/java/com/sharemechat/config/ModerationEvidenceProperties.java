package com.sharemechat.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Configuracion del bucket S3 de evidencia visual del pipeline de
 * moderacion (frente Moderacion IA P2.1; DEC-3).
 *
 * <p>Bucket dedicado por entorno
 * ({@code sharemechat-moderation-evidence-{test,audit,prod}}), creado
 * fuera de codigo (procedimiento manual del operador, sin IaC en el
 * repo). SSE-S3 (AES256) y lifecycle TTL 30 dias gestionados en el
 * bucket.
 *
 * <p>Spring relaxed binding: MODERATION_EVIDENCE_S3_BUCKET,
 * MODERATION_EVIDENCE_S3_REGION, MODERATION_EVIDENCE_S3_KEY_PREFIX,
 * MODERATION_EVIDENCE_S3_SERVER_SIDE_ENCRYPTION.
 *
 * <p>Si {@code bucket} esta blank, el uploader degrada a no-op (log
 * warn). Permite cargar el bean en entornos donde el bucket aun no se
 * haya aprovisionado, sin romper el arranque.
 */
@Component
@ConfigurationProperties(prefix = "moderation.evidence.s3")
public class ModerationEvidenceProperties {

    private String bucket = "";
    private String region = "";
    private String keyPrefix = "";
    private String serverSideEncryption = "AES256";

    public String getBucket() {
        return bucket;
    }

    public void setBucket(String bucket) {
        this.bucket = bucket;
    }

    public String getRegion() {
        return region;
    }

    public void setRegion(String region) {
        this.region = region;
    }

    public String getKeyPrefix() {
        return keyPrefix;
    }

    public void setKeyPrefix(String keyPrefix) {
        this.keyPrefix = keyPrefix;
    }

    public String getServerSideEncryption() {
        return serverSideEncryption;
    }

    public void setServerSideEncryption(String serverSideEncryption) {
        this.serverSideEncryption = serverSideEncryption;
    }
}
