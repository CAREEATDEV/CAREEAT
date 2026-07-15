#!/usr/bin/env node
// Test du mode "voix off calé sur la recharge" AVEC un alignement ElevenLabs
// SIMULÉ (débit constant), donc SANS aucun appel réseau ni crédit API.
//
//   node test-recharge.js
//
// Valide toute la mécanique :
//   1) le calcul du padding (recharge_line calée pile à t=30 s) ;
//   2) l'assemblage audio (découpe + silence inséré + concat) — durée finale ;
//   3) l'assemblage vidéo (still 30 s + démo + still-post) + le mux ;
//   4) par extraction de frames, que la démo se déclenche bien À 30 s (barre
//      statique dans la couleur d'accent avant, verte après la démo).
//
// La synthèse ElevenLabs est remplacée par un stub (ttsImpl) qui rend un audio
// SILENCIEUX de la bonne durée + un tableau starts/ends à 14 caractères/seconde.

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { execFileSync, spawnSync } = require('child_process');

const recharge = require('./recharge-timeline');
const { generateVideo } = require('./render-video');

const CPS = 14; // caractères par seconde (débit de parole simulé)

function ffmpegBin() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try { const b = require('ffmpeg-static'); if (b) return b; } catch (_) {}
  return 'ffmpeg';
}

// Alignement simulé : un start/end (en secondes) par caractère, débit constant.
function fakeAlignment(text) {
  const starts = [];
  const ends = [];
  for (let i = 0; i < text.length; i++) { starts.push(i / CPS); ends.push((i + 1) / CPS); }
  return { starts, ends };
}

// Stub de synthèse : audio SILENCIEUX (wav pcm) de la durée du texte au débit
// simulé + le même alignement. Aucun réseau.
function makeFakeSynth(bin, tmpDir) {
  return async ({ text }) => {
    const { starts, ends } = fakeAlignment(text);
    const durSec = text.length / CPS;
    const wav = path.join(tmpDir, 'fake-tts.wav');
    execFileSync(bin, ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono',
      '-t', durSec.toFixed(6), '-c:a', 'pcm_s16le', wav], { stdio: 'ignore' });
    return { audioBuffer: fs.readFileSync(wav), characters: text.split(''), starts, ends };
  };
}

function durationMs(bin, file) {
  const r = spawnSync(bin, ['-i', file], { encoding: 'utf8' });
  const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(r.stderr || '');
  if (!m) throw new Error('durée introuvable pour ' + file);
  return ((+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3])) * 1000;
}

// Couleur moyenne (rgb) de la bande de la barre de vie à l'instant tSec.
function barColor(bin, video, tSec) {
  const r = spawnSync(bin, ['-ss', tSec.toFixed(3), '-i', video, '-frames:v', '1',
    '-vf', 'crop=912:20:84:88,scale=1:1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
    { maxBuffer: 1 << 20 });
  const b = r.stdout;
  if (!b || b.length < 3) throw new Error('lecture couleur échouée à t=' + tSec);
  return { r: b[0], g: b[1], b: b[2] };
}

const CONTENT = {
  hook: "Et si *8 verres* d'eau par jour ne reposaient sur aucune preuve ?",
  accent: 'red', // rouge : barre bien distincte du vert d'après-recharge
  seg: 3,
  lines: [
    "Le chiffre vient d'une note de 1945, presque toujours mal citée.",
    "La note disait déjà que la nourriture couvre une grande part de l'apport.",
    "Ton café, ton thé et tes fruits comptent aussi dans le total.",
    "La couleur de ton urine en dit bien plus que huit verres.",
    "Chez l'adulte sain, la soif reste un signal fiable.",
    "Et boire trop dilue ton sodium : c'est un vrai risque, l'hyponatrémie.",
  ],
  answer: "Bois selon ta soif, pas selon un mythe de 1945.",
  recharge_line: "Là, on est en train de sécher — on recharge, on boit de l'eau.",
  cta_video: 'WAITLIST OUVERTE · LIEN EN BIO',
  caption_instagram: 'x',
  caption_tiktok: 'y',
};

function testMath() {
  console.log('1) Calcul du padding (alignement simulé)…');
  const plan = recharge.buildRechargePlan(CONTENT);
  const { starts, ends } = fakeAlignment(plan.narration);
  const al = plan.withAlignment(starts, ends);

  assert(al.padMs > 0, 'padMs devrait être > 0 pour ce script (recharge avant 30 s)');
  assert.strictEqual(Math.round(al.naturalRechargeStartMs + al.padMs), recharge.RECHARGE_AT_MS,
    'recharge_line doit tomber pile à 30 s après padding');
  assert.strictEqual(Math.round(al.finalAudioMs), Math.round(al.rawAudioMs + al.padMs));
  assert.strictEqual(Math.round(al.totalMs), Math.round(al.finalAudioMs + recharge.CTA_TAIL_HOLD));

  console.log(`   OK — naturel=${(al.naturalRechargeStartMs / 1000).toFixed(2)}s · ` +
    `pad=${(al.padMs / 1000).toFixed(2)}s · audio=${(al.finalAudioMs / 1000).toFixed(2)}s · ` +
    `total=${(al.totalMs / 1000).toFixed(2)}s`);
  return al;
}

async function testEndToEnd(al) {
  console.log('2-3) Assemblage audio + vidéo + mux (stub voix, sans réseau)…');
  const bin = ffmpegBin();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hydra-recharge-'));
  const r = await generateVideo({
    content: CONTENT,
    outDir: tmp,
    elevenLabsKey: 'test', voiceId: 'test',
    ttsImpl: makeFakeSynth(bin, tmp),
    onLog: (m) => console.log('   · ' + m),
  });
  assert(fs.existsSync(r.video), 'la vidéo doit exister');

  const dur = durationMs(bin, r.video);
  assert(Math.abs(dur - al.totalMs) < 500,
    `durée vidéo ${(dur / 1000).toFixed(2)}s ≠ total attendu ${(al.totalMs / 1000).toFixed(2)}s`);
  console.log(`   OK — durée vidéo ${(dur / 1000).toFixed(2)}s ≈ ${(al.totalMs / 1000).toFixed(2)}s`);

  console.log('4) Vérification que la démo se déclenche à t=30 s (extraction de frames)…');
  const before = barColor(bin, r.video, 29.9);          // encore statique → accent (rouge)
  const after = barColor(bin, r.video, 30 + recharge.DEMO_MS / 1000 + 0.3); // après démo → vert
  assert(before.r > before.g + 20,
    `à 29,9 s la barre devrait être ROUGE (accent) : ${JSON.stringify(before)}`);
  assert(after.g > after.r + 20,
    `après la démo la barre devrait être VERTE : ${JSON.stringify(after)}`);
  console.log(`   OK — 29,9s rouge ${JSON.stringify(before)} · après-démo vert ${JSON.stringify(after)}`);

  fs.rmSync(tmp, { recursive: true, force: true });
}

(async () => {
  try {
    const al = testMath();
    await testEndToEnd(al);
    console.log('\n✅ Tous les tests passent (padding + assemblage + calage démo à 30 s).');
  } catch (e) {
    console.error('\n❌ Test échoué :', e.message || e);
    process.exit(1);
  }
})();
