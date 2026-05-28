# Generador de PDFs legales

`generate_legal_pdfs.py` genera los documentos legales del proyecto en PDF (contrato de modelo `model_contract.pdf` y derivados versionados).

## FUENTE ÚNICA

Este script es **fuente única no respaldada en ningún recurso vivo**. Hasta el 2026-05-27 vivía suelto en la raíz del repositorio sin versionar; se rescató aquí durante la higiene del directorio raíz. A diferencia de los dumps de CloudFront o los snapshots, **su contenido no se puede recuperar de ningún servicio AWS**: si se pierde, se pierde la capacidad de regenerar los PDFs legales.

## Dónde están desplegados los PDFs generados

Los PDFs producidos por este script se sirven desde los buckets de assets por entorno, bajo el prefijo `legal/`:

- PROD: `assets-sharemechat-prod/legal/`
- AUDIT: `assets-sharemechat-audit/legal/`
- TEST: `assets-sharemechat-test1/legal/`

Versión vigente del contrato de modelo al cierre del frente PRO: `model_contract_v4_2026-03-23`, servido como `legal/model_contract.pdf` con SHA-256 `783A747136951B848649A984A622A8A50E62B3538DDEE369257B2825B9B37B7B` (159368 bytes). Histórico conservado en `legal/history/` (`model_contract_v2_2026-03-08.pdf`, `model_contract_v4_2026-03-23.pdf`). El manifest `legal/model_contract.manifest.json` describe versión, sha256 y URL pública por entorno.

El backend resuelve la URL del contrato vigente vía `GET /api/consent/model-contract/current`, que lee el manifest del bucket de assets del entorno correspondiente.

## Uso

Revisar las dependencias Python del script antes de ejecutar. Tras regenerar un PDF, subirlo al bucket `assets-sharemechat-<env>/legal/` y actualizar el manifest correspondiente; invalidar la distribución CloudFront de assets si aplica.
