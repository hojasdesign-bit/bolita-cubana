/**
 * test-draw.mjs — Verifica la lógica del sorteo de Bolita Crypto con node.
 * Uso: npm run test:draw
 * Prueba: derivación determinista, rango/duplicados, re-hash,
 * evaluación de los 4 tipos de jugada, calendario de sorteos y
 * una derivación real contra el beacon drand en vivo.
 */
import { createHash } from 'node:crypto';
import {
  deriveDrawNumbers,
  drawInputText,
  evaluateBet,
  nextDrawTime,
  isBettingOpen,
  drawTimeForBet,
  DRAW_INTERVAL_MS,
  BET_CLOSE_MS,
  BET_TYPES,
  pad2,
} from '../src/lib/bolita.js';

let pass = 0;
let fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ FALLO: ${name}`); }
}
const sha256 = (input) => createHash('sha256').update(input).digest();
const bytes = (hex) => Uint8Array.from(Buffer.from(hex, 'hex'));

console.log('— Derivación de números —');
// 1. Determinismo
const h1 = sha256(drawInputText(6564984, 'c996e04a6f0e5f293da1d47a77da39dfd73f6da0a065080f3e052686824b0138'));
const n1 = deriveDrawNumbers(h1);
const n2 = deriveDrawNumbers(h1);
ok(JSON.stringify(n1) === JSON.stringify(n2), `determinista: [${n1.map(pad2)}]`);
console.log(`    vector conocido → [${n1.map(pad2).join(', ')}]`);

// 2. Rango y unicidad en 2000 derivaciones
let bad = 0;
for (let i = 0; i < 2000; i++) {
  const n = deriveDrawNumbers(sha256(`sorteo-test:${i}`));
  if (n.length !== 3 || new Set(n).size !== 3 || n.some((x) => x < 0 || x > 99)) bad++;
}
ok(bad === 0, '2000 derivaciones: 3 números distintos entre 00 y 99');

// 3. Camino de re-hash (hash degenerado: todos los bytes iguales)
const degenerate = new Uint8Array(32).fill(7);
const nDegen = deriveDrawNumbers(degenerate, (c) => sha256(`rehash:${c}`));
ok(nDegen.length === 3 && new Set(nDegen).size === 3, `re-hash ante duplicados: [${nDegen.map(pad2)}]`);

// 4. Distribución aproximada (chi visual: ningún número domina)
const counts = new Array(100).fill(0);
for (let i = 0; i < 5000; i++) {
  for (const n of deriveDrawNumbers(sha256(`dist:${i}`))) counts[n]++;
}
const max = Math.max(...counts);
const min = Math.min(...counts);
ok(max < min * 3, `distribución razonable en 5000 sorteos (min=${min}, max=${max})`);

console.log('— Evaluación de jugadas —');
const mk = (type, numbers, amount = 10) => ({ type, numbers, amount });
let r;
r = evaluateBet(mk('fijo', [16]), [16, 4, 99]);
ok(r.won && r.payout === 750 && r.multiplier === 75, 'fijo gana (1º)');
r = evaluateBet(mk('fijo', [16]), [4, 16, 99]);
ok(!r.won && r.payout === 0, 'fijo pierde si sale 2º');
r = evaluateBet(mk('corrido', [7]), [16, 7, 99]);
ok(r.won && r.payout === 250, 'corrido gana (2º)');
r = evaluateBet(mk('corrido', [7]), [16, 4, 7]);
ok(r.won && r.payout === 250, 'corrido gana (3º)');
r = evaluateBet(mk('corrido', [7]), [7, 4, 99]);
ok(!r.won, 'corrido pierde si sale 1º');
r = evaluateBet(mk('parle', [16, 99]), [99, 4, 16]);
ok(r.won && r.payout === 9000, 'parlé gana en cualquier orden');
r = evaluateBet(mk('parle', [16, 99]), [16, 4, 7]);
ok(!r.won, 'parlé pierde si falta uno');
r = evaluateBet(mk('candado', [7, 16, 99]), [7, 16, 99]);
ok(r.won && r.payout === 50000, 'candado gana en orden exacto');
r = evaluateBet(mk('candado', [7, 16, 99]), [16, 7, 99]);
ok(!r.won, 'candado pierde si el orden cambia');
ok(
  BET_TYPES.fijo.multiplier === 75 && BET_TYPES.corrido.multiplier === 25 &&
  BET_TYPES.parle.multiplier === 900 && BET_TYPES.candado.multiplier === 5000,
  'multiplicadores: 75× / 25× / 900× / 5000×',
);

console.log('— Calendario de sorteos —');
ok(DRAW_INTERVAL_MS === 600000, `intervalo 10 min (${DRAW_INTERVAL_MS} ms)`);
ok(BET_CLOSE_MS === 60000, `cierre 60 s antes (${BET_CLOSE_MS} ms)`);
const t = 1_790_000_000_000; // instante arbitrario
const nxt = nextDrawTime(t);
ok(nxt % DRAW_INTERVAL_MS === 0 && nxt >= t && nxt - t < DRAW_INTERVAL_MS, 'nextDrawTime alineado al intervalo');
ok(isBettingOpen(nxt, nxt - 61_000), 'apuestas abiertas 61 s antes');
ok(!isBettingOpen(nxt, nxt - 59_000), 'apuestas cerradas 59 s antes');
ok(drawTimeForBet(nxt - 61_000) === nxt, 'jugada va al sorteo próximo si está abierto');
ok(drawTimeForBet(nxt - 30_000) === nxt + DRAW_INTERVAL_MS, 'jugada salta al siguiente si ya cerró');

console.log('— Beacon drand en vivo —');
try {
  const res = await fetch('https://drand.cloudflare.com/public/latest');
  const j = await res.json();
  ok(typeof j.round === 'number' && typeof j.randomness === 'string', `beacon responde (ronda ${j.round})`);
  const input = drawInputText(j.round, j.randomness);
  const nums = deriveDrawNumbers(sha256(input));
  console.log(`    ronda ${j.round} → [${nums.map(pad2).join(', ')}]`);
  console.log(`    verificar: https://drand.cloudflare.com/public/${j.round}`);
} catch (e) {
  ok(false, `beacon drand no responde: ${e.message}`);
}

console.log(`\n${pass} OK, ${fail} fallos`);
process.exit(fail ? 1 : 0);
