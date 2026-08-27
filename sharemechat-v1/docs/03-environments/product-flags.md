# Flags operativas de producto — referencia

Catálogo de las flags `product.*` del backend: qué existe, su variable de entorno
y su valor por defecto. **Generado** desde la fuente única
[`docs/_data/product-flags.yaml`](../_data/product-flags.yaml) y anclado a
`src/main/resources/application.properties` por un test (ADR-061). Los **valores
por entorno** (TEST/AUDIT/PROD) viven en el `config.env` de cada caja, fuera de
git; aquí solo están el catálogo y los defaults.

<!-- BEGIN generated:product-flags renderer=flags-table (no editar a mano; fuente docs/_data/product-flags.yaml) -->
| Property | Variable de entorno | Default | Qué hace |
|---|---|---|---|
| `product.access.mode` | `PRODUCT_ACCESS_MODE` | `OPEN` | Modo operativo global del producto (OPEN / PRELAUNCH / MAINTENANCE / CLOSED). Ver product-modes. |
| `product.access.allowlist.user-ids` | `PRODUCT_ACCESS_ALLOWLIST_USER_IDS` | *(vacío)* | Lista de userId (coma-separados) que saltan el gate en modos restrictivos. Vacío = nadie. |
| `product.registration.client.enabled` | `PRODUCT_REGISTRATION_CLIENT_ENABLED` | `true` | Habilita el registro público de cliente (POST /api/users/register/client). |
| `product.registration.model.enabled` | `PRODUCT_REGISTRATION_MODEL_ENABLED` | `true` | Habilita el registro público de modelo (POST /api/users/register/model). |
| `product.promo.welcome.enabled` | `PRODUCT_PROMO_WELCOME_ENABLED` | `false` | Activa la promo de bienvenida (bono a los primeros clientes). |
| `product.promo.welcome.cap` | `PRODUCT_PROMO_WELCOME_CAP` | `100` | Número máximo de clientes que reciben la promo de bienvenida. |
| `product.promo.welcome.amount-eur` | `PRODUCT_PROMO_WELCOME_AMOUNT_EUR` | `10.00` | Importe en euros del bono de bienvenida. |
| `product.promo.welcome.promo-key` | `PRODUCT_PROMO_WELCOME_PROMO_KEY` | `WELCOME_100` | Clave interna que identifica la promo de bienvenida. |
| `product.simulation.transactions-direct.enabled` | `PRODUCT_SIMULATION_TRANSACTIONS_DIRECT_ENABLED` | `false` | Habilita los endpoints directos de simulación económica (/api/transactions/first, /add-balance). Se cierran por entorno sin tocar payout ni webhooks. |
| `product.golive.model.enabled` | `PRODUCT_GOLIVE_MODEL_ENABLED` | `false` | Coming-soon modelo. Si false, la modelo ve la plataforma pero no puede empezar a emitir. |
| `product.golive.client.enabled` | `PRODUCT_GOLIVE_CLIENT_ENABLED` | `false` | Coming-soon cliente. Si false, el cliente ve la plataforma pero no puede entrar a videochat/trial. |
<!-- END generated:product-flags -->

Notas:

- El **modo** (`product.access.mode`) y su detalle por rol se explican en
  [ADR-009](../06-decisions/adr-009-product-operational-mode.md); los significados
  de cada modo están en [`docs/_data/product-modes.yaml`](../_data/product-modes.yaml).
- Las flags `product.golive.*` controlan el coming-soon (ver la plataforma vs poder
  emitir/entrar a videochat), independientes del modo de acceso.
