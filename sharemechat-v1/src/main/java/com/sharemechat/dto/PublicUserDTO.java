package com.sharemechat.dto;

/**
 * Vista pública sanitizada de un usuario expuesta cuando el viewer
 * NO es backoffice (USER, CLIENT, MODEL sin rol backoffice asignado).
 *
 * <p>Esta forma elimina cualquier dato legal/PII del peer:
 * <ul>
 *   <li><b>Sin</b> {@code name} / {@code surname} (nombre legal).</li>
 *   <li><b>Sin</b> {@code email}.</li>
 *   <li><b>Sin</b> {@code dateOfBirth}.</li>
 *   <li><b>Sin</b> {@code countryDetected}.</li>
 *   <li><b>Sin</b> {@code verificationStatus} (estado interno del proceso
 *       KYC, no debe filtrarse a clientes/modelos peer).</li>
 *   <li><b>Sin</b> {@code accountStatus}, {@code suspendedUntil},
 *       {@code riskReason} y demás flags internos.</li>
 * </ul>
 *
 * <p>Campos expuestos:
 * <ul>
 *   <li>{@code id} — necesario para correlación entre payloads.</li>
 *   <li>{@code nickname} — identidad pública declarada.</li>
 *   <li>{@code role} — público por diseño; el frontend lo usa para
 *       diferenciar UI cliente vs modelo del peer.</li>
 *   <li>{@code biography} — declarado por el modelo para ser visto por
 *       el cliente; no es PII.</li>
 *   <li>{@code interests} — análogamente declarado, no es PII.</li>
 * </ul>
 *
 * <p>Cuando el viewer SÍ es backoffice (ADMIN, SUPPORT, AUDIT, EDITOR),
 * se serializa {@link BackofficeUserViewDTO} en lugar de este, que
 * incluye todos los datos del User excepto la password.
 */
public class PublicUserDTO {

    private Long id;
    private String nickname;
    private String role;
    private String biography;
    private String interests;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getNickname() { return nickname; }
    public void setNickname(String nickname) { this.nickname = nickname; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getBiography() { return biography; }
    public void setBiography(String biography) { this.biography = biography; }

    public String getInterests() { return interests; }
    public void setInterests(String interests) { this.interests = interests; }
}
