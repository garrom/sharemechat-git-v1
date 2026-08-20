#!/usr/bin/env node
// i18n-sync — rellena los locales de UI faltantes por traducción máquina.
//
// Proyecto: docs/07-roadmap/i18n-language-redesign-plan.md (Fase 1, punto delicado #5).
//
// Qué hace:
//   - Toma un locale FUENTE (por defecto es.json) como fuente de verdad de CLAVES.
//   - Para cada locale DESTINO (fr, de, …), reconstruye su JSON espejando la
//     estructura de la fuente: cada cadena = valor ya existente (revisado) si lo
//     hay, o traducción máquina (Google Cloud Translation v2) si falta.
//   - Protege los placeholders de i18next ({{var}}) y los tags (<1>…) para que el
//     traductor no los rompa.
//   - Con --force retraduce TODO (ignora lo existente).
//
// NO commitea ni despliega; solo escribe los .json. El operador revisa el diff.
//
// Uso:
//   TRANSLATION_GOOGLE_API_KEY=xxx node scripts/i18n-sync.mjs [--source es]
//        [--targets fr,de] [--force] [--dry]
//   (misma variable de entorno que el backend: TRANSLATION_GOOGLE_API_KEY;
//    también acepta GOOGLE_API_KEY.)

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = path.resolve(__dirname, '../src/i18n/locales');
const ENDPOINT_HOST = 'translation.googleapis.com';
const ENDPOINT_PATH = '/language/translate/v2';
const BATCH = 100;

function parseArgs(argv) {
  const out = { source: 'es', targets: ['fr', 'de'], force: false, dry: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--source') out.source = argv[++i];
    else if (a === '--targets') out.targets = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--force') out.force = true;
    else if (a === '--dry') out.dry = true;
  }
  return out;
}

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const exists = (p) => { try { fs.accessSync(p); return true; } catch { return false; } };

// Protege {{placeholders}} y <tags> con centinelas de área privada Unicode
// (U+E000 … índice … U+E001). Se usan estos code points (no dígitos pelados)
// para que el marcador NO colisione con números reales del texto ("18 años",
// "500.000"): restore() solo reemplaza el patrón centinela, nunca un número
// legítimo. Google Cloud Translate preserva estos code points.
const S_OPEN = '';
const S_CLOSE = '';
const RESTORE_RE = new RegExp(S_OPEN + '(\\d+)' + S_CLOSE, 'g');

function protect(str) {
  const tokens = [];
  const masked = str.replace(/(\{\{[^}]*\}\}|<[^>]+>)/g, (m) => {
    const idx = tokens.push(m) - 1;
    return S_OPEN + idx + S_CLOSE;
  });
  return { masked, tokens };
}
function restore(str, tokens) {
  return str.replace(RESTORE_RE, (_, i) => (tokens[Number(i)] !== undefined ? tokens[Number(i)] : ''));
}

// Conjunto (ordenado) de placeholders/tags de una cadena, para comparar que la
// traducción los conserve exactamente.
function placeholderSet(s) {
  return (String(s).match(/(\{\{[^}]*\}\}|<[^>]+>)/g) || []).slice().sort().join('|');
}
function samePlaceholders(a, b) {
  return placeholderSet(a) === placeholderSet(b);
}

function httpsPostJson(payload, apiKey) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request(
      {
        host: ENDPOINT_HOST,
        path: ENDPOINT_PATH + '?key=' + encodeURIComponent(apiKey),
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        timeout: 20000,
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error('HTTP ' + res.statusCode + ': ' + data.slice(0, 300)));
          }
          try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function translateBatch(strings, source, target, apiKey) {
  const masked = strings.map((s) => protect(s));
  const resp = await httpsPostJson(
    { q: masked.map((m) => m.masked), source, target, format: 'text' },
    apiKey
  );
  const translations = (resp && resp.data && resp.data.translations) || [];
  return translations.map((t, i) => {
    const out = restore(t.translatedText, masked[i].tokens);
    // Salvaguarda: si la traducción no conserva EXACTAMENTE los mismos
    // placeholders/tags que el original, se descarta y se mantiene el original
    // (mejor una cadena sin traducir —visible en la revisión— que una rota).
    return samePlaceholders(strings[i], out) ? out : strings[i];
  });
}

// Recorre la fuente y construye el destino con la MISMA estructura/orden.
// Recolecta las cadenas a traducir (missing o --force) con un "setter" para
// escribir el resultado luego.
function collect(sourceNode, targetNode, force, pending, setValue) {
  if (typeof sourceNode === 'string') {
    const existing = typeof targetNode === 'string' ? targetNode : undefined;
    if (!force && existing !== undefined) { setValue(existing); return; }
    if (sourceNode.trim() === '') { setValue(sourceNode); return; }
    pending.push({ text: sourceNode, setValue });
    return;
  }
  if (Array.isArray(sourceNode)) {
    const arr = [];
    setValue(arr);
    sourceNode.forEach((item, i) => {
      const tItem = Array.isArray(targetNode) ? targetNode[i] : undefined;
      collect(item, tItem, force, pending, (v) => { arr[i] = v; });
    });
    return;
  }
  if (sourceNode && typeof sourceNode === 'object') {
    const obj = {};
    setValue(obj);
    for (const key of Object.keys(sourceNode)) {
      const tChild = targetNode && typeof targetNode === 'object' ? targetNode[key] : undefined;
      collect(sourceNode[key], tChild, force, pending, (v) => { obj[key] = v; });
    }
    return;
  }
  setValue(sourceNode);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apiKey = process.env.TRANSLATION_GOOGLE_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) { console.error('ERROR: falta TRANSLATION_GOOGLE_API_KEY (o GOOGLE_API_KEY) en el entorno.'); process.exit(1); }

  const sourcePath = path.join(LOCALES_DIR, args.source + '.json');
  if (!exists(sourcePath)) { console.error('ERROR: no existe ' + sourcePath); process.exit(1); }
  const source = readJson(sourcePath);

  for (const target of args.targets) {
    const targetPath = path.join(LOCALES_DIR, target + '.json');
    const targetExisting = exists(targetPath) ? readJson(targetPath) : {};

    const root = {};
    const pending = [];
    collect(source, targetExisting, args.force, pending, (v) => { root.__ = v; });
    const result = root.__;

    console.log('[' + target + '] ' + pending.length + ' cadena(s) a traducir' + (args.force ? ' (--force)' : ' (faltantes)'));

    for (let i = 0; i < pending.length; i += BATCH) {
      const chunk = pending.slice(i, i + BATCH);
      const translated = await translateBatch(chunk.map((c) => c.text), args.source, target, apiKey);
      chunk.forEach((c, j) => c.setValue(translated[j] !== undefined ? translated[j] : c.text));
      console.log('  [' + target + '] ' + Math.min(i + BATCH, pending.length) + '/' + pending.length);
    }

    if (args.dry) { console.log('[' + target + '] --dry: no se escribe.'); continue; }
    fs.writeFileSync(targetPath, JSON.stringify(result, null, 2) + '\n', 'utf8');
    console.log('[' + target + '] escrito ' + path.relative(process.cwd(), targetPath));
  }
  console.log('Hecho. Revisa el diff antes de commitear.');
}

main().catch((e) => { console.error(e); process.exit(1); });
