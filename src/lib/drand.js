/**
 * drand.js — Beacon de aleatoriedad verificable (https://drand.love).
 * Se consulta el beacon público al momento de cada sorteo; la ronda y el
 * randomness quedan guardados en el historial para verificación.
 */
import { drawInputText } from './bolita.js';

const ENDPOINTS = [
  { url: 'https://drand.cloudflare.com/public/latest', source: 'drand' },
  { url: 'https://api.drand.sh/public/latest', source: 'drand (respaldo)' },
];

/**
 * Obtiene el beacon más reciente. Devuelve:
 * { round, randomness, source, verifyUrl, inputText }
 * Si ningún endpoint responde, usa aleatoriedad local etiquetada como tal.
 */
export async function fetchBeacon() {
  for (const ep of ENDPOINTS) {
    try {
      const res = await fetch(ep.url, { cache: 'no-store' });
      if (!res.ok) continue;
      const j = await res.json();
      if (typeof j.round !== 'number' || typeof j.randomness !== 'string') continue;
      return {
        round: j.round,
        randomness: j.randomness.toLowerCase(),
        source: ep.source,
        verifyUrl: `https://drand.cloudflare.com/public/${j.round}`,
        inputText: drawInputText(j.round, j.randomness),
      };
    } catch {
      /* intenta el siguiente endpoint */
    }
  }
  // Último recurso: aleatoriedad local, etiquetada honestamente.
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  const randomness = [...buf].map((b) => b.toString(16).padStart(2, '0')).join('');
  return {
    round: null,
    randomness,
    source: 'local (demo)',
    verifyUrl: null,
    inputText: `local:${randomness}`,
  };
}

/** sha256 (WebCrypto) del texto de entrada del sorteo → Uint8Array. */
export async function hashDrawInput(inputText) {
  const data = new TextEncoder().encode(inputText);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(digest);
}
