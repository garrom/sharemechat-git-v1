package com.sharemechat.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * Datos fisicos declarados por la modelo, mostrados al cliente en el modal
 * / panel "Ver perfil completo" (Card 1, Fase 2). Relacion 1:1 con el
 * modelo (user_id = users.id).
 *
 * <p>La EDAD no vive aqui: se deriva de {@code users.date_of_birth} en el
 * service (se expone como entero, nunca la fecha). Los enums
 * ({@code sex}, {@code bustSize}, {@code buttSize}, {@code bodyType}) se
 * guardan como codigo canonico y se validan en Java
 * ({@code ModelProfileAttributesService}); el frontend los traduce via i18n.
 *
 * <p>Todos los campos son nullable: la modelo rellena lo que quiera; los
 * null no se pintan en la card. La fila se crea en upsert al primer guardado.
 */
@Entity
@Table(name = "model_profile_attributes")
public class ModelProfileAttributes {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @Column(name = "sex", length = 16)
    private String sex;

    @Column(name = "bust_size", length = 16)
    private String bustSize;

    @Column(name = "height_cm")
    private Integer heightCm;

    @Column(name = "butt_size", length = 16)
    private String buttSize;

    @Column(name = "body_type", length = 16)
    private String bodyType;

    // Gestionado por MySQL (DEFAULT CURRENT_TIMESTAMP ON UPDATE ...); mismo
    // patron que users.updated_at.
    @Column(name = "updated_at", insertable = false, updatable = false,
            columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
    private LocalDateTime updatedAt;

    public ModelProfileAttributes() {
    }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getSex() { return sex; }
    public void setSex(String sex) { this.sex = sex; }

    public String getBustSize() { return bustSize; }
    public void setBustSize(String bustSize) { this.bustSize = bustSize; }

    public Integer getHeightCm() { return heightCm; }
    public void setHeightCm(Integer heightCm) { this.heightCm = heightCm; }

    public String getButtSize() { return buttSize; }
    public void setButtSize(String buttSize) { this.buttSize = buttSize; }

    public String getBodyType() { return bodyType; }
    public void setBodyType(String bodyType) { this.bodyType = bodyType; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
