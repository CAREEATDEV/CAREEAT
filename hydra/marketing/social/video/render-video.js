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
const { buildAss } = require('./ass');
const recharge = require('./recharge-timeline');
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

MISSION : à partir d'un simple sujet, tu écris le contenu d'une VIDÉO verticale longue (~60 s, format "réel explicatif") pour TikTok/Instagram — assez de temps pour une explication scientifique AUSSI DÉTAILLÉE qu'une légende complète (plusieurs mécanismes distincts, études citées avec leur nom quand tu en trouves une). Structure : (1) une ACCROCHE en 3 temps (~3 s), (2) l'explication révélée À L'ÉCRAN, une ligne à la fois (le nombre de lignes s'adapte automatiquement à la durée fixe de la vidéo), (3) la réponse/synthèse finale, puis un CTA waitlist.

MÉTHODE :
1. Utilise l'outil web_search pour VÉRIFIER les faits, chiffres et mécanismes (physiologie, études nommées — auteur/année/revue si tu en trouves une, indices comme le Beverage Hydration Index, échelle d'Armstrong, etc.). Ne cite jamais une statistique précise sans l'avoir vérifiée. Si un chiffre exact reste incertain, reste qualitatif plutôt que d'inventer.
2. Trie et STRUCTURE en plusieurs mécanismes/angles distincts (comme un mini-article) plutôt qu'un seul argument répété — vise la même densité d'information qu'une légende Instagram complète, mais découpée en lignes courtes à l'écran.

MÉCANIQUE D'ACCROCHE (méthode Kallaway — 3 temps, appris de milliers de vidéos virales) :
Les 3 premières secondes décident de tout. L'accroche n'est PAS une simple question : c'est une structure en 3 temps qui ouvre une "boucle de curiosité" (un écart entre ce que les gens croient et ce que tu tease) :
  (a) CONTEXT LEAN — tu poses le sujet net, en très peu de mots. On sait immédiatement de quoi ça parle.
  (b) SCROLL-STOP — une interjection de CONTRASTE (souvent "mais", "sauf que", "sauf qu'en vrai") qui stoppe le pouce et casse l'attente.
  (c) SNAPBACK — le retournement qui inverse ce que le spectateur croyait savoir et donne envie de rester pour la révélation.
Chaque temps est TRÈS court (idéalement 3 à 7 mots). Front-load l'ENJEU : dès l'accroche, on comprend pourquoi ça nous concerne (la conséquence avant la cause). INTERDIT : le "slow build" (mise en contexte lente), se présenter ("Salut, ici HYDRA"), les généralités molles. On entre direct dans le vif.

MÉCANIQUE (rétention du reste) :
- Les LIGNES déroulent l'explication complète, mécanisme après mécanisme : chacune est une phrase autonome, lisible en ~4-5 s. Ce texte est INCRUSTÉ dans la vidéo (pas en description).
- BOUCLES OUVERTES EN CONTINU : ne fais pas une liste plate. Toutes les 2-3 lignes, ré-ouvre une micro-boucle de curiosité ("mais ce n'est pas le pire…", "et c'est là que ça devient absurde…", "sauf que ton corps fait l'inverse…") pour retenir jusqu'au bout.
- SPÉCIFICITÉ : des chiffres/noms concrets et vérifiés rendent le propos crédible et "réel". C'est ta meilleure arme, utilise-la à chaque fois que tu peux.
- IMAGES CONCRÈTES, ZÉRO JARGON (règle NON négociable) : traduis CHAQUE mécanisme en une image du quotidien — le corps est une machine, une usine, une batterie, un filtre, une éponge, une alarme incendie. Un terme technique (acétaldéhyde, ADH, osmolarité, cytokines, vasopressine…) ne doit JAMAIS rester nu : soit tu le remplaces par l'image, soit tu le fais suivre IMMÉDIATEMENT de sa traduction concrète. Ex : "ton foie, c'est ton unique usine de nettoyage de l'alcool", "l'eau ressort aussitôt, comme dans une éponge déjà pleine". Un ado de 12 ans doit tout comprendre à la première écoute, sans pause. Le chiffre/l'étude vérifiés restent la PREUVE, mais toujours EMBALLÉS dans l'image — jamais à la place de l'image.
- La RÉPONSE/SYNTHÈSE ferme la boucle ouverte par l'accroche : une phrase de conclusion, cash, qui paie l'attente.

