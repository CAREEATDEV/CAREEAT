#!/usr/bin/env node
// HYDRA — générateur de vidéos verticales (1080x1920) pour TikTok/Instagram.
// Clone vidéo du pipeline image (template-hook-post.html) : même charte, mais
// la carte s'anime — hook 2s, révélation ligne par ligne, démo de la barre de
// vie (draine puis remonte), réponse finale + CTA waitlist.
//
// One-click depuis un sujet (appelle l'API Claude, comme le studio image) :
//   ANTHROPIC_API_KEY=sk-ant-…  node render-video.js --sujet "Le mythe des 8 verres"
//
// Ou re-rendre un contenu déjà généré (édité à la main si besoin), sans API :
//   node render-video.js --json hydra-video-le-mythe-…-contenu.json
//
// Options : --out <dossier>  --fps <30>  --keep-frames  --key <clé API>
//
// Pipeline : template HTML/CSS (keyframes) → seek frame par frame dans
// Chromium (déterministe, aucune frame perdue) → assemblage ffmpeg.
// Sortie : .mp4 H.264 (si ffmpeg le permet — ffmpeg-static ou ffmpeg système),
// sinon .webm (ffmpeg embarqué de Playwright). + 2 légendes .txt + contenu .json.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

// ── petits utilitaires ───────────────────────────────────────────────────────
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
const replaceAll = (str, token, value) => str.split(token).join(value);
const slugify = (s) =>
  String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'post';

function resolvePlaywright() {
  const candidates = ['playwright', '/opt/node22/lib/node_modules/playwright'];
  for (const c of candidates) {
    try { return require(c); } catch (_) {}
  }
  throw new Error(
    "Playwright introuvable. Dans marketing/social/video : npm install " +
    "puis npx playwright install chromium");
}

function chromiumExecutablePath() {
  // Chemin du sandbox de dev si présent ; sinon laisser Playwright décider
  // (installation utilisateur via `npx playwright install chromium`).
  return fs.existsSync('/opt/pw-browsers/chromium')
    ? '/opt/pw-browsers/chromium' : undefined;
}

function resolveFfmpeg() {
  const tryBin = (bin) => {
    try {
      const r = spawnSync(bin, ['-version'], { stdio: 'pipe' });
      if (r.status === 0) return true;
    } catch (_) {}
    return false;
  };
  const candidates = [];
  if (process.env.FFMPEG_PATH) candidates.push(process.env.FFMPEG_PATH);
  candidates.push('ffmpeg');
  try { candidates.push(require('ffmpeg-static')); } catch (_) {}
  // ffmpeg embarqué de Playwright (VP8/webm seulement)
  for (const dir of ['/opt/pw-browsers', path.join(os.homedir(), '.cache', 'ms-playwright')]) {
    try {
      for (const d of fs.readdirSync(dir)) {
        if (d.startsWith('ffmpeg')) {
          for (const f of ['ffmpeg-linux', 'ffmpeg-mac', 'ffmpeg-win64.exe', 'ffmpeg']) {
            candidates.push(path.join(dir, d, f));
          }
        }
      }
    } catch (_) {}
  }
  for (const bin of candidates) {
    if (bin && tryBin(bin)) {
      let h264 = false, image2 = false;
      try {
        h264 = execFileSync(bin, ['-encoders'], { stdio: 'pipe' })
          .toString().includes('libx264');
      } catch (_) {}
      try {
        // Le ffmpeg embarqué de Playwright n'a ni démuxeur image2 ni décodeur
        // PNG : dans ce cas on capture en JPEG et on pipe (image2pipe/mjpeg).
        image2 = execFileSync(bin, ['-formats'], { stdio: 'pipe' })
          .toString().split('\n').some((l) => /^\s*D\S*\s+image2\s/.test(l));
      } catch (_) {}
      return { bin, h264, image2 };
    }
  }
  throw new Error(
    'ffmpeg introuvable. Dans marketing/social/video : npm install (fournit ' +
    'ffmpeg-static), ou installe ffmpeg sur la machine.');
}

