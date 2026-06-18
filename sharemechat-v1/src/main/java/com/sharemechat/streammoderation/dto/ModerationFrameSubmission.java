package com.sharemechat.streammoderation.dto;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * Input al {@code ModerationProviderClient.submitImage} (interface
 * vendor-agnostic que se introducira en P1.2). Esqueleto del frame
 * sometido a moderacion mas su contexto operativo minimo.
 *
 * <p>DTO interno del control plane, NO de transporte REST: sin
 * anotaciones Jackson ni validacion de entrada. El frame viaja como
 * {@code byte[]} para preservar los bytes exactos del JPEG/PNG
 * capturado por el browser del modelo (ADR-036 bloque 1).
 *
 * <p>P1.2 podra refinar el shape (anyadir flags vendor-specific,
 * dimensionalidad declarada, etc.). En P1.1 se deja como esqueleto.
 */
public class ModerationFrameSubmission {

    private byte[] frameBytes;
    private Long streamRecordId;
    private Long streamModerationSessionId;
    private Instant frameTimestamp;
    private Map<String, String> metadata = new HashMap<>();

    public ModerationFrameSubmission() {
    }

    public byte[] getFrameBytes() {
        return frameBytes;
    }

    public void setFrameBytes(byte[] frameBytes) {
        this.frameBytes = frameBytes;
    }

    public Long getStreamRecordId() {
        return streamRecordId;
    }

    public void setStreamRecordId(Long streamRecordId) {
        this.streamRecordId = streamRecordId;
    }

    public Long getStreamModerationSessionId() {
        return streamModerationSessionId;
    }

    public void setStreamModerationSessionId(Long streamModerationSessionId) {
        this.streamModerationSessionId = streamModerationSessionId;
    }

    public Instant getFrameTimestamp() {
        return frameTimestamp;
    }

    public void setFrameTimestamp(Instant frameTimestamp) {
        this.frameTimestamp = frameTimestamp;
    }

    public Map<String, String> getMetadata() {
        return metadata;
    }

    public void setMetadata(Map<String, String> metadata) {
        this.metadata = metadata;
    }
}
