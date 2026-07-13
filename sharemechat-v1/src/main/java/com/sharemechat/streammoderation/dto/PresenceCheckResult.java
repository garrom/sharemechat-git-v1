package com.sharemechat.streammoderation.dto;

/**
 * ADR-050 Fase C: resultado del check de presencia (face-analysis +
 * face-presence de SightEngine) sobre un frame durante streaming en vivo.
 *
 * <p>Scores {@code [0, 1]} devueltos por el modelo {@code face-presence}
 * del vendor. Cuando el vendor NO detecta ninguna cara en el frame,
 * {@link #faceDetected} es {@code false} y los 4 scores son {@code 0.0}
 * (interpretacion neutra: no hay señal ni pro ni contra).
 *
 * <p>{@link #outOfSceneOverlay} es especifico para pantallas digitales
 * (monitor, TV, movil) — la señal principal del ataque OBS-con-video.
 * {@link #outOfSceneNatural} cubre posters, portadas de libros/revistas
 * y otros medios impresos.
 *
 * <p>{@link #rawJson} es la respuesta cruda del vendor para trazabilidad
 * y calibracion empirica de umbrales (ADR-050 Fase C, deuda #D-26).
 */
public class PresenceCheckResult {

    private final boolean faceDetected;
    private final double inScene;
    private final double outOfScene;
    private final double outOfSceneNatural;
    private final double outOfSceneOverlay;
    private final String rawJson;

    public PresenceCheckResult(boolean faceDetected,
                                double inScene,
                                double outOfScene,
                                double outOfSceneNatural,
                                double outOfSceneOverlay,
                                String rawJson) {
        this.faceDetected = faceDetected;
        this.inScene = inScene;
        this.outOfScene = outOfScene;
        this.outOfSceneNatural = outOfSceneNatural;
        this.outOfSceneOverlay = outOfSceneOverlay;
        this.rawJson = rawJson;
    }

    public boolean isFaceDetected() { return faceDetected; }
    public double getInScene() { return inScene; }
    public double getOutOfScene() { return outOfScene; }
    public double getOutOfSceneNatural() { return outOfSceneNatural; }
    public double getOutOfSceneOverlay() { return outOfSceneOverlay; }
    public String getRawJson() { return rawJson; }
}
