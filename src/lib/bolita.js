/**
 * bolita.js — Lógica pura de la bolita cubana (sin JSX ni dependencias).
 * Este archivo lo importan tanto la app (Vite) como el script de
 * verificación `scripts/test-draw.mjs` (node).
 */

/* ── Configuración de red (SOLO testnet, nada de mainnet) ─────────── */
export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const BASE_SEPOLIA_CHAIN_ID_HEX = '0x14A34';
// USDC en Base Sepolia — verificado en web contra docs de Circle
// (developers.circle.com) y guías cruzadas con CDP:
// 0x036CbD53842c5426634e7929541eC2318f3dCF7e
export const USDC_ADDRESS_BASE_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
export const USDC_DECIMALS = 6;

/* ── Sorteos ──────────────────────────────────────────────────────── */
// Lee env de Vite cuando existe; en node (test) usa los defaults.
function envInt(name, fallback) {
  try {
    const v = import.meta?.env?.[name];
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  } catch {
    return fallback;
  }
}
export const DRAW_INTERVAL_MS = envInt('VITE_DRAW_INTERVAL_MS', 600000); // 10 min
export const BET_CLOSE_MS = envInt('VITE_BET_CLOSE_SECONDS', 60) * 1000;

/* ── Tipos de jugada ──────────────────────────────────────────────── */
export const BET_TYPES = {
  fijo: {
    id: 'fijo',
    label: 'Fijo',
    multiplier: 75,
    numbers: 1,
    title: 'FIJO · paga 75×',
    desc: 'Ganas si tu número es el PRIMERO sorteado.',
    example: 'Juegas 5 USDC al 16 fijo → sale 16 de primero → cobras 375 USDC.',
  },
  corrido: {
    id: 'corrido',
    label: 'Corrido',
    multiplier: 25,
    numbers: 1,
    title: 'CORRIDO · paga 25×',
    desc: 'Ganas si tu número sale en 2ª o 3ª posición.',
    example: 'Juegas 4 USDC al 07 corrido → sale en 2º o 3º → cobras 100 USDC.',
  },
  parle: {
    id: 'parle',
    label: 'Parlé',
    multiplier: 900,
    numbers: 2,
    title: 'PARLÉ · paga 900×',
    desc: 'Eliges 2 números; ganas si AMBOS salen entre los 3 sorteados, en cualquier orden.',
    example: 'Juegas 2 USDC al parlé 16-99 → salen los dos → cobras 1.800 USDC.',
  },
  candado: {
    id: 'candado',
    label: 'Candado',
    multiplier: 5000,
    numbers: 3,
    title: 'CANDADO · paga 5.000×',
    desc: 'Ganas si aciertas los 3 números EN EL ORDEN exacto del sorteo.',
    example: 'Juegas 1 USDC al candado 07-16-99 → salen en ese orden → cobras 5.000 USDC.',
  },
};

/* ── Charada cubana ─────────────────────────────────────────────────
 * Solo significados verificados. El resto queda sin significado
 * (nunca inventar). Diccionario ampliable. */
export const CHARADA = {
  1: 'caballo',
  2: 'mariposa',
  3: 'marinero',
  4: 'gato',
  16: 'la niña que todo lo brinda',
  99: 'serrucho',
};

export function charadaDe(n) {
  return CHARADA[n] ?? null;
}

export function pad2(n) {
  return String(n).padStart(2, '0');
}

/* ── Calendario de sorteos ────────────────────────────────────────── */
/** Próximo horario de sorteo (alineado a múltiplos del intervalo desde epoch). */
export function nextDrawTime(nowMs, intervalMs = DRAW_INTERVAL_MS) {
  return Math.ceil(nowMs / intervalMs) * intervalMs;
}

/** ¿Siguen abiertas las apuestas para el sorteo `drawTime`? Cierran 60 s antes. */
export function isBettingOpen(drawTime, nowMs = Date.now(), closeMs = BET_CLOSE_MS) {
  return nowMs < drawTime - closeMs;
}

/** Sorteo al que pertenece una apuesta hecha en `nowMs` (salta al siguiente si ya cerró). */
export function drawTimeForBet(nowMs = Date.now(), intervalMs = DRAW_INTERVAL_MS, closeMs = BET_CLOSE_MS) {
  const next = nextDrawTime(nowMs, intervalMs);
  return isBettingOpen(next, nowMs, closeMs) ? next : next + intervalMs;
}

/* ── Derivación de números ganadores (verificable) ──────────────────
 * Entrada: bytes del sha256 de `round || randomness` del beacon drand.
 * Se toman bytes mod 100, saltando duplicados; si los 32 bytes no
 * alcanzan, se re-hashea con un contador. Determinista y testeable. */
export function deriveDrawNumbers(hashBytes, rehash) {
  const out = [];
  let bytes = hashBytes;
  let counter = 0;
  while (out.length < 3) {
    for (let i = 0; i < bytes.length && out.length < 3; i++) {
      const n = bytes[i] % 100;
      if (!out.includes(n)) out.push(n);
    }
    if (out.length < 3) {
      if (!rehash) throw new Error('deriveDrawNumbers: sin bytes suficientes y sin función rehash');
      counter += 1;
      bytes = rehash(counter);
    }
  }
  return out;
}

/** Texto que se hashea: ronda y randomness del beacon, formato `round:randomness`. */
export function drawInputText(round, randomnessHex) {
  return `${round}:${String(randomnessHex).toLowerCase()}`;
}

/* ── Evaluación de jugadas ────────────────────────────────────────── */
export function evaluateBet(bet, drawNumbers) {
  const [w1, w2, w3] = drawNumbers;
  const nums = bet.numbers;
  switch (bet.type) {
    case 'fijo':
      return nums[0] === w1
        ? { won: true, multiplier: 75, payout: bet.amount * 75, detail: `Salió ${pad2(w1)} de primero` }
        : { won: false, multiplier: 0, payout: 0, detail: `Salió ${pad2(w1)} de primero` };
    case 'corrido':
      return nums[0] === w2 || nums[0] === w3
        ? { won: true, multiplier: 25, payout: bet.amount * 25, detail: `Tu número salió en 2ª/3ª` }
        : { won: false, multiplier: 0, payout: 0, detail: `No salió en 2ª ni 3ª` };
    case 'parle': {
      const hit = nums.every((n) => drawNumbers.includes(n));
      return hit
        ? { won: true, multiplier: 900, payout: bet.amount * 900, detail: '¡Los dos números salieron!' }
        : { won: false, multiplier: 0, payout: 0, detail: 'Faltó al menos un número' };
    }
    case 'candado': {
      const hit = nums[0] === w1 && nums[1] === w2 && nums[2] === w3;
      return hit
        ? { won: true, multiplier: 5000, payout: bet.amount * 5000, detail: '¡Orden exacto!' }
        : { won: false, multiplier: 0, payout: 0, detail: 'No coincidió el orden exacto' };
    }
    default:
      throw new Error(`Tipo de jugada desconocido: ${bet.type}`);
  }
}

/** Etiqueta corta de una jugada, p. ej. "FIJO 16" / "PARLÉ 16-99". */
export function betLabel(bet) {
  const t = BET_TYPES[bet.type];
  return `${t.label.toUpperCase()} ${bet.numbers.map(pad2).join('-')}`;
}
