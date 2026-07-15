// Client minimal pour l'API ElevenLabs Text-to-Speech "with timestamps".
// Endpoint et schéma vérifiés sur le SDK officiel (elevenlabs-python), pas
// deviné : POST /v1/text-to-speech/{voice_id}/with-timestamps, header
// xi-api-key, réponse { audio_base64, alignment: { characters,
// character_start_times_seconds, character_end_times_seconds } }.
//
// On utilise `alignment` (pas `normalized_alignment`) : il correspond
// caractère pour caractère au texte EXACT qu'on a envoyé, ce qui est
// indispensable pour retrouver les bornes de chaque segment (hook/ligne/
// réponse) par simple décompte de caractères.

const DEFAULT_MODEL = 'eleven_multilingual_v2'; // voix cohérente/neutre — colle au ton HYDRA (brutal, direct, pas "expressif")

async function synthesizeWithTimestamps({ text, apiKey, voiceId, modelId }) {
  if (!apiKey) throw new Error('Clé API ElevenLabs manquante.');
  if (!voiceId) throw new Error('Voice ID ElevenLabs manquant (Voix ElevenLabs → copier le Voice ID).');

  const resp = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: modelId || DEFAULT_MODEL,
      }),
    }
  );
  if (!resp.ok) {
    let detail = '';
    try { detail = (await resp.json())?.detail?.message || JSON.stringify(await resp.json()); } catch (_) {}
    throw new Error(`ElevenLabs API ${resp.status}${detail ? ' — ' + detail : ''}`);
  }
  const data = await resp.json();
  if (!data.audio_base64 || !data.alignment) {
    throw new Error('Réponse ElevenLabs inattendue (audio_base64/alignment manquants).');
  }
  return {
    audioBuffer: Buffer.from(data.audio_base64, 'base64'),
    characters: data.alignment.characters,
    starts: data.alignment.character_start_times_seconds,
    ends: data.alignment.character_end_times_seconds,
  };
}

module.exports = { synthesizeWithTimestamps, DEFAULT_MODEL };
