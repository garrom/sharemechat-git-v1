package com.sharemechat.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "gifts")
public class Gift {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // nombre visible del regalo (p.ej. "Rosa", "Coche", etc.)
    @Column(name = "name", nullable = false)
    private String name;

    // ruta/URL del icono (o key en tu storage)
    @Column(name = "icon", nullable = false)
    private String icon;

    // coste en la moneda/unidad que definas
    @Column(name = "cost", nullable = false, precision = 10, scale = 2)
    private BigDecimal cost;

    public Gift() {}

    //getter y setters

    public Long getId() { return id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getIcon() { return icon; }
    public void setIcon(String icon) { this.icon = icon; }

    public BigDecimal getCost() { return cost; }
    public void setCost(BigDecimal cost) { this.cost = cost; }
}
