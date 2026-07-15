// Minutage partagé entre le fond pré-enregistré (template-background.html)
// et la génération des sous-titres (ass.js). Toute vidéo de fond, quelle que
// soit sa couleur d'accent, suit EXACTEMENT ce minutage — c'est ce qui permet
// de calibrer le script de Claude (nombre de lignes variable) sur une durée
// fixe, sans jamais avoir à retoucher la vidéo de fond elle-même.
//
// 0 ────────── HOOK_HOLD : le hook occupe l'écran seul (chrome statique)
// … TRANS : fondu de sortie du hook
// … LINES_A (2 lignes environ) … DEMO (barre qui draine puis remonte, ~3s)
// … LINES_B (lignes restantes) … ANSWER (réponse, punch) … CTA (jusqu'à la fin)

const HOOK_HOLD = 2500;
const TRANS = 400;
const LINES_A_START = HOOK_HOLD + TRANS; // 2900
const LINES_A_MS = 4000;
const DEMO_START = LINES_A_START + LINES_A_MS; // 6900
const DEMO_MS = 3000;
const LINES_B_START = DEMO_START + DEMO_MS; // 9900
const LINES_B_MS = 4000;
const ANSWER_GAP = 300;
const ANSWER_START = LINES_B_START + LINES_B_MS + ANSWER_GAP; // 14200
const ANSWER_TO_CTA = 1600;
const CTA_START = ANSWER_START + ANSWER_TO_CTA; // 15800
const CTA_HOLD = 2700;
const TOTAL_MS = CTA_START + CTA_HOLD; // 18500

const LINES_BUDGET_MS = LINES_A_MS + LINES_B_MS; // 8000 : combiné, sans le trou de la démo

// Convertit un instant "virtuel" continu (0..LINES_BUDGET_MS, comme si la
// démo n'existait pas) en instant réel, en sautant par-dessus le trou DEMO.
function mapLineTime(virtualMs) {
  return virtualMs < LINES_A_MS
    ? LINES_A_START + virtualMs
    : LINES_B_START + (virtualMs - LINES_A_MS);
}

// Répartit n lignes (3 à 5) sur le budget fixe : { start, end }[] en ms.
// Le nombre de lignes ne change JAMAIS la durée totale de la vidéo — seule
// la vitesse de défilement des lignes s'ajuste.
function computeLineTimes(n) {
  const step = LINES_BUDGET_MS / n;
  const times = [];
  for (let i = 0; i < n; i++) {
    times.push({
      start: mapLineTime(i * step),
      end: mapLineTime(Math.min((i + 1) * step, LINES_BUDGET_MS)),
    });
  }
  return times;
}

module.exports = {
  HOOK_HOLD, TRANS, LINES_A_START, LINES_A_MS, DEMO_START, DEMO_MS,
  LINES_B_START, LINES_B_MS, ANSWER_START, CTA_START, CTA_HOLD, TOTAL_MS,
  LINES_BUDGET_MS, computeLineTimes,
};