TU RENDS UNIQUEMENT un objet JSON valide (aucun texte autour, aucune balise markdown), avec EXACTEMENT ces clés :
{
  "hook_context":  "temps 1 (context lean) : pose le sujet, 3 à 7 mots, français.",
  "hook_stop":     "temps 2 (scroll-stop) : interjection de contraste courte (souvent avec 'mais'/'sauf que'), 3 à 7 mots.",
  "hook_snapback": "temps 3 (snapback) : le retournement qui inverse l'attente, 3 à 8 mots. Entoure LE mot/chiffre choc d'astérisques *comme ça*. NE DONNE PAS encore la réponse complète.",
  "accent":"une seule valeur parmi: green, red, amber, poison. green=conseil/bonne nouvelle · red=mythe à casser/chiffre choc/alerte · amber=nuance · poison=tout sujet lié à l'alcool.",
  "seg":   "(informatif seulement, sans effet visuel) entier de 2 à 7.",
  "lines": ["7 à 10 lignes (8 à 16 mots chacune) qui déroulent l'explication scientifique COMPLÈTE : plusieurs mécanismes/études distincts, dans l'ordre logique, comme les paragraphes d'un article condensés en phrases courtes, CHACUNE en image concrète (règle zéro jargon ci-dessus) et AVEC des boucles ouvertes régulières. Astérisques *autorisées* pour 1 mot/chiffre clé par ligne max. La dernière ligne prépare la réponse sans la donner."],
  "answer":"LA réponse/synthèse finale qui ferme la boucle du hook, une seule phrase percutante (6 à 14 mots). Astérisques autorisées sur le mot clé.",
  "recharge_line":"phrase COURTE (8 à 14 mots) qui fait explicitement référence à l'app/l'hydratation AU MOMENT où la barre de vie se recharge à l'écran — ex: \\"Attention, on est en train de sécher. On recharge, on va boire de l'eau.\\". Elle s'insère AU MILIEU de la narration (après le hook et la moitié des lignes) : elle doit sonner NATUREL dans le flux, comme une respiration/transition, pas plaquée. Garde le hook + la première moitié des lignes assez ramassés pour qu'à voix haute cette phrase arrive autour de 30 s.",
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

// Modèles Claude autorisés (alias court → identifiant API). Sonnet = défaut :
// meilleur rapport qualité/prix pour écrire le script (la recherche web fournit
// les faits, le modèle ne fait que synthétiser + rédiger en français).
const CLAUDE_MODELS = {
  sonnet: 'claude-sonnet-4-6', // $3 / $15  — recommandé
  haiku: 'claude-haiku-4-5',   // $1 / $5   — le moins cher
  opus: 'claude-opus-4-8',     // $5 / $25  — le plus puissant (coûteux)
};
const DEFAULT_CLAUDE_MODEL = CLAUDE_MODELS.sonnet;
// Plafond de recherches web : chaque recherche est facturée ET renvoie tout le
// contexte accumulé au modèle → limiter = gros levier de coût.
const WEB_SEARCH_MAX_USES = 4;

function resolveClaudeModel(m) {
  if (!m) return DEFAULT_CLAUDE_MODEL;
  const key = String(m).trim().toLowerCase();
  if (CLAUDE_MODELS[key]) return CLAUDE_MODELS[key];
  if (/^claude-/.test(key)) return String(m).trim();
  return DEFAULT_CLAUDE_MODEL;
}

async function callClaude(topic, key, model) {
  const resolvedModel = resolveClaudeModel(model);
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
        model: resolvedModel,
        max_tokens: 5000,
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: WEB_SEARCH_MAX_USES }],
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

  // Accroche méthode Kallaway : 3 temps (context → scroll-stop → snapback).
  // On les garde séparés (éditables dans le JSON) MAIS on assemble aussi un
  // `hook` unique pour rester compatible avec tout le reste du pipeline
  // (ass.js, voice-timeline.js lisent content.hook). Rétro-compatible : un
  // ancien contenu qui n'a que `hook` continue de marcher.
  const beats = [c.hook_context, c.hook_stop, c.hook_snapback]
    .map((x) => (x == null ? '' : String(x).trim()))
    .filter(Boolean);
  const hook = beats.length ? beats.join(' ') : String(c.hook || '').trim();

  if (!hook || !c.answer || !Array.isArray(c.lines) || c.lines.length < 4) {
    throw new Error('Contenu incomplet (hook (ou 3 temps) / lines[4+] / answer requis) : ' + JSON.stringify(c));
  }
  return {
    hook,
    // Conservés pour édition/relecture ; sans effet s'ils sont vides.
    hook_context: c.hook_context ? String(c.hook_context).trim() : '',
    hook_stop: c.hook_stop ? String(c.hook_stop).trim() : '',
    hook_snapback: c.hook_snapback ? String(c.hook_snapback).trim() : '',
    accent: ACCENTS.includes(String(c.accent).toLowerCase())
      ? String(c.accent).toLowerCase() : 'green',
    seg: Math.max(2, Math.min(7, parseInt(c.seg, 10) || 6)),
    lines: c.lines.slice(0, 10).map(String),
    answer: String(c.answer),
    // Phrase dite pile au moment où la barre se recharge (t=30s) en mode voix
    // off. Repli pour les anciens contenus.json générés avant ce champ.
    recharge_line: String(
      c.recharge_line ||
        "Là, on est en train de sécher — on recharge, on boit de l'eau."
    ),
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
    const model = resolveClaudeModel(opts.claudeModel);
    log(`⏳ Recherche scientifique + écriture (${model})… 30-60 s`);
    content = normalizeContent(extractJSON(await callClaude(String(opts.topic), opts.key, model)));
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
  if (!h264) {
    throw new Error('Ton ffmpeg ne sait pas encoder en H.264 (libx264 manquant).');
  }
  // libass n'est requis QUE pour le mode silencieux (sous-titres incrustés).
  // Le mode voix off calé sur la recharge n'incruste aucun sous-titre.
  const voiceMode = !!(opts.elevenLabsKey && opts.voiceId);
  if (!voiceMode && !ass) {
    throw new Error(
      'Ton ffmpeg ne supporte pas les sous-titres incrustés (libass). ' +
      'Réinstalle : npm install ffmpeg-static@latest (ou installe un ffmpeg ' +
      'compilé avec --enable-libass).');
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
    // Chemins RELATIFS (via cwd = outDir) dans le filtre `ass` : sur Windows,
    // un chemin absolu contient le ":" du lecteur (C:\) qui casse le parseur de
    // filtergraph de ffmpeg même échappé. En relatif, plus aucun ":" à gérer.
    const rel = (p) => path.relative(outDir, p).replace(/\\/g, '/') || '.';
    const assRel = rel(assPath);
    const fontsRel = rel(fontsDir);
    try {
      execFileSync(bin, [
        '-y', '-i', bgPath,
        '-vf', `ass=${assRel}:fontsdir=${fontsRel}`,
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
        '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
        outVideo,
      ], { stdio: 'pipe', cwd: outDir });
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

// Fenêtre d'animation démo (drain → refill) seule, capturée depuis
// template-background.html en injectant DEMO_START=0 : c'est le SEUL bout de
// vidéo animé du mode voix off. Rendue une fois par couleur, mise en cache.
async function ensureDemo(accent, { fontsDir, bin, log, bgDir }) {
  fs.mkdirSync(bgDir, { recursive: true });
  const outPath = path.join(bgDir, `demo-${accent}.mp4`);
  if (fs.existsSync(outPath)) return outPath;

  log(`🎨 Préparation de la démo « ${accent} » (une fois)…`);
  const framesDir = await captureBackgroundFrames(accent, {
    fontsDir, bgDir, tag: 'demo',
    demoStart: 0, demoMs: recharge.DEMO_MS, totalMs: recharge.DEMO_MS,
    fromMs: 0, toMs: recharge.DEMO_MS, fps: 30,
  });
  execFileSync(bin, [
    '-y', '-framerate', '30',
    '-i', path.join(framesDir, 'frame%05d.png'),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '16',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', outPath,
  ], { stdio: 'ignore' });
  fs.rmSync(framesDir, { recursive: true, force: true });
  return outPath;
}

// Image fixe juste APRÈS la démo : barre pleine et VERTE (la démo se termine
// toujours en vert quelle que soit la couleur ; seuls l'eyebrow/la flèche CTA
// gardent la couleur d'accent). Un seul screenshot au seek DEMO_MS.
async function ensureStillPost(accent, { fontsDir, bin, log, bgDir }) {
  fs.mkdirSync(bgDir, { recursive: true });
  const outPath = path.join(bgDir, `still-post-${accent}.png`);
  if (fs.existsSync(outPath)) return outPath;

  const framesDir = await captureBackgroundFrames(accent, {
    fontsDir, bgDir, tag: 'stillpost',
    demoStart: 0, demoMs: recharge.DEMO_MS, totalMs: recharge.DEMO_MS,
    fromMs: recharge.DEMO_MS, toMs: recharge.DEMO_MS, fps: 30, single: true,
  });
  fs.copyFileSync(path.join(framesDir, 'frame00000.png'), outPath);
  fs.rmSync(framesDir, { recursive: true, force: true });
  return outPath;
}

// Rend template-background.html (Chromium) et capture, frame par frame en
// forçant currentTime (déterministe), la fenêtre [fromMs, toMs] à `fps`.
// `single` : une seule frame (au seek fromMs). Retourne le dossier de frames.
async function captureBackgroundFrames(accent, opts) {
  const { fontsDir, bgDir, tag, demoStart, demoMs, totalMs, fromMs, toMs, fps, single } = opts;
  const toFileUrl = (p) => pathToFileURL(p).href;
  let html = fs.readFileSync(path.join(__dirname, 'template-background.html'), 'utf8');
  const tokens = {
    __FONT_DISPLAY__: toFileUrl(path.join(fontsDir, 'ChakraPetch-Bold.ttf')),
    __FONT_LABEL__: toFileUrl(path.join(fontsDir, 'ChakraPetch-SemiBold.ttf')),
    __FONT_MONO__: toFileUrl(path.join(fontsDir, 'IBMPlexMono-Regular.ttf')),
    __FONT_MONOBOLD__: toFileUrl(path.join(fontsDir, 'IBMPlexMono-Bold.ttf')),
    __BG_ACCENT__: accent,
    __BG_DEMO_START__: demoStart,
    __BG_DEMO_MS__: demoMs,
    __BG_TOTAL_MS__: totalMs,
  };
  for (const [token, value] of Object.entries(tokens)) {
    html = replaceAll(html, token, String(value));
  }
  const tmpHtml = path.join(bgDir, `${tag}-${accent}.tmp.html`);
  fs.writeFileSync(tmpHtml, html);

  const framesDir = path.join(bgDir, `${tag}-${accent}.frames`);
  const { chromium } = resolvePlaywright();
  const browser = await chromium.launch({ executablePath: chromiumExecutablePath() });
  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
    await page.goto(toFileUrl(tmpHtml));
    await page.evaluate(() => document.fonts.ready);

    fs.rmSync(framesDir, { recursive: true, force: true });
    fs.mkdirSync(framesDir, { recursive: true });

    if (single) {
      await page.evaluate((ms) => window.__seek(ms), fromMs);
      await page.screenshot({ path: path.join(framesDir, 'frame00000.png') });
    } else {
      const frameCount = Math.ceil(((toMs - fromMs) / 1000) * fps);
      for (let f = 0; f < frameCount; f++) {
        await page.evaluate((ms) => window.__seek(ms), fromMs + (f * 1000) / fps);
        await page.screenshot({ path: path.join(framesDir, `frame${String(f).padStart(5, '0')}.png`) });
      }
    }
    await browser.close();
  } catch (e) {
    try { await browser.close(); } catch (_) {}
    throw e;
  } finally {
    fs.rmSync(tmpHtml, { force: true });
  }
  return framesDir;
}

// Assemble l'audio final : découpe l'audio brut au départ NATUREL de
// recharge_line, insère `padMs` de silence entre les deux moitiés → recharge_line
// démarre pile à 30 s. Sortie AAC (.m4a). Si padMs<=0, ré-encode tel quel.
function buildPaddedAudio({ bin, rawAudioPath, audioPath, splitMs, padMs }) {
  if (padMs <= 0) {
    execFileSync(bin, ['-y', '-i', rawAudioPath,
      '-c:a', 'aac', '-b:a', '160k', audioPath], { stdio: 'pipe' });
    return;
  }
  const splitSec = (splitMs / 1000).toFixed(6);
  const padSec = (padMs / 1000).toFixed(6);
  const fmt = 'aformat=sample_rates=44100:channel_layouts=mono';
  const fc =
    `[0:a]atrim=end=${splitSec},asetpts=PTS-STARTPTS,${fmt}[a0];` +
    `[0:a]atrim=start=${splitSec},asetpts=PTS-STARTPTS,${fmt}[a1];` +
    `[1:a]atrim=end=${padSec},asetpts=PTS-STARTPTS,${fmt}[sil];` +
    `[a0][sil][a1]concat=n=3:v=0:a=1[out]`;
  execFileSync(bin, ['-y',
    '-i', rawAudioPath,
    '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono',
    '-filter_complex', fc, '-map', '[out]',
    '-c:a', 'aac', '-b:a', '160k', audioPath], { stdio: 'pipe' });
}

// Assemble le fond vidéo (still → demo → still-post, homogénéisés puis
// concaténés) et le mux avec l'audio final, en UN SEUL appel ffmpeg. Aucun
// sous-titre incrusté (c'est tout l'intérêt : TikTok s'en charge après coup).
// Durée vidéo = preMs + DEMO_MS + restMs (= totalMs) ; l'audio est plus court
// de CTA_TAIL_HOLD → petit silence de fin, pas de coupe brutale.
function assembleVoiceoverVideo({ bin, still, demo, stillPost, audioPath, outVideo, preMs, restMs }) {
  const preSec = (preMs / 1000).toFixed(6);
  const restSec = (Math.max(0, restMs) / 1000).toFixed(6);
  const norm = (label) =>
    `fps=30,scale=1080:1350:force_original_aspect_ratio=decrease,` +
    `pad=1080:1350:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p[${label}]`;
  const fc =
    `[0:v]${norm('v0')};[1:v]${norm('v1')};[2:v]${norm('v2')};` +
    `[v0][v1][v2]concat=n=3:v=1:a=0[v]`;
  try {
    execFileSync(bin, ['-y',
      '-loop', '1', '-t', preSec, '-i', still,
      '-i', demo,
      '-loop', '1', '-t', restSec, '-i', stillPost,
      '-i', audioPath,
      '-filter_complex', fc,
      '-map', '[v]', '-map', '3:a:0',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '160k',
      '-movflags', '+faststart',
      outVideo,
    ], { stdio: 'pipe' });
  } catch (e) {
    throw new Error('ffmpeg (assemblage voix off) a échoué : ' + (e.stderr || e.message));
  }
}

// Mode voix off (gratuit, sans sous-titre incrusté) :
//   1) Claude a écrit une recharge_line dite pile quand la barre se recharge.
//   2) ElevenLabs synthétise toute la narration + l'alignement par caractère.
//   3) On insère du silence avant recharge_line pour la caler à t=30 000 ms.
//   4) On assemble still(0→30s) + demo(~3,5s) + still-post(reste) + l'audio.
// Aucun sous-titre : l'utilisateur poste sur TikTok, active les sous-titres
// auto (recentrés à la main), télécharge, puis repost sur Instagram.
async function renderVoiceVideo(content, opts) {
  const { base, outVideo, fontsDir, bin, log, bgDir, apiKey, voiceId, modelId, ttsImpl } = opts;

  // 1) Narration (hook → moitié lignes → recharge → reste → answer).
  const plan = recharge.buildRechargePlan(content);
  log('🎙️  Synthèse de la voix off (ElevenLabs)…');
  const synth = ttsImpl || synthesizeWithTimestamps;
  const { audioBuffer, starts, ends } = await synth({
    text: plan.narration, apiKey, voiceId, modelId,
  });
  const al = plan.withAlignment(starts, ends);
  if (al.lateMs > 0) {
    log(`⚠️  recharge_line arrive à ${(al.naturalRechargeStartMs / 1000).toFixed(1)} s ` +
      `(> 30 s) : pas de silence ajouté, désync possible de ${Math.round(al.lateMs)} ms. ` +
      `Raccourcis le hook ou les premières lignes.`);
  }

  // 2) Audio final : recharge_line calée pile à 30 s.
  const rawAudioPath = `${base}.raw.mp3`;
  fs.writeFileSync(rawAudioPath, audioBuffer);
  const audioPath = `${base}.narration.m4a`;
  buildPaddedAudio({
    bin, rawAudioPath, audioPath,
    splitMs: al.naturalRechargeStartMs, padMs: al.padMs,
  });

  // 3) Les 3 morceaux de fond de cette couleur (générés une fois, en cache).
  const still = await ensureStillBackground(content.accent, { fontsDir, bin, log, bgDir });
  const demo = await ensureDemo(content.accent, { fontsDir, bin, log, bgDir });
  const stillPost = await ensureStillPost(content.accent, { fontsDir, bin, log, bgDir });

  // 4) Assemblage final (fond concaténé + mux audio), durée = totalMs.
  const restMs = al.totalMs - recharge.RECHARGE_AT_MS - recharge.DEMO_MS;
  log(`🎬 Assemblage (voix + démo calée à 30 s, ${(al.totalMs / 1000).toFixed(1)} s)…`);
  try {
    assembleVoiceoverVideo({
      bin, still, demo, stillPost, audioPath, outVideo,
      preMs: recharge.RECHARGE_AT_MS, restMs,
    });
  } finally {
    fs.rmSync(rawAudioPath, { force: true });
    fs.rmSync(audioPath, { force: true });
  }
}

// ── CLI ──────────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Pré-génère (et met en cache) tous les fonds : silencieux (bg-<accent>.mp4)
  // + voix off (still-/demo-/still-post-<accent>). À lancer après une refonte
  // de template-background.html pour recommiter les fonds à jour.
  //   node render-video.js --prebuild            (les 4 modes voix off)
  //   node render-video.js --prebuild --silent   (inclut aussi bg-*.mp4, ~2min/couleur)
  if (args.prebuild) {
    const { bin } = resolveFfmpeg();
    const fontsDir = path.join(__dirname, '..', '..', '..', 'assets', 'fonts');
    const bgDir = path.join(__dirname, 'backgrounds');
    const log = (m) => console.log(m);
    for (const accent of ['green', 'amber', 'red', 'poison']) {
      await ensureStillBackground(accent, { fontsDir, bin, log, bgDir });
      await ensureDemo(accent, { fontsDir, bin, log, bgDir });
      await ensureStillPost(accent, { fontsDir, bin, log, bgDir });
      if (args.silent) await ensureBackground(accent, { fontsDir, bin, log, bgDir });
      console.log(`✓ ${accent}`);
    }
    console.log('\n✅ Fonds prêts dans backgrounds/.');
    return;
  }

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
    // Modèle Claude : --modele sonnet|haiku|opus (défaut : sonnet). Réduit le coût.
    opts.claudeModel = args.modele || args.model || process.env.HYDRA_CLAUDE_MODEL;
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

module.exports = {
  generateVideo, normalizeContent, callClaude, extractJSON, slugify,
  resolveClaudeModel, CLAUDE_MODELS, DEFAULT_CLAUDE_MODEL,
};

if (require.main === module) {
  main().catch((e) => { console.error('Erreur :', e.message || e); process.exit(1); });
}
