#!/usr/bin/env node
/*
 * Pre-render selectivo del blog SharemeChat.
 *
 * Lanza Puppeteer contra https://sharemechat.com (o el hostname pasado en
 * el config), visita cada URL del blog, espera a que la SPA hidrate y los
 * meta tags se hayan aplicado (marcador body[data-blog-hydrated="true"]
 * con fallback title+canonical), captura el HTML final y lo escribe en
 * disco bajo outDir/<url>/index.html.
 *
 * El script PowerShell orquestador (prerender-blog-prod.ps1) consume el
 * outDir resultante y hace aws s3 sync hacia el bucket PROD.
 *
 * Uso:
 *   node render.js --config <path-al-json>
 *
 * El JSON de config debe tener:
 *   {
 *     "outDir": "C:\\temp\\prerender-out",
 *     "hostname": "https://sharemechat.com",
 *     "urls": ["/blog/es", "/blog/en", "/blog/es/<slug>", ...],
 *     "shellTitle": "1-to-1 Video Chat with Verified Models | SharemeChat"
 *   }
 *
 * Exit codes:
 *   0 - todas las URLs renderizadas OK.
 *   1 - una o mas URLs fallaron (escritura parcial; el orchestrator debe
 *       decidir si abortar el sync a S3).
 *   2 - error de invocacion (config ausente o invalido).
 *
 * Referencias: docs/01-business/seo/seo-prerender-analysis-2026-06-21.md,
 * docs/01-business/seo/seo-edge-function-changes-2026-06-21.md.
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

function parseArgs(argv) {
  const idx = argv.indexOf('--config');
  if (idx === -1 || !argv[idx + 1]) {
    console.error('Uso: node render.js --config <path-al-json>');
    process.exit(2);
  }
  return { configPath: argv[idx + 1] };
}

function loadConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    console.error(`Config no existe: ${configPath}`);
    process.exit(2);
  }
  let raw;
  try {
    raw = fs.readFileSync(configPath, 'utf-8');
  } catch (err) {
    console.error(`No se pudo leer config: ${err.message}`);
    process.exit(2);
  }
  let cfg;
  try {
    cfg = JSON.parse(raw);
  } catch (err) {
    console.error(`Config JSON invalido: ${err.message}`);
    process.exit(2);
  }
  if (!cfg.outDir || !cfg.hostname || !Array.isArray(cfg.urls) || cfg.urls.length === 0) {
    console.error('Config invalido: outDir, hostname, urls (array no vacio) son obligatorios.');
    process.exit(2);
  }
  if (!cfg.shellTitle || typeof cfg.shellTitle !== 'string') {
    console.error('Config invalido: shellTitle (string) es obligatorio para el fallback de hidratacion.');
    process.exit(2);
  }
  return cfg;
}

async function renderOne(browser, hostname, url, shellTitle, outDir) {
  const fullUrl = hostname + url;
  console.log(`[START] ${fullUrl}`);
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 1280, height: 720 });
    await page.setUserAgent('SharemeChatPrerender/1.0');
    await page.goto(fullUrl, { waitUntil: 'networkidle0', timeout: 45000 });

    // Esperar hidratacion. Estrategia primaria: marcador inyectado por
    // BlogContent.jsx / BlogArticleView.jsx tras aplicar los meta tags.
    // Fallback: comprobar que el title cambio respecto al shell SPA y
    // que hay un <link rel="canonical">.
    let usedFallback = false;
    try {
      await page.waitForSelector('body[data-blog-hydrated="true"]', { timeout: 20000 });
    } catch (e) {
      usedFallback = true;
      console.warn(`[FALLBACK] ${url} - marcador no encontrado, intentando title+canonical`);
      await page.waitForFunction(
        (st) => document.title !== st && !!document.querySelector('link[rel="canonical"]'),
        { timeout: 10000 },
        shellTitle
      );
    }

    // Esperar a que las imagenes carguen (importante para LCP en SEO).
    // No abortar si alguna imagen tarda mas de 15s: warning y continuar.
    try {
      await page.waitForFunction(
        () => Array.from(document.images).every((img) => img.complete && img.naturalHeight > 0),
        { timeout: 15000 }
      );
    } catch (e) {
      console.warn(`[WARN] ${url} - alguna imagen no cargo en 15s, capturando igualmente`);
    }

    const html = await page.content();
    const title = await page.title();

    const cleanUrl = url.replace(/^\//, '').replace(/\/$/, '');
    const outPath = path.join(outDir, cleanUrl, 'index.html');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, html, 'utf-8');

    const note = usedFallback ? ' (via fallback title+canonical)' : '';
    console.log(`[OK] ${url} -> ${html.length} bytes, title='${title}', outPath=${outPath}${note}`);
    return { ok: true, url, bytes: html.length, title, usedFallback };
  } catch (err) {
    console.error(`[FAIL] ${url}: ${err.message}`);
    return { ok: false, url, error: err.message };
  } finally {
    await page.close();
  }
}

async function main() {
  const { configPath } = parseArgs(process.argv.slice(2));
  const config = loadConfig(configPath);
  const { outDir, hostname, urls, shellTitle } = config;

  console.log(`Pre-render iniciado. hostname=${hostname} urls=${urls.length} outDir=${outDir}`);
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });

  const results = [];
  try {
    for (const url of urls) {
      const res = await renderOne(browser, hostname, url, shellTitle, outDir);
      results.push(res);
    }
  } finally {
    await browser.close();
  }

  const ok = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok).length;
  console.log(`\nResumen: ${ok} OK, ${fail} fallos de ${urls.length} URLs.`);

  if (fail > 0) {
    console.error('Pre-render terminado con fallos. Revisar logs arriba.');
    process.exit(1);
  }
  console.log('Pre-render completado sin fallos.');
  process.exit(0);
}

main().catch((e) => {
  console.error('Error no manejado:', e);
  process.exit(2);
});
