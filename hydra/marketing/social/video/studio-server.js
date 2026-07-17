#!/usr/bin/env node
// HYDRA — mini-studio vidéo local (interface, zéro terminal par vidéo).
// Lance ce serveur UNE fois (double-clic sur le lanceur ou `npm run studio`),
// il ouvre une page dans le navigateur : tu tapes le sujet, tu cliques, tu
// récupères la vidéo MP4 + les légendes. Réutilise le pipeline render-video.js.
//
// Rien ne sort de ta machine sauf l'appel à l'API Claude (avec ta propre clé).

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');
const { generateVideo } = require('./render-video');

const OUT_DIR = path.join(__dirname, 'out');
fs.mkdirSync(OUT_DIR, { recursive: true });
const PORT = parseInt(process.env.PORT, 10) || 4599;

const CT = {
  '.html': 'text/html; charset=utf-8', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.txt': 'text/plain; charset=utf-8', '.json': 'application/json',
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 5e5) reject(new Error('payload too large'));
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Page UI
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    const html = fs.readFileSync(path.join(__dirname, 'studio.html'), 'utf8');
    res.writeHead(200, { 'Content-Type': CT['.html'] });
    return res.end(html);
  }

  // Fichiers générés (aperçu / téléchargement) — restreint à OUT_DIR.
  if (req.method === 'GET' && url.pathname.startsWith('/out/')) {
    const name = path.basename(decodeURIComponent(url.pathname.slice(5)));
    const file = path.join(OUT_DIR, name);
    if (!file.startsWith(OUT_DIR) || !fs.existsSync(file)) {
      res.writeHead(404); return res.end('not found');
    }
    const ext = path.extname(file).toLowerCase();
    const headers = { 'Content-Type': CT[ext] || 'application/octet-stream' };
    if (url.searchParams.get('dl')) headers['Content-Disposition'] = `attachment; filename="${name}"`;
    res.writeHead(200, headers);
    return fs.createReadStream(file).pipe(res);
  }

  // Génération : NDJSON en flux (une ligne JSON par événement de progression).
  if (req.method === 'POST' && url.pathname === '/api/generate') {
    res.writeHead(200, { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache' });
    const emit = (o) => res.write(JSON.stringify(o) + '\n');
    try {
      const body = JSON.parse(await readBody(req) || '{}');
      const opts = { outDir: OUT_DIR, onLog: (m) => emit({ log: m }) };
      if (body.contentJson) {
        opts.content = typeof body.contentJson === 'string'
          ? JSON.parse(body.contentJson) : body.contentJson;
        opts.slug = body.slug;
      } else {
        if (!body.topic || !body.topic.trim()) throw new Error('Écris un sujet.');
        if (!body.key || !body.key.trim()) throw new Error('Colle ta clé API Anthropic.');
        opts.topic = body.topic.trim();
        opts.key = body.key.trim();
        if (body.claudeModel) opts.claudeModel = String(body.claudeModel).trim();
      }
      if (body.elevenLabsKey && body.voiceId) {
        opts.elevenLabsKey = String(body.elevenLabsKey).trim();
        opts.voiceId = String(body.voiceId).trim();
      }
      const r = await generateVideo(opts);
      const rel = (p) => (p ? '/out/' + path.basename(p) : null);
      emit({
        done: true,
        video: rel(r.video), isMp4: r.isMp4,
        captionIg: r.content.caption_instagram || '',
        captionTt: r.content.caption_tiktok || '',
        contentJson: r.content,
        slug: path.basename(r.base).replace(/^hydra-video-/, ''),
      });
    } catch (e) {
      emit({ error: e.message || String(e) });
    }
    return res.end();
  }

  res.writeHead(404); res.end('not found');
});

function openBrowser(u) {
  const cmd = process.platform === 'win32' ? `start "" "${u}"`
    : process.platform === 'darwin' ? `open "${u}"` : `xdg-open "${u}"`;
  exec(cmd, () => {});
}

server.listen(PORT, () => {
  const u = `http://localhost:${PORT}`;
  console.log(`\n  HYDRA — studio vidéo\n  ${u}\n`);
  console.log('  Laisse cette fenêtre ouverte tant que tu crées des vidéos.');
  console.log('  Pour arrêter : ferme la fenêtre (ou Ctrl+C).\n');
  if (!process.env.NO_OPEN) openBrowser(u);
});