// ── appel API Claude (même logique éprouvée que post-studio.html) ────────────
const SYSTEM_PROMPT = `Tu es le copywriter scientifique de HYDRA, une app d'hydratation au ton BRUTAL, MINIMALISTE, DIRECT — jamais "wellness", jamais d'émojis dégoulinants, aucune émotion cucul. Marque vidéoludique (barre de vie qui se vide, l'alcool est un "poison").

MISSION : à partir d'un simple sujet, tu écris le contenu d'une VIDÉO verticale courte (8-14 s) pour TikTok/Instagram. Structure de la vidéo : (1) une carte "hook" 2 s, (2) une explication révélée ligne par ligne À L'ÉCRAN, (3) la réponse finale, puis un CTA waitlist.

MÉTHODE :
1. Utilise l'outil web_search pour VÉRIFIER les faits et chiffres (mécanismes physiologiques, études, indices comme le Beverage Hydration Index, échelle d'Armstrong, etc.). Ne cite jamais une statistique précise sans l'avoir vérifiée. Si un chiffre exact reste incertain, reste qualitatif plutôt que d'inventer.
2. Trie : garde uniquement l'info solide, utile, surprenante.

MÉCANIQUE (rétention) :
- Le HOOK pose une question ouverte ou une intrigue — jamais la réponse.
- Les LIGNES font monter la tension : chacune est courte, autonome, lisible en ~1 s. Ce texte est INCRUSTÉ dans la vidéo (pas en description).
- La RÉPONSE est le paiement de l'attente : une phrase, cash.

TU RENDS UNIQUEMENT un objet JSON valide (aucun texte autour, aucune balise markdown), avec EXACTEMENT ces clés :
{
  "hook":  "l'accroche (8 à 14 mots, français). Entoure LE mot/chiffre choc d'astérisques *comme ça*. Une question/intrigue, PAS la réponse.",
  "accent":"une seule valeur parmi: green, red, amber, poison. green=conseil/bonne nouvelle · red=mythe à casser/chiffre choc/alerte · amber=nuance · poison=tout sujet lié à l'alcool.",
  "seg":   "entier de 2 à 7 : segments allumés sur la barre de vie au départ. Sujet alarmant/mythe = bas (2-3), conseil positif = haut (5-6).",
  "lines": ["3 à 5 lignes courtes (6 à 12 mots chacune) qui expliquent le mécanisme scientifique, dans l'ordre logique, tension croissante. Astérisques *autorisées* pour 1 mot clé par ligne max. La dernière ligne prépare la réponse sans la donner."],
  "answer":"LA réponse finale, une seule phrase percutante (5 à 12 mots). Astérisques autorisées sur le mot clé.",
  "cta_video":"CTA court en MAJUSCULES pour l'écran final (ex: WAITLIST OUVERTE · LIEN EN BIO).",
  "caption_instagram":"légende Instagram COURTE (2-3 phrases max — le contenu est déjà dans la vidéo) : une relance + accès en avant-première via le lien en bio → https://hydra-landing-sooty.vercel.app + 4-6 hashtags en dernière ligne.",
  "caption_tiktok":"légende TikTok très courte (1-2 phrases punchy) : relance + « lien en bio » + 3-5 hashtags en dernière ligne."
}`;

function escapeCtrlInStrings(json) {
  let out = '', inStr = false, esc = false;
  for (const ch of json) {
    if (inStr && !esc && (ch === '\n' || ch === '\r' || ch === '\t')) {
      out += ch === '\n' ? '\\n' : ch === '\t' ? '\\t' : '';
      continue;
    }
    out += ch;
    if (esc) esc = false;
    else if (ch === '\\') esc = true;
    else if (ch === '"') inStr = !inStr;
  }
  return out;
}
function extractJSON(text) {
  const s = text.indexOf('{');
  const e = text.lastIndexOf('}');
  if (s === -1 || e === -1 || e < s) throw new Error('Réponse sans JSON exploitable.');
  const raw = text.slice(s, e + 1);
  try { return JSON.parse(raw); }
  catch (_) { return JSON.parse(escapeCtrlInStrings(raw)); }
}

