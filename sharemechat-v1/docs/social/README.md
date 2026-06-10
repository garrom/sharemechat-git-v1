# Social-ops — pipeline de redes sociales (X / Reddit)

Sistema de Cowork para generar contenido y planes de publicación para X y Reddit respetando las reglas anti-baneo de cada plataforma. Es el gemelo social del pipeline editorial (`cms/`): mismo patrón de orquestador + agentes encadenados con contratos JSON, y reutiliza `sharemechat-voice`.

## Principio rector
Automatiza el pensar, no el publicar.
- **Cowork** = fábrica de contenido + compliance + plan.
- **Humano** = ejecución (publicar), conversación genuina, y persistir el ledger.
- **Motivo**: Reddit y X prohíben o limitan la automatización de acciones (votos, posteo scriptado, multicuenta); la cuenta es el activo que cuesta calentar. Por eso el sistema genera y comprueba, pero el humano postea.

## Contrato de entrada (4 campos)
| Campo | Valores |
|---|---|
| `plataforma` | `x` / `reddit` |
| `objetivo` | `calentamiento` / `aporte` / `recruit-modelos` / `promo` |
| `tema_o_angulo` | texto libre (o "reaprovecha el artículo X del blog") |
| `subreddit` | opcional, solo Reddit: el sub objetivo u `own` |

La `fase` no se introduce: la deriva el gate desde el ledger.

## Pipeline
| Paso | Skill | Entrada | Salida |
|---|---|---|---|
| — | `social-orchestrator` | contrato + ledger | resumen + salida del packager |
| 1 | `social-phase-gate` | contrato + ledger | `gate_decision` |
| 2 | `social-platform-rules` | `gate_decision` + sub | `platform_constraints` |
| 3 | `social-draft-writer` | gate + constraints + `sharemechat-voice` | `drafts` (ES) |
| 4 | `social-brand-legal-review` | `drafts` | `review` |
| 5 | `social-translate-en` | `review` | `drafts_en` |
| 6 | `social-packager` | todo + ledger | `plan` + `checklist_humano` + `social_state_next` |

## El ledger (`social-state.json`)
- Vive en `docs/social/social-state.json`.
- Cowork no tiene memoria entre sesiones: el ledger se inyecta al inicio y el `social-packager` devuelve `social_state_next`.
- El humano lo guarda DESPUÉS de publicar (es la fuente de verdad de lo que se posteó) y mantiene a mano las métricas (karma, followers) y las reglas curadas de cada sub.
- Rastrea por plataforma: fase, métricas, ratio (X global, Reddit por sub) y las entradas de subreddits con su `promo_policy` y mínimos.

## Fases y umbrales
- **Reddit**: `warmup` → `building` (edad >=7d y comment_karma >=20) → `promo-allowed` (edad >=21d y karma total >=50). Ratio 10% por sub.
- **X**: `warmup` → `promo-allowed` (edad >=7d y >=5 aportes). Ratio 25% global.
- Manda siempre el criterio más estricto entre la fase global y los mínimos del sub.

## Cómo se ejecuta
1. Rellena los 4 campos del contrato (el script prompt-builder arma el prompt).
2. Abre una sesión nueva de Cowork e invoca `social-orchestrator` con el contrato + el ledger inyectado.
3. Recibes: resumen + plan + checklist humano + `social_state_next`.
4. Publicas a mano siguiendo el checklist.
5. Tras publicar, guardas `social_state_next` (ajustando si publicaste otra variante o nada) y actualizas las métricas de la cuenta.

## Relación con el blog
Mismo patrón que el pipeline editorial (`cms-orchestrator` + agentes), reutiliza `sharemechat-voice` y comparte la salida bilingüe ES+EN sin opt-out. Diferencia clave: el blog produce un artefacto que se persiste y se renderiza en el producto; social produce un plan que ejecuta un humano fuera del producto.
