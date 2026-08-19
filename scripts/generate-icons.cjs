/**
 * Genera iconos PNG en múltiples tamaños a partir del SVG de cada app.
 * Uso: node scripts/generate-icons.cjs [foco|caja|pulso|all]
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');

const APPS = {
  foco: { svg: 'apps/foco/public/foco-icon.svg', out: 'apps/foco/public/icons' },
  caja: { svg: 'apps/caja/public/caja-icon.svg', out: 'apps/caja/public/icons' },
  pulso: { svg: 'apps/pulso/public/pulso-icon.svg', out: 'apps/pulso/public/icons' },
};

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

async function generateForApp(appKey) {
  const { svg, out } = APPS[appKey];
  const svgPath = path.join(root, svg);
  const outDir = path.join(root, out);

  if (!fs.existsSync(svgPath)) {
    console.warn(`[${appKey}] SVG no encontrado: ${svgPath}`);
    return;
  }

  fs.mkdirSync(outDir, { recursive: true });
  const svgBuffer = fs.readFileSync(svgPath);

  for (const size of SIZES) {
    const outPath = path.join(outDir, `icon-${size}x${size}.png`);
    await sharp(svgBuffer).resize(size, size).png().toFile(outPath);
    console.log(`[${appKey}] ${outPath}`);
  }
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

  console.log('Iconos generados.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
