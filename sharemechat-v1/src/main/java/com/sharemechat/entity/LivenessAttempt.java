package com.sharemechat.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * ADR-050 Fase B: intento de liveness challenge del usuario contra
 * SightEngine face-attributes.
 *
 * <p>Un usuario puede tener N filas historicas; la "pass vigente" se
 * resuelve por la fila mas reciente con {@code status='PASSED'} y
 * {@code passed_until > now UTC}. Al expirar {@code passed_until}, la
 * fila queda como registro historico y el usuario debe pasar un nuevo
 * challenge.
 *
 * <p>Transicion de estados:
 * <ul>
 *   <li>{@code PENDING}: creada por startChallenge. Aun sin verify.</li>
 *   <li>{@code PASSED}: verify OK. Habilita startMatch hasta
 *       {@code passed_until}.</li>
 *   <li>{@code FAILED}: verify no cumplio la regla del challenge type.</li>
 *   <li>{@code EXPIRED}: PENDING sin verify en TTL corto (~2 min).
 *       Job de limpieza o startChallenge nuevo del mismo user marca la
 *       PENDING vieja como EXPIRED.</li>
 * </ul>
 *
 * <p>El JSON de {@code sightengineVerdict} guarda la respuesta cruda del
 * vendor (para calibracion empirica D10) o marcadores especiales
 * {@code {"mock":true}} en modo MOCK, {@code {"vendor_unavailable":true}}
 * en fail-closed-soft D5. Nunca contiene la imagen del frame.
 *
 * <p>Convencion UTC estricta en {@code passed_until}, {@code created_at}
 * y {@code resolved_at}. Coherente con {@code AffiliateCommission} y con
 * la nota UTC del ADR-050.
 */
@Entity
@Table(name = "liveness_attempts")
public class LivenessAttempt {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** ADR-050 D4: BLINK, TURN_LEFT, TURN_RIGHT, SMILE. */
    @Column(name = "challenge_type", nullable = false, length = 20)
    private String challengeType;

    /**
     * Codigo del prompt mostrado al usuario (ej. {@code BLINK_TWICE}).
     * La traduccion vive en i18n; aqui persistimos el codigo estable
     * para trazabilidad y auditoria.
     */
    @Column(name = "prompt_lc", nullable = false, length = 40)
    private String promptLc;

    /** PENDING / PASSED / FAILED / EXPIRED. */
    @Column(name = "status", nullable = false, length = 20)
    private String status;

    /**
     * Respuesta cruda de SightEngine face-attributes o marcadores
     * especiales {@code {"mock":true}} / {@code {"vendor_unavailable":true}}.
     * Se persiste como String; el mapping a JSON queda a la lectura del
     * caller.
     */
    @Column(name = "sightengine_verdict", columnDefinition = "JSON")
    private String sightengineVerdict;

    @Column(name = "frames_count", nullable = false)
    private Integer framesCount = 0;

    /**
     * Ventana de validez del pass. {@code NULL} mientras
     * {@code status != PASSED}. Cuando PASSED, se calcula como
     * {@code createdAt + property ttlSeconds} (24h D3, 5 min D5).
     */
    @Column(name = "passed_until")
    private LocalDateTime passedUntil;

    @Column(name = "created_at", nullable = false, updatable = false,
            columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP")
    private LocalDateTime createdAt;

    /**
     * Timestamp UTC de la transicion a estado terminal
     * (PASSED/FAILED/EXPIRED). {@code NULL} mientras
     * {@code status = PENDING}.
     */
    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    public LivenessAttempt() {
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getChallengeType() { return challengeType; }
    public void setChallengeType(String challengeType) { this.challengeType = challengeType; }

    public String getPromptLc() { return promptLc; }
    public void setPromptLc(String promptLc) { this.promptLc = promptLc; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getSightengineVerdict() { return sightengineVerdict; }
    public void setSightengineVerdict(String sightengineVerdict) {
        this.sightengineVerdict = sightengineVerdict;
    }

    public Integer getFramesCount() { return framesCount; }
    public void setFramesCount(Integer framesCount) { this.framesCount = framesCount; }

    public LocalDateTime getPassedUntil() { return passedUntil; }
    public void setPassedUntil(LocalDateTime passedUntil) { this.passedUntil = passedUntil; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(LocalDateTime resolvedAt) { this.resolvedAt = resolvedAt; }
}