async function callClaude(topic, key) {
  const messages = [{ role: 'user', content: `Sujet de la vidéo : ${topic}` }];
  for (let i = 0; i < 6; i++) {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-8',
        max_tokens: 4000,
        tools: [{ type: 'web_search_20260209', name: 'web_search' }],
        system: SYSTEM_PROMPT,
        messages,
      }),
    });
    if (!resp.ok) {
      let detail = '';
      try { detail = (await resp.json())?.error?.message || ''; } catch (_) {}
      throw new Error(`API ${resp.status}${detail ? ' — ' + detail : ''}`);
    }
    const data = await resp.json();
    if (data.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: data.content });
      continue;
    }
    return (data.content || [])
      .filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  }
  throw new Error('Recherche trop longue — réessaie.');
}

function normalizeContent(c) {
  const ACCENTS = ['green', 'amber', 'red', 'poison'];
  if (!c.hook || !c.answer || !Array.isArray(c.lines) || c.lines.length < 3) {
    throw new Error('Contenu incomplet (hook/lines[3+]/answer requis) : ' + JSON.stringify(c));
  }
  return {
    hook: String(c.hook),
    accent: ACCENTS.includes(String(c.accent).toLowerCase())
      ? String(c.accent).toLowerCase() : 'green',
    seg: Math.max(2, Math.min(7, parseInt(c.seg, 10) || 6)),
    lines: c.lines.slice(0, 5).map(String),
    answer: String(c.answer),
    cta_video: String(c.cta_video || 'WAITLIST OUVERTE · LIEN EN BIO').toUpperCase(),
    caption_instagram: String(c.caption_instagram || ''),
    caption_tiktok: String(c.caption_tiktok || ''),
  };
}

