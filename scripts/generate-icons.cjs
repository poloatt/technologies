/**
 * Genera iconos PNG desde el SVG de cada app y actualiza favicon / PWA / iOS
 * para que la URL cambie cuando cambia el logo (evita caché del browser y del teléfono).
 *
 * Uso: node scripts/generate-icons.cjs [foco|caja|pulso|all]
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');

const APPS = {
  foco: {
    svg: 'apps/foco/public/foco-icon.svg',
    out: 'apps/foco/public/icons',
    html: 'apps/foco/index.html',
    manifest: 'apps/foco/public/manifest.json',
    favicon: '/foco-icon.svg',
  },
  caja: {
    svg: 'apps/caja/public/caja-icon.svg',
    out: 'apps/caja/public/icons',
    html: 'apps/caja/index.html',
    manifest: 'apps/caja/public/manifest.json',
    favicon: '/caja-icon.svg',
  },
  pulso: {
    svg: 'apps/pulso/public/pulso-icon.svg',
    out: 'apps/pulso/public/icons',
    html: 'apps/pulso/index.html',
    manifest: 'apps/pulso/public/manifest.json',
    favicon: '/pulso-icon.svg',
  },
};

const SIZES = [32, 72, 96, 128, 144, 152, 180, 192, 384, 512];
const HASH_RE = /^[a-f0-9]{8,16}$/;

function iconHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 10);
}

function iconBlock(favicon, hash) {
  const base = `/icons/${hash}`;
  return [
    `    <link rel="icon" type="image/svg+xml" href="${favicon}?v=${hash}" />`,
    `    <link rel="shortcut icon" type="image/svg+xml" href="${favicon}?v=${hash}" />`,
    `    <link rel="icon" type="image/png" sizes="32x32" href="${base}/icon-32x32.png" />`,
    `    <link rel="icon" type="image/png" sizes="192x192" href="${base}/icon-192x192.png" />`,
    `    <link rel="apple-touch-icon" sizes="180x180" href="${base}/icon-180x180.png" />`,
    `    <link rel="apple-touch-icon" sizes="152x152" href="${base}/icon-152x152.png" />`,
    `    <link rel="apple-touch-icon" sizes="144x144" href="${base}/icon-144x144.png" />`,
    `    <link rel="apple-touch-icon" href="${base}/icon-180x180.png" />`,
    `    <link rel="manifest" href="/manifest.json?v=${hash}" />`,
  ].join('\n');
}

function patchIndexHtml(htmlPath, favicon, hash) {
  let html = fs.readFileSync(htmlPath, 'utf8');
  const markedBlock = `    <!-- app-icons -->\n${iconBlock(favicon, hash)}\n    <!-- /app-icons -->`;
  const marked = /<!-- app-icons -->[\s\S]*?<!-- \/app-icons -->/;
  if (marked.test(html)) {
    html = html.replace(marked, markedBlock);
  } else if (/<meta charset="UTF-8" \/>/.test(html)) {
    html = html.replace(/(<meta charset="UTF-8" \/>)/, `$1\n${markedBlock}`);
  } else {
    throw new Error(`No se pudo insertar iconos en ${htmlPath}`);
  }

  const start = html.indexOf('<!-- app-icons -->');
  const endMarker = '<!-- /app-icons -->';
  const end = html.indexOf(endMarker);
  if (start !== -1 && end !== -1) {
    const before = html.slice(0, start);
    const mid = html.slice(start, end + endMarker.length);
    let after = html.slice(end + endMarker.length);
    after = after.replace(/\s*<!-- Iconos para iOS[\s\S]*?-->/g, '');
    after = after.replace(/\s*<link rel="(?:icon|shortcut icon|apple-touch-icon|manifest)"[^>]*>/g, '');
    html = before + mid + after;
  }

  fs.writeFileSync(htmlPath, html);
}

function versionedIconSrc(src, hash) {
  const pathOnly = String(src).split('?')[0];
  const file = pathOnly.replace(/\/icons\/(?:[a-f0-9]{8,16}\/)?/, '');
  return `/icons/${hash}/${file.replace(/^\//, '')}`;
}

function patchManifest(manifestPath, hash) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (Array.isArray(manifest.icons)) {
    manifest.icons = manifest.icons.map((icon) => ({
      ...icon,
      src: versionedIconSrc(icon.src, hash),
    }));
  }
  if (Array.isArray(manifest.shortcuts)) {
    manifest.shortcuts = manifest.shortcuts.map((shortcut) => ({
      ...shortcut,
      icons: (shortcut.icons || []).map((icon) => ({
        ...icon,
        src: versionedIconSrc(icon.src, hash),
      })),
    }));
  }
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function cleanOldHashDirs(outDir, keepHash) {
  if (!fs.existsSync(outDir)) return;
  for (const name of fs.readdirSync(outDir)) {
    const full = path.join(outDir, name);
    if (name !== keepHash && HASH_RE.test(name) && fs.statSync(full).isDirectory()) {
      fs.rmSync(full, { recursive: true, force: true });
    }
  }
}

async function generateForApp(appKey) {
  const { svg, out, html, manifest, favicon } = APPS[appKey];
  const svgPath = path.join(root, svg);
  const outDir = path.join(root, out);
  const htmlPath = path.join(root, html);
  const manifestPath = path.join(root, manifest);

  if (!fs.existsSync(svgPath)) {
    console.warn(`[${appKey}] SVG no encontrado: ${svgPath}`);
    return;
  }

  const svgBuffer = fs.readFileSync(svgPath);
  const hash = iconHash(svgBuffer);
  const hashedDir = path.join(outDir, hash);

  fs.mkdirSync(hashedDir, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });

  const svgCopy = path.join(outDir, path.basename(svgPath));
  if (svgCopy !== svgPath && fs.existsSync(svgCopy)) {
    fs.copyFileSync(svgPath, svgCopy);
  }

  for (const size of SIZES) {
    const fileName = `icon-${size}x${size}.png`;
    const hashedPath = path.join(hashedDir, fileName);
    await sharp(svgBuffer).resize(size, size).png().toFile(hashedPath);
    fs.copyFileSync(hashedPath, path.join(outDir, fileName));
    console.log(`[${appKey}] ${hashedPath}`);
  }

  patchIndexHtml(htmlPath, favicon, hash);
  patchManifest(manifestPath, hash);
  cleanOldHashDirs(outDir, hash);
  console.log(`[${appKey}] icon hash ${hash}`);
}

async function main() {
  const target = process.argv[2] || 'all';
  const apps = target === 'all' ? Object.keys(APPS) : [target];

  for (const appKey of apps) {
    if (!APPS[appKey]) {
      console.error(`App desconocida: ${appKey}`);
      process.exit(1);
    }
    await generateForApp(appKey);
  }

  console.log('Iconos generados y referencias actualizadas.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
