package com.sharemechat.dto;

/**
 * ADR-050 Fase B: resultado normalizado (vendor-agnostic) del analisis
 * de face-attributes sobre un frame.
 *
 * <p>El {@code LivenessFaceAttributesProvider} devuelve una instancia por
 * frame. Si el vendor no detecta cara en el frame, {@code faceDetected}
 * es {@code false} y el resto de scores son 0 (interpretacion neutra).
 *
 * <p>Los scores {@code smile} y {@code eyesClosed} son probabilidades
 * en {@code [0, 1]}. El {@code yaw} es el angulo horizontal de la cara
 * en grados; convencion SightEngine: negativo = giro a la izquierda,
 * positivo = derecha, 0 = frontal. Rango tipico {@code [-90, +90]}.
 *
 * <p>{@code rawJson} es la respuesta cruda del vendor (para persistir en
 * {@code liveness_attempts.sightengine_verdict} y calibracion empirica
 * D10 del ADR-050).
 */
public class FaceAttributesResult {

    private final boolean faceDetected;
    private final double smile;
    private final double eyesClosed;
    private final double yaw;
    private final double leftEyeX;
    private final double leftEyeY;
    private final double rightEyeX;
    private final double rightEyeY;
    private final double noseTipX;
    private final double noseTipY;
    private final String rawJson;

    public FaceAttributesResult(boolean faceDetected,
                                 double smile,
                                 double eyesClosed,
                                 double yaw,
                                 double leftEyeX,
                                 double leftEyeY,
                                 double rightEyeX,
                                 double rightEyeY,
                                 double noseTipX,
                                 double noseTipY,
                                 String rawJson) {
        this.faceDetected = faceDetected;
        this.smile = smile;
        this.eyesClosed = eyesClosed;
        this.yaw = yaw;
        this.leftEyeX = leftEyeX;
        this.leftEyeY = leftEyeY;
        this.rightEyeX = rightEyeX;
        this.rightEyeY = rightEyeY;
        this.noseTipX = noseTipX;
        this.noseTipY = noseTipY;
        this.rawJson = rawJson;
    }

    /**
     * Constructor legacy sin landmarks - usado por tests y por rutas
     * antiguas. Los landmarks se quedan a 0.0.
     */
    public FaceAttributesResult(boolean faceDetected,
                                 double smile,
                                 double eyesClosed,
                                 double yaw,
                                 String rawJson) {
        this(faceDetected, smile, eyesClosed, yaw, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, rawJson);
    }

    public boolean isFaceDetected() { return faceDetected; }
    public double getSmile() { return smile; }
    public double getEyesClosed() { return eyesClosed; }
    public double getYaw() { return yaw; }
    public double getLeftEyeX() { return leftEyeX; }
    public double getLeftEyeY() { return leftEyeY; }
    public double getRightEyeX() { return rightEyeX; }
    public double getRightEyeY() { return rightEyeY; }
    public double getNoseTipX() { return noseTipX; }
    public double getNoseTipY() { return noseTipY; }
    public String getRawJson() { return rawJson; }
}