// ── rendu ────────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outDir = path.resolve(args.out || '.');
  const fps = Math.max(10, Math.min(60, parseInt(args.fps, 10) || 30));
  fs.mkdirSync(outDir, { recursive: true });

  // 1) Contenu : depuis un JSON existant, ou généré par Claude depuis le sujet.
  let content, slugBase;
  if (args.json) {
    content = normalizeContent(JSON.parse(fs.readFileSync(args.json, 'utf8')));
    slugBase = slugify(path.basename(args.json).replace(/^hydra-video-|(-contenu)?\.json$/g, ''));
  } else if (args.sujet) {
    const key = args.key || process.env.ANTHROPIC_API_KEY || process.env.HYDRA_ANTHROPIC_KEY;
    if (!key) {
      throw new Error(
        'Clé API manquante. Définis ANTHROPIC_API_KEY (ou passe --key). ' +
        'Elle ne doit JAMAIS être écrite dans un fichier du repo.');
    }
    console.log('⏳ Recherche scientifique + écriture (Claude)… 30-60 s');
    content = normalizeContent(extractJSON(await callClaude(String(args.sujet), key)));
    slugBase = slugify(args.sujet);
  } else {
    console.error('Usage : node render-video.js --sujet "…"   (ou --json contenu.json)');
    process.exit(1);
  }

  const base = path.join(outDir, `hydra-video-${slugBase}`);
  fs.writeFileSync(`${base}-contenu.json`, JSON.stringify(content, null, 2));
  if (content.caption_instagram)
    fs.writeFileSync(`${base}-legende-instagram.txt`, content.caption_instagram);
  if (content.caption_tiktok)
    fs.writeFileSync(`${base}-legende-tiktok.txt`, content.caption_tiktok);

  // 2) Template + injections (polices du repo, contenu).
  const fontsDir = path.join(__dirname, '..', '..', '..', 'assets', 'fonts');
  const toFileUrl = (p) => 'file://' + p;
  let html = fs.readFileSync(path.join(__dirname, 'template-video.html'), 'utf8');
  const tokens = {
    __FONT_DISPLAY__: toFileUrl(path.join(fontsDir, 'ChakraPetch-Bold.ttf')),
    __FONT_LABEL__: toFileUrl(path.join(fontsDir, 'ChakraPetch-SemiBold.ttf')),
    __FONT_MONO__: toFileUrl(path.join(fontsDir, 'IBMPlexMono-Regular.ttf')),
    __FONT_MONOBOLD__: toFileUrl(path.join(fontsDir, 'IBMPlexMono-Bold.ttf')),
    __CONTENT_JSON__: JSON.stringify(content).replace(/</g, '\\u003c'),
  };
  for (const [token, value] of Object.entries(tokens)) {
    html = replaceAll(html, token, String(value));
  }
  const tmpHtml = `${base}.tmp.html`;
  fs.writeFileSync(tmpHtml, html);

  // 3) Capture frame par frame (déterministe : on pilote currentTime).
  //    ffmpeg est résolu AVANT la capture : son build décide du format de
  //    frame (PNG lossless si démuxeur image2, sinon JPEG pipé).
  const { bin, h264, image2 } = resolveFfmpeg();
  const ext = image2 ? 'png' : 'jpeg';

  const { chromium } = resolvePlaywright();
  const browser = await chromium.launch({ executablePath: chromiumExecutablePath() });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto(toFileUrl(tmpHtml));
  await page.evaluate(() => document.fonts.ready);

  const totalMs = await page.evaluate(() => window.__TOTAL_MS__);
  const frameCount = Math.ceil((totalMs / 1000) * fps);
  const framesDir = `${base}.frames`;
  fs.rmSync(framesDir, { recursive: true, force: true });
  fs.mkdirSync(framesDir, { recursive: true });

  console.log(`🎞  ${(totalMs / 1000).toFixed(1)} s · ${frameCount} frames à ${fps} fps (${ext})`);
  for (let f = 0; f < frameCount; f++) {
    await page.evaluate((ms) => window.__seek(ms), (f * 1000) / fps);
    await page.screenshot({
      path: path.join(framesDir, `frame${String(f).padStart(5, '0')}.${ext}`),
      ...(ext === 'jpeg' ? { type: 'jpeg', quality: 94 } : {}),
    });
    if (f % 60 === 0) console.log(`   frame ${f}/${frameCount}`);
  }
  await browser.close();
  fs.unlinkSync(tmpHtml);

  // 4) Assemblage ffmpeg (mp4 H.264 si possible, sinon webm).
  const outVideo = `${base}.${h264 ? 'mp4' : 'webm'}`;
  const encode = h264
    ? ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
       '-pix_fmt', 'yuv420p', '-movflags', '+faststart']
    : ['-c:v', 'libvpx', '-b:v', '4M', '-pix_fmt', 'yuv420p', '-auto-alt-ref', '0'];
  console.log(`🎬 Encodage ${h264 ? 'MP4 H.264' : 'WebM (VP8 — installe ffmpeg/ffmpeg-static pour du MP4)'}…`);
  if (image2) {
    execFileSync(bin, ['-y', '-framerate', String(fps),
      '-i', path.join(framesDir, `frame%05d.${ext}`), ...encode, outVideo],
      { stdio: 'inherit' });
  } else {
    // Build minimal (Playwright) : pas d'image2 ni de PNG → on concatène les
    // JPEG en flux MJPEG et on pipe.
    const frames = fs.readdirSync(framesDir).sort()
      .map((f) => fs.readFileSync(path.join(framesDir, f)));
    const r = spawnSync(bin, ['-y', '-f', 'image2pipe', '-framerate', String(fps),
      '-c:v', 'mjpeg', '-i', 'pipe:0', ...encode, outVideo],
      { input: Buffer.concat(frames), maxBuffer: 1 << 30, stdio: ['pipe', 'inherit', 'inherit'] });
    if (r.status !== 0) throw new Error('ffmpeg a échoué (code ' + r.status + ')');
  }

  if (!args['keep-frames']) fs.rmSync(framesDir, { recursive: true, force: true });

  console.log('\n✅ Fini :');
  console.log('   ' + outVideo);
  if (content.caption_instagram) console.log(`   ${base}-legende-instagram.txt`);
  if (content.caption_tiktok) console.log(`   ${base}-legende-tiktok.txt`);
  console.log(`   ${base}-contenu.json  (éditable → re-rendre avec --json)`);
}

main().catch((e) => { console.error('Erreur :', e.message || e); process.exit(1); });
