/**
 * store.jsx — Estado global de Bolita Crypto con persistencia en localStorage.
 * Sin backend: apuestas, saldos demo, historial y solicitudes viven aquí.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  DRAW_INTERVAL_MS,
  BET_CLOSE_MS,
  drawTimeForBet,
  nextDrawTime,
  isBettingOpen,
  deriveDrawNumbers,
  evaluateBet,
} from './bolita.js';
import { fetchBeacon, hashDrawInput } from './drand.js';

const LS_KEY = 'bolita-crypto:v1';

const DEFAULT_STATE = {
  mode: 'demo', // 'demo' | 'testnet'
  demoBalance: 1000,
  testnetCredit: {}, // address (lower) -> USDC
  walletAddress: null,
  bets: [],
  draws: [],
  deposits: [],
  withdrawals: [],
  lastResolvedDraw: null,
  demoSeedClaimed: false,
};

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

const BolitaContext = createContext(null);
export const useBolita = () => useContext(BolitaContext);

let seq = 0;
const uid = (p) => `${p}_${Date.now().toString(36)}_${(seq++).toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

export function BolitaProvider({ children }) {
  const [state, setState] = useState(load);
  const stateRef = useRef(state);
  stateRef.current = state;
  const resolvingRef = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch {
      /* almacenamiento lleno o bloqueado */
    }
  }, [state]);

  const patch = useCallback((fn) => setState((s) => fn(s)), []);

  /* ── Saldos ─────────────────────────────────────────────────────── */
  const balance = useMemo(() => {
    if (state.mode === 'testnet' && state.walletAddress) {
      return state.testnetCredit[state.walletAddress.toLowerCase()] ?? 0;
    }
    return state.demoBalance;
  }, [state.mode, state.walletAddress, state.testnetCredit, state.demoBalance]);

  const credit = useCallback(
    (amount, mode, address) => {
      patch((s) => {
        if (mode === 'testnet' && address) {
          const k = address.toLowerCase();
          return { ...s, testnetCredit: { ...s.testnetCredit, [k]: (s.testnetCredit[k] ?? 0) + amount } };
        }
        return { ...s, demoBalance: s.demoBalance + amount };
      });
    },
    [patch],
  );

  const debit = useCallback(
    (amount, mode, address) => {
      patch((s) => {
        if (mode === 'testnet' && address) {
          const k = address.toLowerCase();
          return { ...s, testnetCredit: { ...s.testnetCredit, [k]: (s.testnetCredit[k] ?? 0) - amount } };
        }
        return { ...s, demoBalance: s.demoBalance - amount };
      });
    },
    [patch],
  );

  /* ── Apuestas ───────────────────────────────────────────────────── */
  const placeBet = useCallback(
    ({ type, numbers, amount }) => {
      const s = stateRef.current;
      const now = Date.now();
      const drawTime = drawTimeForBet(now);
      if (!isBettingOpen(drawTime, now)) {
        return { ok: false, error: 'Las apuestas para este sorteo ya cerraron.' };
      }
      if (!(amount > 0)) return { ok: false, error: 'El monto debe ser mayor que 0.' };
      const mode = s.mode;
      const address = s.walletAddress;
      if (mode === 'testnet' && !address) {
        return { ok: false, error: 'Conecta tu wallet para jugar en modo testnet.' };
      }
      const bal = mode === 'testnet' ? s.testnetCredit[address.toLowerCase()] ?? 0 : s.demoBalance;
      if (amount > bal + 1e-9) {
        return { ok: false, error: 'Saldo insuficiente para esta jugada.' };
      }
      const bet = {
        id: uid('bet'),
        type,
        numbers: [...numbers],
        amount,
        drawTime,
        status: 'pendiente',
        mode,
        address: address ? address.toLowerCase() : null,
        createdAt: now,
        payout: null,
      };
      debit(amount, mode, address);
      patch((prev) => ({ ...prev, bets: [bet, ...prev.bets] }));
      return { ok: true, bet };
    },
    [patch, debit],
  );

  /* ── Resolución de sorteos ──────────────────────────────────────── */
  const resolveOneDraw = useCallback(async () => {
    if (resolvingRef.current) return;
    const s = stateRef.current;
    const now = Date.now();
    const interval = DRAW_INTERVAL_MS;
    // Primer slot a resolver:
    // - si hay historial: el siguiente al último resuelto;
    // - si hay apuestas pendientes de una sesión anterior: desde la más antigua;
    // - si no: desde el slot actual (no se rellena el pasado con sorteos vacíos).
    let slot;
    if (s.lastResolvedDraw != null) {
      slot = s.lastResolvedDraw + interval;
    } else {
      const pending = s.bets.filter((b) => b.status === 'pendiente');
      slot = pending.length > 0
        ? Math.floor(Math.min(...pending.map((b) => b.drawTime)) / interval) * interval
        : Math.floor(now / interval) * interval;
    }
    slot = Math.floor(slot / interval) * interval;
    if (slot > now || slot <= 0) return;
    if (s.draws.some((d) => d.drawTime === slot)) {
      patch((prev) => ({ ...prev, lastResolvedDraw: slot }));
      return;
    }
    resolvingRef.current = true;
    try {
      const beacon = await fetchBeacon();
      const hashBytes = await hashDrawInput(beacon.inputText);
      const hashHex = [...hashBytes].map((b) => b.toString(16).padStart(2, '0')).join('');
      const numbers = deriveDrawNumbers(hashBytes, (counter) => {
        // Re-hash síncrono en browser: WebCrypto es async; usamos FNV-1a como
        // mezcla determinista de emergencia (casi imposible de necesitar).
        let h = 0x811c9dc5;
        const mix = `${hashHex}:${counter}`;
        for (let i = 0; i < mix.length; i++) {
          h ^= mix.charCodeAt(i);
          h = Math.imul(h, 0x01000193) >>> 0;
        }
        const out = new Uint8Array(32);
        for (let i = 0; i < 32; i++) {
          h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
          out[i] = h & 0xff;
        }
        return out;
      });

      const draw = {
        drawTime: slot,
        resolvedAt: Date.now(),
        numbers,
        beacon: {
          round: beacon.round,
          randomness: beacon.randomness,
          source: beacon.source,
          verifyUrl: beacon.verifyUrl,
          inputText: beacon.inputText,
        },
        hashHex,
      };

      patch((prev) => {
        const pendingBets = prev.bets.filter((b) => b.drawTime === slot && b.status === 'pendiente');
        const settledBets = prev.bets.map((b) => {
          if (!(b.drawTime === slot && b.status === 'pendiente')) return b;
          const r = evaluateBet(b, numbers);
          return {
            ...b,
            status: r.won ? 'ganada' : 'perdida',
            payout: r.won ? r.payout : 0,
            resultDetail: r.detail,
            resolvedAt: draw.resolvedAt,
          };
        });
        // Acredita premios al saldo correspondiente.
        let demoBalance = prev.demoBalance;
        const testnetCredit = { ...prev.testnetCredit };
        for (const b of pendingBets) {
          const r = evaluateBet(b, numbers);
          if (r.won && r.payout > 0) {
            if (b.mode === 'testnet' && b.address) {
              testnetCredit[b.address] = (testnetCredit[b.address] ?? 0) + r.payout;
            } else {
              demoBalance += r.payout;
            }
          }
        }
        return {
          ...prev,
          bets: settledBets,
          draws: [draw, ...prev.draws],
          lastResolvedDraw: slot,
          demoBalance,
          testnetCredit,
        };
      });
    } finally {
      resolvingRef.current = false;
    }
  }, [patch]);

  // Reloj: intenta resolver sorteos vencidos cada 2 s.
  useEffect(() => {
    resolveOneDraw();
    const t = setInterval(resolveOneDraw, 2000);
    return () => clearInterval(t);
  }, [resolveOneDraw]);

  /* ── Wallet / modos ─────────────────────────────────────────────── */
  const setMode = useCallback((mode) => patch((s) => ({ ...s, mode })), [patch]);
  const setWalletAddress = useCallback(
    (address) => patch((s) => ({ ...s, walletAddress: address })),
    [patch],
  );
  const disconnectWallet = useCallback(
    () => patch((s) => ({ ...s, walletAddress: null, mode: 'demo' })),
    [patch],
  );

  /* ── Depósitos (testnet): el usuario envía USDC a tesorería on-chain;
   * la banca acredita el saldo interno manualmente en este MVP. */
  const requestDeposit = useCallback(
    ({ amount, txHash }) => {
      const s = stateRef.current;
      if (!s.walletAddress) return { ok: false, error: 'Conecta tu wallet primero.' };
      if (!(amount > 0)) return { ok: false, error: 'Monto inválido.' };
      const dep = {
        id: uid('dep'),
        address: s.walletAddress.toLowerCase(),
        amount,
        txHash: txHash?.trim() || null,
        status: 'pendiente',
        createdAt: Date.now(),
      };
      patch((prev) => ({ ...prev, deposits: [dep, ...prev.deposits] }));
      return { ok: true, deposit: dep };
    },
    [patch],
  );

  /* ── Retiros: se descuentan al solicitar; la banca paga manualmente. */
  const requestWithdraw = useCallback(
    ({ amount, toAddress }) => {
      const s = stateRef.current;
      const address = s.walletAddress;
      if (!address) return { ok: false, error: 'Conecta tu wallet primero.' };
      if (!(amount > 0)) return { ok: false, error: 'Monto inválido.' };
      const bal = s.testnetCredit[address.toLowerCase()] ?? 0;
      if (amount > bal + 1e-9) return { ok: false, error: 'Saldo insuficiente.' };
      const w = {
        id: uid('wd'),
        address: address.toLowerCase(),
        toAddress: toAddress?.trim() || address,
        amount,
        status: 'pendiente',
        createdAt: Date.now(),
      };
      debit(amount, 'testnet', address);
      patch((prev) => ({ ...prev, withdrawals: [w, ...prev.withdrawals] }));
      return { ok: true, withdrawal: w };
    },
    [patch, debit],
  );

  /* ── Admin (banca) ──────────────────────────────────────────────── */
  const adminCreditDeposit = useCallback(
    (id, approve) => {
      patch((s) => {
        const dep = s.deposits.find((d) => d.id === id);
        if (!dep || dep.status !== 'pendiente') return s;
        const deposits = s.deposits.map((d) =>
          d.id === id ? { ...d, status: approve ? 'acreditado' : 'rechazado', resolvedAt: Date.now() } : d,
        );
        if (!approve) return { ...s, deposits };
        const k = dep.address.toLowerCase();
        return {
          ...s,
          deposits,
          testnetCredit: { ...s.testnetCredit, [k]: (s.testnetCredit[k] ?? 0) + dep.amount },
        };
      });
    },
    [patch],
  );

  const adminResolveWithdrawal = useCallback(
    (id, approve) => {
      // Aprobar = la banca pagará manualmente on-chain (etiquetado en la UI).
      // Rechazar = se devuelve el saldo interno.
      patch((s) => {
        const w = s.withdrawals.find((x) => x.id === id);
        if (!w || w.status !== 'pendiente') return s;
        const withdrawals = s.withdrawals.map((x) =>
          x.id === id ? { ...x, status: approve ? 'aprobado' : 'rechazado', resolvedAt: Date.now() } : x,
        );
        if (approve) return { ...s, withdrawals };
        const k = w.address.toLowerCase();
        return {
          ...s,
          withdrawals,
          testnetCredit: { ...s.testnetCredit, [k]: (s.testnetCredit[k] ?? 0) + w.amount },
        };
      });
    },
    [patch],
  );

  const resetDemo = useCallback(() => {
    patch((s) => ({ ...s, demoBalance: 1000, bets: s.bets.filter((b) => b.mode !== 'demo') }));
  }, [patch]);

  /* ── Derivados ──────────────────────────────────────────────────── */
  const nextDraw = useMemo(() => nextDrawTime(Date.now()), []);
  const openBets = useMemo(() => state.bets.filter((b) => b.status === 'pendiente'), [state.bets]);
  const bankroll = useMemo(() => {
    const staked = state.bets.reduce((a, b) => a + b.amount, 0);
    const paid = state.bets.reduce((a, b) => a + (b.payout || 0), 0);
    return { staked, paid, net: staked - paid };
  }, [state.bets]);

  const value = useMemo(
    () => ({
      state,
      balance,
      nextDraw,
      openBets,
      bankroll,
      setMode,
      setWalletAddress,
      disconnectWallet,
      placeBet,
      credit,
      requestDeposit,
      requestWithdraw,
      adminCreditDeposit,
      adminResolveWithdrawal,
      resetDemo,
      isBettingOpenNow: (drawTime) => isBettingOpen(drawTime, Date.now(), BET_CLOSE_MS),
    }),
    [state, balance, nextDraw, openBets, bankroll, setMode, setWalletAddress, disconnectWallet, placeBet, credit, requestDeposit, requestWithdraw, adminCreditDeposit, adminResolveWithdrawal, resetDemo],
  );

  return <BolitaContext.Provider value={value}>{children}</BolitaContext.Provider>;
}
