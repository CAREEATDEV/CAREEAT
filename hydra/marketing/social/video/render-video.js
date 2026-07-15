#!/usr/bin/env node
// HYDRA — générateur de vidéos verticales (1080x1350, format Instagram 4:5)
// pour TikTok/Instagram. Même charte que le pipeline image.
//
// Architecture (rapide, peu coûteuse) :
//   1) Une vidéo de FOND par couleur d'accent (vert/rouge/ambre/poison) est
//      rendue UNE SEULE FOIS (Chromium, template-background.html) puis mise
//      en cache dans backgrounds/ — jamais régénérée ensuite.
//   2) Chaque post ne fait qu'INCRUSTER des sous-titres (hook/lignes/réponse/
//      CTA, via ffmpeg+libass) sur ce fond déjà prêt : pas de Chromium par
//      post, quelques secondes au lieu de ~40s. Le minutage (timeline.js) est
//      FIXE (~18,5s) ; le nombre de lignes de Claude s'y calibre tout seul.
//
// One-click depuis un sujet (appelle l'API Claude, comme le studio image) :
//   ANTHROPIC_API_KEY=sk-ant-…  node render-video.js --sujet "Le mythe des 8 verres"
//
// Ou re-rendre un contenu déjà généré (édité à la main si besoin), sans API :
//   node render-video.js --json hydra-video-le-mythe-…-contenu.json
//
// Options : --out <dossier>  --keep-frames  --key <clé API>
//
// Sortie : .mp4 H.264 + 2 légendes .txt + contenu .json.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { execFileSync, spawnSync } = require('child_process');
const timeline = require('./timeline');
const { buildAss, buildAssVoice } = require('./ass');
const { buildVoicePlan } = require('./voice-timeline');
const { synthesizeWithTimestamps } = require('./elevenlabs');

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
      let h264 = false, image2 = false, ass = false;
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
      try {
        // Sous-titres incrustés (libass) : nécessaire pour l'incrustation
        // rapide des captions sur le fond pré-enregistré.
        ass = execFileSync(bin, ['-filters'], { stdio: 'pipe' })
          .toString().split('\n').some((l) => /^\s*\S*\s+ass\s/.test(l));
      } catch (_) {}
      return { bin, h264, image2, ass };
    }
  }
  throw new Error(
    'ffmpeg introuvable. Dans marketing/social/video : npm install (fournit ' +
    'ffmpeg-static), ou installe ffmpeg sur la machine.');
}

