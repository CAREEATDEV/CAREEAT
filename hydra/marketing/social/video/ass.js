// Construit le fichier de sous-titres (.ass / libass) incrusté sur le fond
// pré-enregistré. Une seule "case" de texte à la fois (hook → chaque ligne
// → réponse) : chaque entrée REMPLACE la précédente au même endroit, plutôt
// que de s'empiler — plus lisible en format vertical, et ça évite d'avoir à
// mesurer le nombre de lignes de wrap de chaque bloc pour les empiler.
const timeline = require('./timeline');

const ACCENTS = { green: '#3EE07A', amber: '#FFB020', red: '#FF3B4A', poison: '#B44CFF' };
const TEXT_HEX = '#EDEFF2';

// Zones (mesurées sur template-background.html à 1080x1350) :
// eyebrow finit à y=184 ; flèche CTA en x=84-104 / y=1183-1227.
const PAD_H = 84;
const CAPTION_TOP = 230;  // hook + lignes (même case, l'une remplace l'autre)
const ANSWER_TOP = 520;
const CTA_POS = { x: 120, y: 1205 }; // juste à droite de la flèche, centré verticalement dessus

// "#RRGGBB" → "BBGGRR" (ordre des couleurs ASS/libass).
function hexToBgrDigits(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  const h = (m ? m[1] : 'ffffff').toUpperCase();
  return h.slice(4, 6) + h.slice(2, 4) + h.slice(0, 2);
}
// Couleur pour un champ de style ([V4+ Styles]) : "&H00BBGGRR&"
function hexToBgr(hex) {
  return `&H00${hexToBgrDigits(hex)}&`;
}
// Override inline dans un Dialogue (sans le & final) : "\c&HBBGGRR&"
function assColorTag(hex) {
  return `\\c&H${hexToBgrDigits(hex)}&`;
}

function assEscape(s) {
  return String(s)
    .replace(/\\/g, '∖') // pas de backslash brut dans le texte
    .replace(/\{/g, '(').replace(/\}/g, ')')
    .replace(/\r?\n/g, '\\N');
}

// "Et si *8 verres* n'ont aucune base ?" → texte ASS avec le run entre
// astérisques coloré en accent (tags \c, remis à la couleur par défaut après).
function tokenizeToAss(text, accentHex, defaultHex) {
  const parts = String(text).split('*');
  return parts.map((part, i) => {
    const esc = assEscape(part);
    if (!esc) return '';
    return i % 2 === 1
      ? `{${assColorTag(accentHex)}}${esc}{${assColorTag(defaultHex)}}`
      : esc;
  }).join('');
}

function formatAssTime(ms) {
  const cs = Math.round(ms / 10);
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  const c = cs % 100;
  const pad = (n, l = 2) => String(n).padStart(l, '0');
  return `${h}:${pad(m)}:${pad(s)}.${pad(c)}`;
}

function dialogue(style, startMs, endMs, overrideTags, text) {
  return `Dialogue: 0,${formatAssTime(startMs)},${formatAssTime(endMs)},${style},,0,0,0,,` +
    `{${overrideTags}}${text}`;
}

function header(accentHex) {
  const textStyleColor = hexToBgr(TEXT_HEX);
  const accentStyleColor = hexToBgr(accentHex);
  return `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1350
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: None

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,Chakra Petch,66,${textStyleColor},&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,7,${PAD_H},${PAD_H},${CAPTION_TOP},1
Style: Answer,Chakra Petch,64,${accentStyleColor},&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,7,${PAD_H},${PAD_H},${ANSWER_TOP},1
Style: Cta,Chakra Petch,28,${textStyleColor},&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,2,0,1,0,0,4,${PAD_H},${PAD_H},0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;
}

function answerTags() {
  return `\\fad(300,0)\\t(0,150,\\fscx106\\fscy106)\\t(150,320,\\fscx100\\fscy100)`;
}
function ctaTags() {
  return `\\an4\\pos(${CTA_POS.x},${CTA_POS.y})\\fad(300,0)`;
}

// Mode silencieux (par défaut) : minutage FIXE (timeline.js), calibré pour
// remplir exactement la durée du fond pré-enregistré.
function buildAss(content) {
  const accentHex = ACCENTS[content.accent] || ACCENTS.green;
  const lineTimes = timeline.computeLineTimes(content.lines.length);
  const events = [];

  events.push(dialogue('Caption', 0, timeline.LINES_A_START,
    `\\fad(0,250)`, tokenizeToAss(content.hook, accentHex, TEXT_HEX)));

  content.lines.forEach((line, i) => {
    const { start, end } = lineTimes[i];
    events.push(dialogue('Caption', start, end,
      `\\fad(180,120)`, tokenizeToAss(line, accentHex, TEXT_HEX)));
  });

  events.push(dialogue('Answer', timeline.ANSWER_START, timeline.TOTAL_MS,
    answerTags(), assEscape(String(content.answer).replace(/\*/g, ''))));

  events.push(dialogue('Cta', timeline.CTA_START, timeline.TOTAL_MS,
    ctaTags(), assEscape(content.cta_video)));

  return `${header(accentHex)}\n${events.join('\n')}\n`;
}

// Mode voix off : minutage RÉEL, dérivé de l'alignement caractère par
// caractère renvoyé par ElevenLabs (voice-timeline.js) — chaque segment
// s'affiche exactement pendant que la voix le prononce.
// `plan` = résultat de voice-timeline's buildVoicePlan(content).withAlignment(...)
function buildAssVoice(content, plan) {
  const accentHex = ACCENTS[content.accent] || ACCENTS.green;
  const { times, ctaStart, totalMs } = plan;
  const events = [];

  events.push(dialogue('Caption', times.hook.start, times.hook.end,
    `\\fad(120,180)`, tokenizeToAss(content.hook, accentHex, TEXT_HEX)));

  content.lines.forEach((line, i) => {
    const t = times[`line${i}`];
    events.push(dialogue('Caption', t.start, t.end,
      `\\fad(120,120)`, tokenizeToAss(line, accentHex, TEXT_HEX)));
  });

  events.push(dialogue('Answer', times.answer.start, totalMs,
    answerTags(), assEscape(String(content.answer).replace(/\*/g, ''))));

  events.push(dialogue('Cta', ctaStart, totalMs,
    ctaTags(), assEscape(content.cta_video)));

  return `${header(accentHex)}\n${events.join('\n')}\n`;
}

module.exports = { buildAss, buildAssVoice, assColorTag, hexToBgr, tokenizeToAss, formatAssTime };
