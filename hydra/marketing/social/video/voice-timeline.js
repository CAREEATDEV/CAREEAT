// Minutage du mode "voix off" : au lieu du minutage FIXE (timeline.js, utilisé
// quand il n'y a pas de voix), chaque segment (hook/ligne/réponse) est affiché
// EXACTEMENT pendant que la voix le prononce — calé sur l'alignement caractère
// par caractère renvoyé par ElevenLabs (elevenlabs.js).
//
// Pas de démo de barre de vie dans ce mode (simplification volontaire — la
// vidéo reste sur un fond fixe pendant toute la narration) : ça évite d'avoir
// à insérer un silence dans l'audio pour caler une pause vidéo dessus, ce qui
// serait un chantier à part.

const CTA_GAP = 500;   // silence après la fin de la réponse, avant le CTA
const CTA_HOLD = 3000;  // le CTA reste affiché après la fin de la narration

// texte "parlable" : retire les *astérisques* (marqueurs d'accent, pas destinés
// à être lus) — c'est CE texte qu'on envoie à ElevenLabs, pour que les indices
// de caractères correspondent exactement à ce qu'on découpe ici.
function speakable(text) {
  return String(text).replace(/\*/g, '');
}

// Construit le texte complet à synthétiser + les bornes [startChar, endChar)
// de chaque segment (hook, chaque ligne, réponse) dans ce texte.
function buildNarrationText(content) {
  const segments = [
    { key: 'hook', text: speakable(content.hook) },
    ...content.lines.map((l, i) => ({ key: `line${i}`, text: speakable(l) })),
    { key: 'answer', text: speakable(content.answer) },
  ];
  let narration = '';
  const ranges = [];
  segments.forEach((seg, i) => {
    if (i > 0) narration += ' ';
    const start = narration.length;
    narration += seg.text;
    ranges.push({ key: seg.key, startChar: start, endChar: narration.length });
  });
  return { narration, ranges };
}

// À partir de l'alignement ElevenLabs (starts/ends en secondes, un par
// caractère du texte envoyé), donne le [start,end] en ms de chaque segment.
function computeSegmentTimesMs(ranges, starts, ends) {
  const msFor = (charIdx) => {
    const i = Math.max(0, Math.min(starts.length - 1, charIdx));
    return starts[i] * 1000;
  };
  const msForEnd = (charIdxExclusive) => {
    const i = Math.max(0, Math.min(ends.length - 1, charIdxExclusive - 1));
    return ends[i] * 1000;
  };
  const times = {};
  for (const r of ranges) {
    times[r.key] = { start: msFor(r.startChar), end: msForEnd(r.endChar) };
  }
  return times;
}

// Assemble le plan complet : narration à synthétiser + (une fois l'alignement
// connu) le minutage final des segments + le minutage du CTA/durée totale.
function buildVoicePlan(content) {
  const { narration, ranges } = buildNarrationText(content);
  return {
    narration,
    withAlignment(starts, ends) {
      const times = computeSegmentTimesMs(ranges, starts, ends);
      const answerEnd = times.answer.end;
      const ctaStart = answerEnd + CTA_GAP;
      const totalMs = ctaStart + CTA_HOLD;
      return { times, ctaStart, totalMs };
    },
  };
}

module.exports = { speakable, buildNarrationText, computeSegmentTimesMs, buildVoicePlan, CTA_GAP, CTA_HOLD };
