package com.sharemechat.streammoderation.service;

import com.sharemechat.config.ModerationEvidenceProperties;
import com.sharemechat.streammoderation.entity.StreamModerationReview;
import com.sharemechat.streammoderation.repository.StreamModerationReviewRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import software.amazon.awssdk.core.exception.SdkException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests del {@link ModerationEvidenceUploader} con S3Client mockeado.
 */
class ModerationEvidenceUploaderTest {

    private ModerationEvidenceProperties props;
    private StreamModerationReviewRepository repo;
    private S3Client s3;
    private ModerationEvidenceUploader uploader;

    @BeforeEach
    void setUp() {
        props = new ModerationEvidenceProperties();
        props.setBucket("sharemechat-moderation-evidence-test");
        props.setRegion("eu-central-1");
        props.setServerSideEncryption("AES256");
        repo = mock(StreamModerationReviewRepository.class);
        s3 = mock(S3Client.class);

        uploader = new ModerationEvidenceUploader(props, repo);
        uploader.setS3ClientForTests(s3);
        uploader.setActiveProfileForTests("test");
    }

    private StreamModerationReview review(Long id, Long sessionId, String providerEventId) {
        StreamModerationReview r = new StreamModerationReview();
        r.setStreamModerationSessionId(sessionId);
        r.setProviderEventId(providerEventId);
        // id default 0, suficiente para que key sea determinista por providerEventId
        return r;
    }

    @Test
    @DisplayName("Happy path: putObject invocado, evidenceRef rellenado, save invocado")
    void happyPath() {
        StreamModerationReview r = review(1L, 7L, "ev-abc");
        when(repo.findById(1L)).thenReturn(Optional.of(r));

        uploader.uploadInternal(1L, new byte[] {1, 2, 3});

        ArgumentCaptor<PutObjectRequest> req = ArgumentCaptor.forClass(PutObjectRequest.class);
        verify(s3).putObject(req.capture(), any(RequestBody.class));
        assertEquals("sharemechat-moderation-evidence-test", req.getValue().bucket());
        assertEquals("test/7/ev-abc.jpg", req.getValue().key());
        assertEquals("image/jpeg", req.getValue().contentType());

        assertEquals("test/7/ev-abc.jpg", r.getEvidenceRef());
        verify(repo).save(r);
    }

    @Test
    @DisplayName("providerEventId con caracteres peligrosos -> sanitizado en la key")
    void sanitizesKey() {
        StreamModerationReview r = review(1L, 7L, "weird/key:with*chars");
        when(repo.findById(1L)).thenReturn(Optional.of(r));

        uploader.uploadInternal(1L, new byte[] {1});

        ArgumentCaptor<PutObjectRequest> req = ArgumentCaptor.forClass(PutObjectRequest.class);
        verify(s3).putObject(req.capture(), any(RequestBody.class));
        // / : * sustituidos por _
        assertTrue(req.getValue().key().endsWith("weird_key_with_chars.jpg"));
    }

    @Test
    @DisplayName("review no encontrada -> no-op (no putObject, no save)")
    void reviewNotFoundNoOp() {
        when(repo.findById(99L)).thenReturn(Optional.empty());

        uploader.uploadInternal(99L, new byte[] {1});

        verify(s3, never()).putObject(any(PutObjectRequest.class), any(RequestBody.class));
        verify(repo, never()).save(any());
    }

    @Test
    @DisplayName("frame bytes vacios -> no-op")
    void emptyBytesNoOp() {
        uploader.uploadInternal(1L, new byte[0]);
        verify(s3, never()).putObject(any(PutObjectRequest.class), any(RequestBody.class));
    }

    @Test
    @DisplayName("frame bytes null -> no-op")
    void nullBytesNoOp() {
        uploader.uploadInternal(1L, null);
        verify(s3, never()).putObject(any(PutObjectRequest.class), any(RequestBody.class));
    }

    @Test
    @DisplayName("uploadAsync envuelve excepcion S3 sin propagar (politica fail-silent del frente)")
    void asyncSwallowsS3Exception() {
        StreamModerationReview r = review(1L, 7L, "ev-fail");
        when(repo.findById(1L)).thenReturn(Optional.of(r));
        when(s3.putObject(any(PutObjectRequest.class), any(RequestBody.class)))
                .thenThrow(SdkException.builder().message("access denied").build());

        // No debe propagar
        uploader.uploadAsync(1L, new byte[] {1});
    }

    @Test
    @DisplayName("S3Client null (bucket no aprovisionado) -> no-op silencioso, no save")
    void nullS3ClientNoOp() {
        uploader.setS3ClientForTests(null);
        StreamModerationReview r = review(1L, 7L, "ev-x");
        when(repo.findById(1L)).thenReturn(Optional.of(r));

        uploader.uploadInternal(1L, new byte[] {1});

        verify(repo, never()).save(any());
    }

    @Test
    @DisplayName("buildKey usa keyPrefix cuando esta poblado")
    void keyPrefixApplied() {
        props.setKeyPrefix("frames");
        StreamModerationReview r = review(1L, 7L, "ev-1");
        when(repo.findById(1L)).thenReturn(Optional.of(r));

        uploader.uploadInternal(1L, new byte[] {1});

        ArgumentCaptor<PutObjectRequest> req = ArgumentCaptor.forClass(PutObjectRequest.class);
        verify(s3).putObject(req.capture(), any(RequestBody.class));
        assertTrue(req.getValue().key().startsWith("frames/"));
    }
}
