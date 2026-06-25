# Runbook — Subida de hero image de artículo del blog a S3 PROD

> Operación recurrente del pipeline editorial: cada artículo nuevo del blog necesita su hero image servida desde `assets.sharemechat.com`. Tiempo estimado: 5-10 min por imagen.

## Convenciones (fuente de verdad operativa)

Observadas en `s3://assets-sharemechat-prod/blog/` al 2026-06-24 y validadas con `head-object` sobre todos los heros existentes.

| Aspecto | Valor |
|---|---|
| Bucket | `assets-sharemechat-prod` (PROD) |
| Path canónico | `s3://assets-sharemechat-prod/blog/<slug>.webp` (raíz de `/blog/`) |
| Dominio público | `https://assets.sharemechat.com/blog/<slug>.webp` |
| Distribución CloudFront | `assets_canonical` PROD (logical name; ID real en `~/.sharemechat/state-mapping.yaml`) |
| Dimensiones target | **1672 × 941** (16:9). Patrón consistente desde 2026-06-07. Dos outliers del batch del 7-jun (1535×1024, 1168×784) se ignoran. |
| Formato | WebP |
| Content-Type | `image/webp` |
| Cache-Control | `public, max-age=31536000, immutable` |
| SSE | AES256 (lo aplica el bucket por default, no hay que pasar flag) |
| Encoding | VP8 (lossy) o VP8X (extended) — Pillow exporta VP8X por default, ambos válidos |
| Tamaño típico | 80-130 KB |

**El subdirectorio `/blog/hero/` NO es para los heros por artículo.** Aloja un único hero genérico del listing (`blog_hero_v1.webp`, 1400×731). El hero por artículo va directamente a la raíz de `/blog/`.

## Procedimiento

### 1. Recibir el fichero

Si la sesión tiene acceso al escritorio del operador (ruta de `Sharemechat_Aplicaciones/DESIGN_PAGE/IMAGEN_IA/blog/`), copiar directamente con `cp` desde esa ruta. Si no, el operador copia a la zona de paso `sharemechat-v1/ops/uploads-pending/blog/` (el `.gitignore` de `uploads-pending/` impide que el `.webp` entre al repo).

### 2. Verificar dimensiones

```powershell
python -c "from PIL import Image; im=Image.open('<ruta>.webp'); print(im.size, im.mode, im.format)"
```

Debe devolver `(1672, 941) RGB WEBP`. Si no coincide, redimensionar con Pillow conservando aspect ratio si es posible:

```python
from PIL import Image
im = Image.open('input.webp')
im.resize((1672, 941), Image.LANCZOS).save('output.webp', 'WEBP', quality=82)
```

### 3. Calcular sha256 (auditable)

```powershell
python -c "import hashlib; print(hashlib.sha256(open('<ruta>.webp','rb').read()).hexdigest())"
```

### 4. Subir a S3

```powershell
aws s3 cp <ruta>.webp s3://assets-sharemechat-prod/blog/<slug>.webp `
  --content-type image/webp `
  --cache-control "public, max-age=31536000, immutable"
```

Verificar metadata:

```powershell
aws s3api head-object --bucket assets-sharemechat-prod --key blog/<slug>.webp
```

Debe mostrar `ContentType: image/webp`, `CacheControl: public, max-age=31536000, immutable`, `ServerSideEncryption: AES256`.

### 5. Invalidar CloudFront — usar PowerShell, NO bash

**Importante**: `aws cloudfront create-invalidation` con `--paths "/blog/foo.webp"` falla desde Git Bash en Windows con `InvalidArgument: invalid invalidation paths` por mal quoting del shell. **Ejecutar siempre desde PowerShell**:

```powershell
$distId='<ID assets_canonical PROD>'   # leer de state-mapping.yaml
aws cloudfront create-invalidation --distribution-id $distId --paths "/blog/<slug>.webp" --output json
```

Path acotado al fichero concreto. NO usar `/blog/*` (invalida también pre-render HTMLs del blog y consume cuota innecesariamente).

Pollear hasta `Status: Completed` (típicamente 10-30 s):

```powershell
$invId='<id devuelto>'
do { Start-Sleep -Seconds 10; $s=(aws cloudfront get-invalidation --distribution-id $distId --id $invId --output json | ConvertFrom-Json).Invalidation.Status; $s } while ($s -ne 'Completed')
```

### 6. Verificación final pública

```powershell
curl.exe -sI https://assets.sharemechat.com/blog/<slug>.webp
```

Debe devolver `HTTP/1.1 200 OK`, `Content-Type: image/webp`, `Cache-Control: public, max-age=31536000, immutable`, `Content-Length` igual al fichero local. Tras la invalidación se ve `X-Cache: Miss from cloudfront` en el primer hit (esperado).

### 7. Limpieza

Borrar el fichero de `sharemechat-v1/ops/uploads-pending/blog/`. No commitear nada (el `.gitignore` lo cubre).

## Notas operativas

- **`Cache-Control: immutable`** implica que cualquier reedición del hero debe invalidar CF sí o sí (o cambiar el nombre del fichero). Para artículos en producción, preferir cambiar el nombre (`<slug>-v2.webp`) y actualizar `article.heroImageUrl` en BD, no sobrescribir.
- **Comilla curva en EXIF**: imágenes exportadas desde GIMP llevan EXIF + ICC sRGB. No se strippea — añade ~3 KB pero asegura color consistente cross-device. Si se quiere optimizar, `cwebp -metadata none` o `Image.save(..., exif=b'')` con Pillow.
- **Vincular con el artículo**: tras subir, asegurarse de que el `ContentArticleEditor` apunta a la URL canónica en `heroImageUrl`. El render del blog usa este campo para `og:image` con dimensiones omitidas (ver [seo-prompt3-implementation-2026-06-23.md](../seo-prompt3-implementation-2026-06-23.md) sección B).

## Histórico

- 2026-06-24: primer uso documentado (`alternativas-omegle-2026.webp`, invalidación `I8ZO82TNMXDEVAINYGV2XZJFF5`). Convenciones extraídas observando los 5 heros existentes en ese momento.
