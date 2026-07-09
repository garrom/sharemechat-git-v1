# Registro de contenido documental retirado

> Estado: VIGENTE
> Fecha: 2026-07-09
> Vigencia esperada: indefinida
> Reemplaza: N/A
> Ver también: `documentation-governance.md` § "Patrón de deprecados centralizados"

## Propósito

Registro histórico de contenido documental retirado. Preserva el rastro de decisiones y contenido superseded sin contaminar la lectura de los ficheros vigentes.

## Cómo usar este registro

Cuando se retira una sección de un fichero vigente, el contenido histórico se mueve aquí bajo un heading con el formato:

```
## [fichero-origen.md] §"nombre sección"

> Retirado: YYYY-MM-DD
> Motivo: [ADR de referencia u otra razón]
> Origen exacto: docs/ruta/al/fichero.md § "nombre sección exacto"

[contenido íntegro retirado, sin modificación]
```

En el fichero de origen queda solo un bloque de referencia con el formato canónico documentado en `documentation-governance.md`:

```
> ⚠️ SECCIÓN RETIRADA
> Contenido histórico movido a: _deprecated/registro.md §"[nombre sección]"
> Motivo: [ADR de referencia u otra razón]
> Fecha retirada: [YYYY-MM-DD]
```

Este registro no se edita retroactivamente: las entradas pasadas no se reescriben ni se borran. Si una decisión que motivó una retirada se revierte, se añade una entrada nueva que documenta el retorno.

Orden de las entradas: cronológico inverso estricto (más reciente arriba, justo después de este bloque de introducción).

## Entradas

_Vacío por ahora. Se poblará conforme se ejecute la Fase B del pivote de soft launch (retirada de menciones a "Segpay como vía activa" en los ficheros que contienen esa premisa)._
