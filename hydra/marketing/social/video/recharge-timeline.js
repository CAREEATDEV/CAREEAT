// Minutage du mode "voix off calée sur la recharge" (le mode gratuit : aucun
// sous-titre incrusté par nous — TikTok s'en charge après coup).
//
// Idée : la SEULE partie animée de la vidéo est la démo de recharge de la barre
// de vie (drain → refill, ~3,5 s), déclenchée à un instant FIXE et CONNU :
// t = 30 000 ms pile. On synthétise la voix off (ElevenLabs) sur la narration
// complète, on repère quand la phrase "recharge_line" démarre NATURELLEMENT
// dans l'audio, et on insère juste ce qu'il faut de silence avant elle pour
// que son début tombe exactement sur t=30 s — l'instant où la barre se recharge
// à l'écran. Voix et image parlent alors du même moment.
//
// Ce module ne fait AUCUN appel réseau : il construit le texte à synthétiser et,
// une fois l'alignement caractère-par-caractère d'ElevenLabs connu, calcule le
// padding et la durée totale. C'est volontairement testable sans crédits API.

const { speakable } = require('./voice-timeline');

// Instant fixe (ms) où la recharge de la barre commence dans la vidéo finale.
const RECHARGE_AT_MS = 30000;
// Durée de la fenêtre d'animation démo (drain→refill) capturée depuis
// template-background.html. La démo réelle dure ~3 s ; on capture un peu plus
// pour laisser la barre bien verte se stabiliser avant le plan fixe suivant.
const DEMO_MS = 3500;
// Silence de fin après le dernier mot (évite une coupe brutale ; il n'y a aucun
// CTA affiché dans ce mode, mais on laisse respirer).
const CTA_TAIL_HOLD = 2800;

// Construit le texte complet à synthétiser, dans l'ordre :
//   hook → lines[0..half) → recharge_line → lines[half..) → answer
// (même logique de split que le mode silencieux : half = ceil(n/2)).
// Retourne aussi les bornes [startChar, endChar) de chaque segment dans ce
// texte — en particulier celles de recharge_line, qui pilotent le calage.
function buildRechargeNarration(content) {
  const lines = Array.isArray(content.lines) ? content.lines : [];
  const half = Math.ceil(lines.length / 2);

  const segs = [
    { key: 'hook', text: speakable(content.hook) },
    ...lines.slice(0, half).map((l, i) => ({ key: `line${i}`, text: speakable(l) })),
    { key: 'recharge', text: speakable(content.recharge_line) },
    ...lines.slice(half).map((l, i) => ({ key: `line${half + i}`, text: speakable(l) })),
    { key: 'answer', text: speakable(content.answer) },
  ];

  let narration = '';
  const ranges = [];
  segs.forEach((seg, i) => {
    if (i > 0) narration += ' ';
    const start = narration.length;
    narration += seg.text;
    ranges.push({ key: seg.key, startChar: start, endChar: narration.length });
  });

  const rechargeRange = ranges.find((r) => r.key === 'recharge');
  return {
    narration,
    ranges,
    half,
    rechargeStartChar: rechargeRange.startChar,
    rechargeEndChar: rechargeRange.endChar,
  };
}

// Plan complet : narration à synthétiser + (une fois l'alignement connu) le
// padding audio et la durée totale.
function buildRechargePlan(content) {
  const { narration, ranges, half, rechargeStartChar, rechargeEndChar } =
    buildRechargeNarration(content);

  return {
    narration,
    ranges,
    half,
    rechargeStartChar,
    rechargeEndChar,

    // starts/ends : secondes par caractère (alignement ElevenLabs) du texte
    // EXACT ci-dessus. Renvoie tout ce qu'il faut pour assembler l'audio.
    withAlignment(starts, ends) {
      const clampStart = (i) => Math.max(0, Math.min(starts.length - 1, i));
      const clampEnd = (i) => Math.max(0, Math.min(ends.length - 1, i));

      // Départ NATUREL (non calé) de recharge_line dans l'audio brut.
      const naturalRechargeStartMs = starts[clampStart(rechargeStartChar)] * 1000;
      const rawAudioMs = ends[ends.length - 1] * 1000;

      // Silence à insérer AVANT recharge_line pour la caler pile à 30 s.
      const padMs = Math.max(0, RECHARGE_AT_MS - naturalRechargeStartMs);
      // Si padMs === 0, la narration précédente dépasse déjà 30 s : on ne peut
      // pas corriger en ajoutant du silence. On expose de combien pour un log.
      const lateMs = padMs === 0 ? naturalRechargeStartMs - RECHARGE_AT_MS : 0;

      const finalAudioMs = rawAudioMs + padMs;
      const totalMs = finalAudioMs + CTA_TAIL_HOLD;

      // Minutage de chaque segment dans l'audio FINAL (décalé de +padMs pour
      // tout ce qui est à/ après recharge_line). Pas utilisé pour incruster des
      // sous-titres dans ce mode, mais utile si on veut les réintroduire.
      const times = {};
      for (const r of ranges) {
        const shift = r.startChar >= rechargeStartChar ? padMs : 0;
        times[r.key] = {
          start: starts[clampStart(r.startChar)] * 1000 + shift,
          end: ends[clampEnd(r.endChar - 1)] * 1000 + shift,
        };
      }

      return {
        naturalRechargeStartMs,
        rawAudioMs,
        padMs,
        lateMs,
        finalAudioMs,
        totalMs,
        rechargeAtMs: RECHARGE_AT_MS,
        times,
      };
    },
  };
}

module.exports = {
  RECHARGE_AT_MS,
  DEMO_MS,
  CTA_TAIL_HOLD,
  buildRechargeNarration,
  buildRechargePlan,
};
