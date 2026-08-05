-- V48 — users.password pasa a NULLABLE para permitir cuentas Google-only
--
-- Contexto: con "Sign in with Google" (V47) un usuario CLIENT puede crear
-- cuenta y loguearse sin haber definido nunca password. Hasta ahora la
-- columna users.password era NOT NULL (see V1 baseline); esta migration
-- la hace NULLABLE.
--
-- Efecto: para saber si un user tiene password activo -> password IS NOT NULL.
-- Es la fuente autoritativa (no se anade una columna password_set_at
-- redundante). Los users creados via /api/users/register/{client,model} y
-- via /api/masters/register siguen teniendo password requerido en su flujo
-- de negocio; la nullability afecta solo al camino Google.
--
-- Los users pre-V48 tienen password poblado; ninguno queda NULL por esta
-- migration. Solo abre la puerta a users nuevos con password=NULL.

ALTER TABLE users
    MODIFY COLUMN password VARCHAR(255) NULL;
