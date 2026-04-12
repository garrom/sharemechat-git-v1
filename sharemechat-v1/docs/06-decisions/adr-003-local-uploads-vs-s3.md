# ADR-003: Uploads locales servidos por Nginx

## Estado

Implementada en el código actual.

## Contexto

El repositorio muestra publicación de frontend estático en edge y uso de dominio de assets, pero los uploads operativos del producto siguen otro camino.

## Decisión

Mantener en la implementación actual un storage local servido por Nginx para `/uploads`.

## Consecuencias

- simplifica la implementación inicial
- evita introducir otra capa de integración para uploads
- añade carga operativa y de escalado
- obliga a distinguir claramente uploads operativos y assets estáticos
