# Archivo inmutable de documentos de compliance (accountability)

Copias PDF inmutables de los documentos **internos de accountability** (no públicos):
DPIA, y otros que se añadan. Distinto de `../model_contract/` y `../master_contract/`,
que son contratos que un usuario acepta.

## Dónde vive cada cosa

| Capa | Sitio | Rol |
|---|---|---|
| **Fuente autoritativa** | `docs/01-business/*.md` (repo, versionado en git) | El documento vivo. Manda. Git da el historial de accountability (Art. 5(2) GDPR). |
| **Copia inmutable** | esta carpeta (`ops/legal-history/compliance/`) | Reproducibilidad exacta del PDF entregado; no se sobrescribe ni se borra. |
| **Copia entregable** | bucket **PRIVADO** `sharemechat-content-private-<env>/compliance/` | La que se entrega a un regulador / PSP en due diligence, **on request**. |

**NUNCA** en el bucket público `assets-*/legal/` (ese es para documentos que el público descarga:
contratos servidos por manifest). Un documento interno de accountability no se publica.

## Convención de nombres

`<familia>_v<n>_<YYYY-MM-DD>.pdf`, idéntico al nombre subido al bucket privado.

Ejemplo: `dpia_biometric_v1_2026-08-31.pdf`.

## Reglas

1. No se sobrescribe ni se borra un fichero existente (misma regla que `../README.md`).
2. El PDF se regenera desde `ops/legal-pdfs/generate_dpia_pdf.py` (fuente: la `.md` del repo).
3. Al subir a un entorno nuevo, verificar que el sha256 del bucket coincide con el de esta copia.

## Inventario

| Documento | Versión | Fuente `.md` | sha256 |
|---|---|---|---|
| DPIA — verificación biométrica edad/identidad | v1 · 2026-08-31 | [`dpia-biometric-age-verification.md`](../../../docs/01-business/dpia-biometric-age-verification.md) | `9ee25ac9bb65d32c999259653aca554dd5ba63cb5f7a96c5e85021e60e09d9a4` |
