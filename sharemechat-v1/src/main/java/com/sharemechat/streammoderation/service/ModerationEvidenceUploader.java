package com.sharemechat.streammoderation.service;

import com.sharemechat.config.ModerationEvidenceProperties;
import com.sharemechat.streammoderation.entity.StreamModerationReview;
import com.sharemechat.streammoderation.repository.StreamModerationReviewRepository;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.ServerSideEncryption;

import java.util.Optional;

/**
 * Upload asincrono de la imagen evidencia al bucket S3 dedicado del
 * frente moderacion (DEC-3 P2.1). La invocacion vive en
 * {@link StreamFrameIngestionService#processFrame} y solo se dispara
 * cuando el verdict escala a severity &ge; AMBER.
 *
 * <p>S3Client propio con {@link DefaultCredentialsProvider} (toma el
 * IAM role del EC2 backend). Bucket configurado via
 * {@link ModerationEvidenceProperties}. SSE-S3 default AES256;
 * lifecycle TTL 30 dias gestionado en el bucket fuera de codigo.
 *
 * <p>Politica de fallo: el upload S3 NO es path critico para el
 * verdict. Si falla, log warn y continuar. El {@code evidence_ref} de
 * la review queda NULL, la cola humana no rompe.
 *
 * <p>Bean construido siempre; si {@code bucket} blank, el cliente S3
 * no se inicializa y el metodo {@link #uploadAsync} queda como no-op
 * silencioso. Permite cargar el frente en entornos donde el bucket aun
 * no este aprovisionado.
 */
@Service
public class ModerationEvidenceUploader {

    private static final Logger log = LoggerFactory.getLogger(ModerationEvidenceUploader.class);

    private final ModerationEvidenceProperties props;
    private final StreamModerationReviewRepository reviewRepository;

    @Value("${spring.profiles.active:default}")
    private String activeProfile;

    private S3Client s3Client;

    public ModerationEvidenceUploader(ModerationEvidenceProperties props,
                                      StreamModerationReviewRepository reviewRepository) {
        this.props = props;
        this.reviewRepository = reviewRepository;
    }

    @PostConstruct
    void init() {
        if (!StringUtils.hasText(props.getBucket())) {
            log.warn("[STREAM-MOD-EVIDENCE] bucket blank; uploader queda como no-op silencioso");
            return;
        }
        if (!StringUtils.hasText(props.getRegion())) {
            log.warn("[STREAM-MOD-EVIDENCE] region blank; uploader queda como no-op silencioso");
            return;
        }
        this.s3Client = S3Client.builder()
                .region(Region.of(props.getRegion()))
                .credentialsProvider(DefaultCredentialsProvider.create())
                .build();
        log.info("[STREAM-MOD-EVIDENCE] uploader ready bucket={} region={}",
                props.getBucket(), props.getRegion());
    }

    @PreDestroy
    void destroy() {
        if (s3Client != null) {
            s3Client.close();
        }
    }

    @Async("moderationExecutor")
    public void uploadAsync(Long reviewId, byte[] frameBytes) {
        try {
            uploadInternal(reviewId, frameBytes);
        } catch (Exception ex) {
            log.warn("[STREAM-MOD-EVIDENCE] upload FAIL reviewId={}: {}", reviewId, ex.getMessage());
        }
    }

    // package-private para tests sincronos
    void uploadInternal(Long reviewId, byte[] frameBytes) {
        if (s3Client == null) {
            log.warn("[STREAM-MOD-EVIDENCE] s3Client null; no-op reviewId={}", reviewId);
            return;
        }
        if (frameBytes == null || frameBytes.length == 0) {
            return;
        }
        Optional<StreamModerationReview> opt = reviewRepository.findById(reviewId);
        if (opt.isEmpty()) {
            log.warn("[STREAM-MOD-EVIDENCE] review no encontrada reviewId={}", reviewId);
            return;
        }
        StreamModerationReview r = opt.get();

        String key = buildKey(r);
        long t0 = System.currentTimeMillis();

        PutObjectRequest.Builder b = PutObjectRequest.builder()
                .bucket(props.getBucket())
                .key(key)
                .contentType("image/jpeg")
                .contentLength((long) frameBytes.length);
        if (StringUtils.hasText(props.getServerSideEncryption())) {
            b.serverSideEncryption(ServerSideEncryption.fromValue(props.getServerSideEncryption()));
        }

        s3Client.putObject(b.build(), RequestBody.fromBytes(frameBytes));

        r.setEvidenceRef(key);
        reviewRepository.save(r);

        log.info("[STREAM-MOD-EVIDENCE] uploaded reviewId={} key={} latency_ms={}",
                reviewId, key, System.currentTimeMillis() - t0);
    }

    String buildKey(StreamModerationReview r) {
        StringBuilder sb = new StringBuilder();
        if (StringUtils.hasText(props.getKeyPrefix())) {
            sb.append(props.getKeyPrefix()).append('/');
        }
        if (StringUtils.hasText(activeProfile) && !"default".equalsIgnoreCase(activeProfile)) {
            sb.append(activeProfile).append('/');
        }
        sb.append(r.getStreamModerationSessionId()).append('/');
        String pev = r.getProviderEventId();
        sb.append(StringUtils.hasText(pev)
                ? pev.replaceAll("[^a-zA-Z0-9._-]", "_")
                : ("review-" + r.getId()));
        sb.append(".jpg");
        return sb.toString();
    }

    // hooks para tests
    void setS3ClientForTests(S3Client client) {
        this.s3Client = client;
    }

    void setActiveProfileForTests(String profile) {
        this.activeProfile = profile;
    }
}
