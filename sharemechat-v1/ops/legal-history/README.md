# Histórico inmutable de PDFs legales versionados

Esta carpeta es el **archivo autoritativo** del texto exacto de cada versión publicada de los documentos legales del proyecto, principalmente el Model Collaboration Agreement.

## Por qué existe

Los PDFs vivos se sirven desde los buckets de assets por entorno (`assets-sharemechat-{prod,audit,test1}/legal/model_contract.pdf`) bajo URL fija no versionada. Cuando se publica una versión nueva, el bucket sobrescribe el PDF anterior. Los buckets de assets **no tienen versionado S3 activado** (verificado 2026-06-03), lo que significa que el PDF antiguo desaparece físicamente del bucket en cuanto sube el nuevo.

Como la tabla `model_contract_acceptances` guarda únicamente el `sha256` del PDF aceptado (no el texto en sí), sin esta carpeta sería imposible reproducir el texto exacto que aceptó una modelo en una versión concreta. El sha256 permite **verificar** un PDF entregado externamente, pero no **reconstruir** el contenido por sí mismo.

Esta carpeta cierra ese agujero: cada versión publicada queda commiteada en git como copia inmutable, con autor, timestamp y diff disponibles para auditoría legal.

## Convención de nombres

Una carpeta por familia de documento. Dentro, un fichero por versión publicada, nombrado como sigue:

```
ops/legal-history/model_contract/{version_id}.pdf
```

Donde `{version_id}` debe coincidir EXACTAMENTE con el campo `version` que se publica en `model_contract.manifest.json`. Ese campo cumple el patrón regex que valida `ModelContractManifestService`:

```
model_contract_v\d+_\d{4}-\d{2}-\d{2}
```

Ejemplos:

- `ops/legal-history/model_contract/model_contract_v2_2026-03-08.pdf`
- `ops/legal-history/model_contract/model_contract_v4_2026-03-23.pdf`
- (al publicar v4.2:) `ops/legal-history/model_contract/model_contract_v42_YYYY-MM-DD.pdf`

## Reglas operativas

1. **NUNCA se sobrescribe un fichero existente**. Cada versión publicada queda commited tal cual.
2. **NUNCA se borra un fichero existente** sin documentar la razón en `docs/04-operations/incident-notes.md`.
3. **El nombre del fichero debe ser idéntico a la `version` del manifest**, no a la del bucket. Si el bucket conserva alguna copia con otro nombre (por ejemplo `legal/history/`), la fuente autoritativa es la copia en este repo.
4. **El sha256 del PDF en disco debe coincidir con el sha256 publicado en el manifest** de esa versión. Verificable con:
   ```
   sha256sum -bA ops/legal-history/model_contract/<version_id>.pdf
   ```
5. **Una sola familia de documentos por subcarpeta**. Si en el futuro hay otros documentos legales versionados con la misma política (e.g. ToS firmados, NDA con partners), van como subcarpetas hermanas.

## Procedimiento de publicación de una versión nueva

Cada vez que se publica una versión nueva del Model Collaboration Agreement (por ejemplo, v4.2):

1. Generar el PDF nuevo (proceso documentado en `ops/legal-pdfs/README.md`).
2. **Antes** de subir nada a S3, commitear la copia en este histórico:
   ```
   cp <pdf_generado> ops/legal-history/model_contract/<version_id>.pdf
   git add ops/legal-history/model_contract/<version_id>.pdf
   git commit -m "legal(history): archive model_contract <version_id>"
   ```
3. Subir el PDF al bucket `assets-sharemechat-<env>/legal/model_contract.pdf` (sobrescribe el anterior).
4. Actualizar el manifest `assets-sharemechat-<env>/legal/model_contract.manifest.json` con `{version, sha256, url}` de la nueva versión.
5. Invalidar CloudFront de assets si aplica.
6. El backend, al recibir el primer request a `getCurrent()` tras el cambio, descargará el nuevo PDF y verificará que su sha256 real coincide con el publicado en el manifest (mecanismo introducido en el mismo lote de endurecimiento). Si no coincide, fallará seguro y no servirá la versión.

## Relación con `ops/legal-pdfs/`

`ops/legal-pdfs/` contiene el **generador** de los PDFs (script `generate_legal_pdfs.py`). Esta carpeta (`ops/legal-history/`) contiene los **artefactos publicados** versionados. Los dos son complementarios:

- Si se pierde `ops/legal-pdfs/`, no se pueden regenerar futuras versiones, pero las publicadas previamente siguen accesibles aquí.
- Si se pierde `ops/legal-history/`, las versiones publicadas previamente solo sobreviven mientras estén en los buckets S3 (sin versionado activado, esto significa "hasta que se publique la siguiente versión").

Mantener ambas carpetas commited es la garantía mínima de continuidad legal-documental.
