# Runbook — Activación y rotación de IndexNow (PROD)

> Estado: VIGENTE
> Fecha: 2026-08-30
> Vigencia esperada: indefinida
> Reemplaza: N/A (documento nuevo)
> Ver también: [ADR-062](../../06-decisions/adr-062-indexnow-notificacion-activa-de-urls.md), [ADR-033](../../06-decisions/adr-033-noindex-non-prod-environments.md), [ADR-015](../../06-decisions/adr-015-canonical-domains-per-environment.md)

Procedimiento para encender la notificación automática a IndexNow en PROD, y para rotar la clave. La decisión y su porqué viven en [ADR-062](../../06-decisions/adr-062-indexnow-notificacion-activa-de-urls.md); aquí solo está el cómo.

**Solo aplica a PROD.** TEST y AUDIT no notifican nunca por diseño (ADR-033): si esos entornos no deben indexarse, menos aún pedir que se les rastree. El código lo impide por sí solo mediante el gate `isProdApex()`, así que no hay nada que desactivar en ellos.

## Qué hay que entender antes de tocar nada

La clave de IndexNow **no es un secreto**. Se publica a propósito en el dominio: su única función es demostrar que quien notifica controla el sitio. Puede aparecer en logs y en `config.env` sin problema. Lo que sí es, es **configuración por entorno**, así que no vive en el repositorio.

Hay dos formas de servir el fichero de clave y conviene no confundirlas:

| Vía | Cuándo | Riesgo |
|---|---|---|
| **Objeto en S3** (lo que hace el script del paso A) | Siembra inicial, antes de que exista el backend | La raíz del bucket es el destino del sync de despliegue de frontend. Si algún día ese sync corriera con `--delete`, la clave desaparecería y **todos los envíos pasarían a fallar en silencio** |
| **Servida por backend** (`IndexNowKeyController`) | Estado objetivo | Ninguno de los anteriores, pero **exige una cache behavior en CloudFront** |

El fallo silencioso merece explicación porque ya nos pasó con las landings: la distribución tiene un Custom Error Response que convierte el 403 de S3 en `200` + shell SPA. Si el fichero de clave desaparece, la URL **no devuelve 404**: devuelve `200` con HTML. IndexNow responde entonces `403` y descarta el lote, sin que nada en el sistema lo delate.

## Activación (una vez)

### 1. Cache behavior en CloudFront — **bloqueante**

Sin este paso el controller nunca se ejecuta: la petición cae al bucket y la clave sigue sirviéndose como objeto de S3, con el riesgo de la tabla anterior.

En la distribución de PROD, añadir una *cache behavior* con:

- **Path pattern**: `/<clave>.txt` (el nombre real del fichero).
- **Origin**: el mismo del backend que ya usan `/sitemap.xml` y `/robots.txt`.
- **Precedencia**: por delante del comportamiento por defecto (el que apunta al bucket).
- **Métodos**: `GET`, `HEAD`.

Es un cambio de infraestructura sobre PROD: requiere autorización explícita del operador.

> **Ojo al rotar la clave**: el path pattern lleva el nombre del fichero, así que cambiar la clave obliga a actualizar también esta behavior. Ver la sección de rotación.

### 2. Variables en `config.env` de PROD

```
SEO_INDEXNOW_ENABLED=true
SEO_INDEXNOW_KEY=<la clave>
```

Higiene obligatoria al tocar `config.env` (ver [access-and-tooling.md](../access-and-tooling.md)):

- Backup previo del fichero.
- **Nunca comentarios en línea**: `KEY=valor # comentario` deja el `#...` dentro del valor porque systemd carga el fichero como `EnvironmentFile`, no lo interpreta bash. Eso ya tumbó PROD una vez. Solo comentarios de línea completa.
- Preservar ownership y modo canónicos.

### 3. Reiniciar el backend

```bash
sudo systemctl restart sharemechat-prod.service
```

### 4. Verificar

```bash
curl -i https://sharemechat.com/<clave>.txt
```

Esperado: `200`, `Content-Type: text/plain`, y **el cuerpo es exactamente la clave**. Comprobar el cuerpo, no solo el status: por el Custom Error Response, un fichero ausente devuelve `200` con HTML.

Para confirmar que sirve el **backend** y no el bucket, el `Cache-Control` debe ser `public, max-age=3600` (el que emite el controller).

### 5. Envío de prueba

Publicar un artículo desde el backoffice y comprobar en el journal del backend:

```bash
sudo journalctl -u sharemechat-prod.service --since "5 min ago" | grep INDEXNOW
```

Esperado: `[INDEXNOW] enviadas N URL(s), HTTP 200` (o `202`). Si aparece `omitido:`, el mensaje dice cuál de las cuatro guardas cortó (capa apagada, entorno no apex, sin clave válida, lista vacía).

Alternativa sin publicar nada: `POST /api/admin/content/indexnow/resubmit` desde el backoffice (requiere `CONTENT.PUBLISH`), que reenvía el catálogo entero y devuelve el resultado en la respuesta.

## Rotación de la clave

Solo hace falta si la clave se corrompe o se quiere cambiar. No caduca.

1. Generar la nueva clave (32 hex sirve):
   ```powershell
   -join ((1..16) | ForEach-Object { '{0:x2}' -f (Get-Random -Max 256) })
   ```
2. Publicar la nueva **antes** de retirar la vieja, con el script del paso A:
   ```powershell
   .\ops\scripts\indexnow-submit-prod.ps1 -Key "<nueva>" -UploadKeyFile
   ```
3. Actualizar el path pattern de la cache behavior de CloudFront al nuevo nombre.
4. Actualizar `SEO_INDEXNOW_KEY` en `config.env` y reiniciar el backend.
5. Verificar (paso 4 de la activación) y solo entonces borrar el objeto viejo del bucket, si lo hubiera.

## Desactivación

```
SEO_INDEXNOW_ENABLED=false
```
y reiniciar. **No hace falta retirar el fichero de clave**: el controller lo sigue sirviendo aunque el envío esté apagado, y es deliberado — si se apagase la acreditación de propiedad, al reactivar habría que esperar de nuevo a que el buscador revalidase el dominio. Hay un test que fija ese comportamiento.

## Verificación de que está funcionando de verdad

IndexNow confirma **recepción**, no indexación. Un `200` o `202` significa que el aviso llegó, nada más.

La métrica de cierre de este frente no es el código de respuesta: es que **Bing Webmaster Tools deje de marcar 0 impresiones**. Comprobar a las 24-72 horas en *URL Inspection* o *Site Explorer*.

## Síntomas y causa

| Síntoma | Causa probable |
|---|---|
| `curl` de la clave devuelve `200` pero con HTML | El fichero no lo sirve nadie: falta la cache behavior **y** falta el objeto en S3. El CER está devolviendo el shell SPA |
| `curl` devuelve la clave pero con `Cache-Control` distinto de `max-age=3600` | Lo está sirviendo el bucket, no el backend: falta la cache behavior |
| Log `omitido: el entorno no es el apex PROD` | `app.public.base-url` no es exactamente `https://sharemechat.com` |
| Log `omitido: sin clave valida` | `SEO_INDEXNOW_KEY` ausente, o no cumple 8-128 caracteres `[a-zA-Z0-9-]` |
| Envío responde `403` | La clave que se envía no coincide con la que se sirve en el dominio |
| Envío responde `422` | Alguna URL no pertenece al host. El servicio ya filtra, así que revisar `app.public.base-url` |
| Envío responde `429` | Exceso de envíos. Esperar; el volumen editorial normal está muy lejos del umbral |
