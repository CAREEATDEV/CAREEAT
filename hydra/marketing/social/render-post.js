#!/usr/bin/env node
// Renders an on-brand HYDRA "hook post" image (same template every time — real
// visual consistency, not an AI image generator's guesswork). Uses the repo's
// actual design tokens (src/theme/colors.ts) and fonts (assets/fonts).
//
// Usage:
//   node render-post.js --hook "..." --cta "..." --format ig|tiktok
//     [--accent green|amber|red|poison] [--seg 0-8] [--out path.png]
//
// --hook accepts basic HTML: use <span class="accent">...</span> to highlight
// a word/number in the accent colour (e.g. a striking stat).
//
// Examples:
//   node render-post.js --format ig --seg 3 --accent red \
//     --hook 'Et si le chiffre <span class="accent">« 8 verres par jour »</span> était complètement inventé ?' \
//     --cta 'La vraie formule en légende'
//
//   node render-post.js --format tiktok --seg 6 --accent green \
//     --hook 'Ta barre de vie <span class="accent">ne peut pas</span> se remplir plus vite qu’1L/h.' \
//     --cta 'Pourquoi, en légende'

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      out[key] = val;
    }
  }
  return out;
}

const ACCENTS = {
  green: '#3EE07A',
  amber: '#FFB020',
  red: '#FF3B4A',
  poison: '#B44CFF',
};

const FORMATS = {
  ig: { w: 1080, h: 1350, hookSize: 76, padH: 84, padV: 0 }, // 4:5 feed
  tiktok: { w: 1080, h: 1920, hookSize: 84, padH: 84, padV: 0 }, // 9:16 reel/story
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const hook = args.hook;
  const cta = args.cta || 'La réponse en légende';
  const format = FORMATS[args.format || 'ig'];
  if (!hook || !format) {
    console.error('Usage: node render-post.js --hook "..." --format ig|tiktok [--cta "..."] [--accent green|amber|red|poison] [--seg 0-8] [--out path.png]');
    process.exit(1);
  }
  const accent = ACCENTS[args.accent || 'green'];
  const seg = Math.max(0, Math.min(8, parseInt(args.seg ?? '4', 10)));
  const outPath = args.out || path.join(__dirname, `post-${Date.now()}.png`);

  const fontsDir = path.join(__dirname, '..', '..', 'assets', 'fonts');
  const toFileUrl = (p) => 'file://' + p;

  // Global (all-occurrences) replace for every token — a token appearing in a
  // comment AND in code (or twice anywhere) must never leave a stray copy
  // unreplaced, or the injected <script> silently breaks (learned the hard way).
  const replaceAll = (str, token, value) =>
    str.split(token).join(value);

  let html = fs.readFileSync(path.join(__dirname, 'template-hook-post.html'), 'utf8');
  const tokens = {
    __FONT_DISPLAY__: toFileUrl(path.join(fontsDir, 'ChakraPetch-Bold.ttf')),
    __FONT_LABEL__: toFileUrl(path.join(fontsDir, 'ChakraPetch-SemiBold.ttf')),
    __FONT_MONO__: toFileUrl(path.join(fontsDir, 'IBMPlexMono-Regular.ttf')),
    __FONT_MONOBOLD__: toFileUrl(path.join(fontsDir, 'IBMPlexMono-Bold.ttf')),
    __W__: format.w,
    __H__: format.h,
    __PAD_H__: format.padH,
    __PAD_V__: format.padV,
    __HOOK_SIZE__: format.hookSize,
    __HOOK_HTML__: hook,
    __CTA__: cta,
    __SEG_ON__: seg,
    __ACCENT__: accent,
  };
  for (const [token, value] of Object.entries(tokens)) {
    html = replaceAll(html, token, String(value));
  }

  const tmpHtml = outPath + '.tmp.html';
  fs.writeFileSync(tmpHtml, html);

  const { chromium } = require('/opt/node22/lib/node_modules/playwright');
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: format.w, height: format.h } });
  await page.goto(toFileUrl(tmpHtml));
  await page.waitForTimeout(200);
  await page.screenshot({ path: outPath });
  await browser.close();
  fs.unlinkSync(tmpHtml);

  console.log('Written:', outPath);
}

main().catch((e) => { console.error(e); process.exit(1); });