// ── appel API Claude (même logique éprouvée que post-studio.html) ────────────
const SYSTEM_PROMPT = `Tu es le copywriter scientifique de HYDRA, une app d'hydratation au ton BRUTAL, MINIMALISTE, DIRECT — jamais "wellness", jamais d'émojis dégoulinants, aucune émotion cucul. Marque vidéoludique (barre de vie qui se vide, l'alcool est un "poison").

MISSION : à partir d'un simple sujet, tu écris le contenu d'une VIDÉO verticale longue (~60 s, format "réel explicatif") pour TikTok/Instagram — assez de temps pour une explication scientifique AUSSI DÉTAILLÉE qu'une légende complète (plusieurs mécanismes distincts, études citées avec leur nom quand tu en trouves une). Structure : (1) une carte "hook" 3 s, (2) l'explication révélée À L'ÉCRAN, une ligne à la fois (le nombre de lignes s'adapte automatiquement à la durée fixe de la vidéo), (3) la réponse/synthèse finale, puis un CTA waitlist.

MÉTHODE :
1. Utilise l'outil web_search pour VÉRIFIER les faits, chiffres et mécanismes (physiologie, études nommées — auteur/année/revue si tu en trouves une, indices comme le Beverage Hydration Index, échelle d'Armstrong, etc.). Ne cite jamais une statistique précise sans l'avoir vérifiée. Si un chiffre exact reste incertain, reste qualitatif plutôt que d'inventer.
2. Trie et STRUCTURE en plusieurs mécanismes/angles distincts (comme un mini-article) plutôt qu'un seul argument répété — vise la même densité d'information qu'une légende Instagram complète, mais découpée en lignes courtes à l'écran.

MÉCANIQUE (rétention) :
- Le HOOK pose une question ouverte ou une intrigue — jamais la réponse.
- Les LIGNES déroulent l'explication complète, mécanisme après mécanisme : chacune est une phrase autonome, lisible en ~4-5 s. Ce texte est INCRUSTÉ dans la vidéo (pas en description).
- La RÉPONSE/SYNTHÈSE est le paiement de l'attente : une phrase de conclusion, cash.

TU RENDS UNIQUEMENT un objet JSON valide (aucun texte autour, aucune balise markdown), avec EXACTEMENT ces clés :
{
  "hook":  "l'accroche (8 à 14 mots, français). Entoure LE mot/chiffre choc d'astérisques *comme ça*. Une question/intrigue, PAS la réponse.",
  "accent":"une seule valeur parmi: green, red, amber, poison. green=conseil/bonne nouvelle · red=mythe à casser/chiffre choc/alerte · amber=nuance · poison=tout sujet lié à l'alcool.",
  "seg":   "(informatif seulement, sans effet visuel) entier de 2 à 7.",
  "lines": ["7 à 10 lignes (8 à 16 mots chacune) qui déroulent l'explication scientifique COMPLÈTE : plusieurs mécanismes/études distincts, dans l'ordre logique, comme les paragraphes d'un article condensés en phrases courtes. Astérisques *autorisées* pour 1 mot/chiffre clé par ligne max. La dernière ligne prépare la réponse sans la donner."],
  "answer":"LA réponse/synthèse finale, une seule phrase percutante (6 à 14 mots). Astérisques autorisées sur le mot clé.",
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
        max_tokens: 5000,
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
  if (!c.hook || !c.answer || !Array.isArray(c.lines) || c.lines.length < 4) {
    throw new Error('Contenu incomplet (hook/lines[4+]/answer requis) : ' + JSON.stringify(c));
  }
  return {
    hook: String(c.hook),
    accent: ACCENTS.includes(String(c.accent).toLowerCase())
      ? String(c.accent).toLowerCase() : 'green',
    seg: Math.max(2, Math.min(7, parseInt(c.seg, 10) || 6)),
    lines: c.lines.slice(0, 10).map(String),
    answer: String(c.answer),
    cta_video: String(c.cta_video || 'WAITLIST OUVERTE · LIEN EN BIO').toUpperCase(),
    caption_instagram: String(c.caption_instagram || ''),
    caption_tiktok: String(c.caption_tiktok || ''),
  };
}

// ── moteur réutilisable (CLI + studio web l'appellent tous les deux) ─────────
// opts : { content?, topic?, key?, outDir, slug?, onLog?,
//          elevenLabsKey?, voiceId?, elevenLabsModel? }
//  - content : objet contenu déjà prêt (re-rendu / test) ; sinon
//  - topic + key : génère le contenu via Claude.
//  - elevenLabsKey + voiceId (tous deux fournis) : active le mode voix off.
// Retourne { video, isMp4, captionIg, captionTt, contentPath, content, base }.
async function generateVideo(opts) {
  const log = opts.onLog || (() => {});
  const outDir = path.resolve(opts.outDir || '.');
  fs.mkdirSync(outDir, { recursive: true });

  // 1) Contenu.
  let content, slugBase;
  if (opts.content) {
    content = normalizeContent(opts.content);
    slugBase = slugify(opts.slug || content.hook);
  } else if (opts.topic) {
    if (!opts.key) {
      throw new Error('Clé API manquante. Elle ne doit JAMAIS être écrite dans un fichier du repo.');
    }
    log('⏳ Recherche scientifique + écriture (Claude)… 30-60 s');
    content = normalizeContent(extractJSON(await callClaude(String(opts.topic), opts.key)));
    slugBase = slugify(opts.slug || opts.topic);
  } else {
    throw new Error('generateVideo : fournis content, ou topic + key.');
  }

  const base = path.join(outDir, `hydra-video-${slugBase}`);
  fs.writeFileSync(`${base}-contenu.json`, JSON.stringify(content, null, 2));
  const capIgPath = content.caption_instagram ? `${base}-legende-instagram.txt` : null;
  const capTtPath = content.caption_tiktok ? `${base}-legende-tiktok.txt` : null;
  if (capIgPath) fs.writeFileSync(capIgPath, content.caption_instagram);
  if (capTtPath) fs.writeFileSync(capTtPath, content.caption_tiktok);

  const fontsDir = path.join(__dirname, '..', '..', '..', 'assets', 'fonts');
  const { bin, h264, ass } = resolveFfmpeg();
  if (!ass) {
    throw new Error(
      'Ton ffmpeg ne supporte pas les sous-titres incrustés (libass). ' +
      'Réinstalle : npm install ffmpeg-static@latest (ou installe un ffmpeg ' +
      'compilé avec --enable-libass).');
  }
  if (!h264) {
    throw new Error('Ton ffmpeg ne sait pas encoder en H.264 (libx264 manquant).');
  }

  const bgDir = path.join(__dirname, 'backgrounds');
  const outVideo = `${base}.mp4`;

  if (opts.elevenLabsKey && opts.voiceId) {
    // Mode voix off : durée et minutage dérivés de la voix réelle (pas du
    // minutage fixe) — voir renderVoiceVideo().
    await renderVoiceVideo(content, {
      base, outVideo, fontsDir, bin, log,
      bgDir, chromium: resolvePlaywright, chromiumExecutablePath,
      apiKey: opts.elevenLabsKey, voiceId: opts.voiceId, modelId: opts.elevenLabsModel,
      ttsImpl: opts.ttsImpl, // injectable pour les tests (sans appel réseau réel)
    });
  } else {
    // Mode silencieux (par défaut) : fond pré-enregistré (une fois par
    // couleur, mis en cache) + sous-titres calibrés sur le minutage FIXE
    // (timeline.js) — incrustés directement via ffmpeg (rapide, aucun
    // Chromium pour cette étape).
    const bgPath = await ensureBackground(content.accent, { fontsDir, bin, log, bgDir });
    const assPath = `${base}.ass`;
    fs.writeFileSync(assPath, buildAss(content), 'utf8');
    log('🎬 Incrustation des sous-titres…');
    try {
      execFileSync(bin, [
        '-y', '-i', bgPath,
        '-vf', `ass=${escapeFfmpegPath(assPath)}:fontsdir=${escapeFfmpegPath(fontsDir)}`,
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
        '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
        outVideo,
      ], { stdio: 'pipe' });
    } catch (e) {
      throw new Error('ffmpeg (incrustation) a échoué : ' + (e.stderr || e.message));
    }
    fs.unlinkSync(assPath);
  }

  log('✅ Terminé.');
  return {
    video: outVideo, isMp4: true,
    captionIg: capIgPath, captionTt: capTtPath,
    contentPath: `${base}-contenu.json`, content, base,
  };
}

// Échappe un chemin pour l'intérieur d'un argument de filtre ffmpeg
// (":" et "'" y sont significatifs) — nécessaire sur Windows (lecteur "C:\").
function escapeFfmpegPath(p) {
  return p.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
}

// Rend (une fois par couleur) et met en cache le fond de marque — segbar
// (démo drain/remonte), eyebrow, ligne CTA, brand. Aucun texte dynamique :
// c'est le même fichier vidéo pour tous les posts de cette couleur.
async function ensureBackground(accent, { fontsDir, bin, log, bgDir }) {
  fs.mkdirSync(bgDir, { recursive: true });
  const outPath = path.join(bgDir, `bg-${accent}.mp4`);
  if (fs.existsSync(outPath)) return outPath;

  log(`🎨 Première utilisation de la couleur « ${accent} » : préparation du fond (une fois, ~2 min)…`);
  const toFileUrl = (p) => pathToFileURL(p).href;
  let html = fs.readFileSync(path.join(__dirname, 'template-background.html'), 'utf8');
  const tokens = {
    __FONT_DISPLAY__: toFileUrl(path.join(fontsDir, 'ChakraPetch-Bold.ttf')),
    __FONT_LABEL__: toFileUrl(path.join(fontsDir, 'ChakraPetch-SemiBold.ttf')),
    __FONT_MONO__: toFileUrl(path.join(fontsDir, 'IBMPlexMono-Regular.ttf')),
    __FONT_MONOBOLD__: toFileUrl(path.join(fontsDir, 'IBMPlexMono-Bold.ttf')),
    __BG_ACCENT__: accent,
    __BG_DEMO_START__: timeline.DEMO_START,
    __BG_DEMO_MS__: timeline.DEMO_MS,
    __BG_TOTAL_MS__: timeline.TOTAL_MS,
  };
  for (const [token, value] of Object.entries(tokens)) {
    html = replaceAll(html, token, String(value));
  }
  const tmpHtml = path.join(bgDir, `bg-${accent}.tmp.html`);
  fs.writeFileSync(tmpHtml, html);

  const fps = 30;
  const { chromium } = resolvePlaywright();
  const browser = await chromium.launch({ executablePath: chromiumExecutablePath() });
  const framesDir = path.join(bgDir, `bg-${accent}.frames`);
  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
    await page.goto(toFileUrl(tmpHtml));
    await page.evaluate(() => document.fonts.ready);
    const totalMs = await page.evaluate(() => window.__TOTAL_MS__);
    const frameCount = Math.ceil((totalMs / 1000) * fps);

    fs.rmSync(framesDir, { recursive: true, force: true });
    fs.mkdirSync(framesDir, { recursive: true });
    for (let f = 0; f < frameCount; f++) {
      await page.evaluate((ms) => window.__seek(ms), (f * 1000) / fps);
      await page.screenshot({ path: path.join(framesDir, `frame${String(f).padStart(5, '0')}.png`) });
    }
    await browser.close();
  } catch (e) {
    try { await browser.close(); } catch (_) {}
    throw e;
  } finally {
    fs.rmSync(tmpHtml, { force: true });
  }

  execFileSync(bin, [
    '-y', '-framerate', String(fps),
    '-i', path.join(framesDir, 'frame%05d.png'),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '16',
    '-pix_fmt', 'yuv420p', outPath,
  ], { stdio: 'ignore' });
  fs.rmSync(framesDir, { recursive: true, force: true });

  return outPath;
}

// Une seule image fixe par couleur (chrome + barre pleine, avant toute
// démo — template-background.html au tout premier instant) : sert de fond
// pour le mode voix off (pas d'animation de barre dans ce mode, voir plus
// bas pourquoi). Rendu quasi instantané (un seul screenshot).
async function ensureStillBackground(accent, { fontsDir, bin, log, bgDir }) {
  fs.mkdirSync(bgDir, { recursive: true });
  const outPath = path.join(bgDir, `still-${accent}.png`);
  if (fs.existsSync(outPath)) return outPath;

  const toFileUrl = (p) => pathToFileURL(p).href;
  let html = fs.readFileSync(path.join(__dirname, 'template-background.html'), 'utf8');
  const tokens = {
    __FONT_DISPLAY__: toFileUrl(path.join(fontsDir, 'ChakraPetch-Bold.ttf')),
    __FONT_LABEL__: toFileUrl(path.join(fontsDir, 'ChakraPetch-SemiBold.ttf')),
    __FONT_MONO__: toFileUrl(path.join(fontsDir, 'IBMPlexMono-Regular.ttf')),
    __FONT_MONOBOLD__: toFileUrl(path.join(fontsDir, 'IBMPlexMono-Bold.ttf')),
    __BG_ACCENT__: accent,
    // La démo n'a pas le temps de se déclencher avant la capture (t=0) :
    // les valeurs exactes n'ont pas d'importance ici.
    __BG_DEMO_START__: 999999, __BG_DEMO_MS__: 3000, __BG_TOTAL_MS__: 1000000,
  };
  for (const [token, value] of Object.entries(tokens)) {
    html = replaceAll(html, token, String(value));
  }
  const tmpHtml = path.join(bgDir, `still-${accent}.tmp.html`);
  fs.writeFileSync(tmpHtml, html);

  const { chromium } = resolvePlaywright();
  const browser = await chromium.launch({ executablePath: chromiumExecutablePath() });
  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
    await page.goto(toFileUrl(tmpHtml));
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => window.__seek(0));
    await page.screenshot({ path: outPath });
    await browser.close();
  } catch (e) {
    try { await browser.close(); } catch (_) {}
    throw e;
  } finally {
    fs.rmSync(tmpHtml, { force: true });
  }
  return outPath;
}

// Mode voix off : synthétise la narration (ElevenLabs, avec l'alignement
// caractère par caractère), cale les sous-titres sur l'audio réel, et
// assemble le tout sur un fond fixe (pas de Chromium par post — juste une
// image tenue à l'écran + le mux audio + l'incrustation des sous-titres,
// en un seul passage ffmpeg).
//
// Simplification volontaire : pas de démo de barre de vie dans ce mode —
// l'ajouter proprement demanderait d'insérer un vrai silence dans l'audio
// pour caler une pause vidéo dessus (un chantier à part, pas fait ici).
async function renderVoiceVideo(content, opts) {
  const { base, outVideo, fontsDir, bin, log, bgDir, apiKey, voiceId, modelId, ttsImpl } = opts;

  const plan = buildVoicePlan(content);
  log('🎙️  Synthèse de la voix off (ElevenLabs)…');
  const synth = ttsImpl || synthesizeWithTimestamps;
  const { audioBuffer, starts, ends } = await synth({
    text: plan.narration, apiKey, voiceId, modelId,
  });
  const { times, ctaStart, totalMs } = plan.withAlignment(starts, ends);

  const audioPath = `${base}.narration.mp3`;
  fs.writeFileSync(audioPath, audioBuffer);

  const stillPath = await ensureStillBackground(content.accent, { fontsDir, bin, log, bgDir });

  const assPath = `${base}.ass`;
  fs.writeFileSync(assPath, buildAssVoice(content, { times, ctaStart, totalMs }), 'utf8');

  log(`🎬 Assemblage (voix + sous-titres, ${(totalMs / 1000).toFixed(1)} s)…`);
  try {
    execFileSync(bin, [
      '-y',
      '-loop', '1', '-framerate', '30', '-t', String(totalMs / 1000), '-i', stillPath,
      '-i', audioPath,
      '-vf', `ass=${escapeFfmpegPath(assPath)}:fontsdir=${escapeFfmpegPath(fontsDir)}`,
      '-map', '0:v:0', '-map', '1:a:0',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '160k',
      '-movflags', '+faststart',
      outVideo,
    ], { stdio: 'pipe' });
  } catch (e) {
    throw new Error('ffmpeg (assemblage voix off) a échoué : ' + (e.stderr || e.message));
  } finally {
    fs.rmSync(assPath, { force: true });
    fs.rmSync(audioPath, { force: true });
  }
}

// ── CLI ──────────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv.slice(2));
  let opts = {
    outDir: args.out || '.',
    onLog: (m) => console.log(m),
  };
  if (args.json) {
    opts.content = JSON.parse(fs.readFileSync(args.json, 'utf8'));
    opts.slug = path.basename(args.json).replace(/^hydra-video-|(-contenu)?\.json$/g, '');
  } else if (args.sujet) {
    opts.topic = String(args.sujet);
    opts.key = args.key || process.env.ANTHROPIC_API_KEY || process.env.HYDRA_ANTHROPIC_KEY;
  } else {
    console.error('Usage : node render-video.js --sujet "…"   (ou --json contenu.json)');
    process.exit(1);
  }
  // Voix off (optionnelle) : --elevenlabs-key/--voice-id, ou variables
  // d'environnement ELEVENLABS_API_KEY / ELEVENLABS_VOICE_ID.
  opts.elevenLabsKey = args['elevenlabs-key'] || process.env.ELEVENLABS_API_KEY;
  opts.voiceId = args['voice-id'] || process.env.ELEVENLABS_VOICE_ID;
  opts.elevenLabsModel = args['elevenlabs-model'] || process.env.ELEVENLABS_MODEL;
  const r = await generateVideo(opts);
  console.log('\n✅ Fini :');
  console.log('   ' + r.video);
  if (r.captionIg) console.log('   ' + r.captionIg);
  if (r.captionTt) console.log('   ' + r.captionTt);
  console.log('   ' + r.contentPath + '  (éditable → re-rendre avec --json)');
}

module.exports = { generateVideo, normalizeContent, callClaude, extractJSON, slugify };

if (require.main === module) {
  main().catch((e) => { console.error('Erreur :', e.message || e); process.exit(1); });
}
