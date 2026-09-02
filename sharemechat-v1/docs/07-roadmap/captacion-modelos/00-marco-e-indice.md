# Captación de modelos — análisis maestro (2026-09-02)

> **Borrador de investigación, NO un ADR ni una decisión.** Sienta las bases del
> frente de captación de modelos. Material de referencia para el
> [debate de arranque](../debate-arranque.md). Se construye con varios agentes
> en paralelo, cada uno persistiendo en su fichero (ver §Arquitectura).

## La decisión que sirve todo esto

De qué países, por qué canal y con qué idioma puede SharemeChat captar operadoras
de forma **legal, viable y escalable** para un producto de match aleatorio 1-a-1
de pago (tipo CooMeet), con verificación de identidad obligatoria y pago cripto.

## El marco: 1 filtro bloqueante + atributos informativos

- **Bloqueante (lo único que descarta un país): la LEGALIDAD.** Que producir
  contenido adulto de pago NO sea delito para la adulta voluntaria (letra de la
  ley + aplicación real). Legal = candidato. Ilegal = fuera. Binario.
- **Informativo (describe, no descarta):** idioma, pago, canales de
  reclutamiento, riesgo de trata. No deciden *si se puede*, solo *cómo de fácil/
  atractivo* es un país que ya es legal. El KYC obligatorio de la plataforma
  gestiona la parte de verificación individual (edad, identidad, voluntariedad).

## Universo a investigar

**Países (~47).** Excluidos de entrada por sanciones/embargo: Rusia, Bielorrusia, Cuba.

- **LatAm:** Colombia, Venezuela, Perú, Bolivia, Ecuador, Paraguay, Brasil, México, Rep. Dominicana, Argentina, Chile, Guatemala.
- **Europa Este / Balcanes / ex-URSS:** Rumanía, Ucrania, Moldavia, Serbia, Bulgaria, Albania, Macedonia del N., Bosnia, Hungría, Georgia, Letonia, Lituania, Kazajistán.
- **África:** Madagascar, Costa de Marfil, Camerún, Senegal, RD Congo, Kenia, Nigeria, Ghana, Uganda, Sudáfrica, Marruecos.
- **Índico francófono:** Reunión (territorio francés → ley francesa), Mauricio.
- **Asia:** Filipinas, India, Indonesia, Vietnam, Tailandia, Nepal, Bangladés, Sri Lanka.

**Plataformas (10):** OnlyFans, LiveJasmin, Chaturbate, Stripchat, BongaCams (cam
clásico) + CooMeet, LuckyCrush, Chatspin, Chatrandom, Camsurf (match aleatorio =
espejo del producto).

## Índice / ficheros

| # | Contenido | Fichero | Autor |
|---|---|---|---|
| 0 | Marco e índice (este documento) | `00-marco-e-indice.md` | — |
| 1 | **Legalidad por país** (el filtro) | `A1-legalidad.md` | Agente A1 |
| 2 | Origen de modelos por plataforma | `A2-plataformas.md` | Agente A2 |
| 3 | Rails de pago por país | `A3-pago.md` | Agente A3 |
| 4 | Canales de reclutamiento por geografía | `A4-canales.md` | Agente A4 |
| 5 | Riesgo de trata por geografía | `A5-riesgo.md` | Agente A5 |
| 6 | Cruce: shortlist de países legales + ficha informativa | `A6-cruce-shortlist.md` | Agente A6 |
| 7 | Limpieza y sanity-check | `A7-sanity.md` | Agente A7 |
| 8 | Recomendación + qué no se verificó | `09-recomendacion.md` | operador local |

*(El idioma cliente↔operadora, punto informativo, lo rellena A6 como columna de la
ficha; no lleva agente propio por ser derivable.)*

Insumo previo (versiones más superficiales, ya en la rama): [anexo países](../debate-arranque-research-paises.md), [anexo plataformas](../debate-arranque-research-plataformas.md). Esta carpeta es la versión profunda y organizada que los supersede.

## Regla de profundidad (todos los agentes)

≥2-3 fuentes independientes por dato clave; abrir la fuente primaria cuando
exista (código penal, informe TIP, reportaje); **etiquetar dato duro vs
impresión**; y listar explícitamente lo no verificado.

## Arquitectura de agentes y persistencia

- **Fase 1 (paralelo):** A1–A5. Cada uno **escribe su fichero de forma
  incremental** (crea la estructura al empezar y rellena bloque a bloque), para
  que nada se pierda si se interrumpe.
- **Fase 2:** A6 **lee** A1–A5 y produce la shortlist + ficha.
- **Fase 3:** A7 **lee** todo y produce el sanity-check.
- **Cierre:** el operador local (yo) escribe la recomendación.

Los commits de estos ficheros los hace la sesión principal (no los agentes) para
evitar carreras de git; los agentes solo escriben contenido.
