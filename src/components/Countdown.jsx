/** Countdown — cuenta regresiva al próximo sorteo con estado de apuestas. */
import { useEffect, useState } from 'react';
import { nextDrawTime, isBettingOpen, DRAW_INTERVAL_MS, BET_CLOSE_MS, pad2 } from '../lib/bolita.js';

function fmt(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${pad2(m)}:${pad2(r)}`;
}

export function Countdown({ onTick }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const drawTime = nextDrawTime(now, DRAW_INTERVAL_MS);
  const open = isBettingOpen(drawTime, now, BET_CLOSE_MS);
  const remaining = drawTime - now;

  useEffect(() => {
    if (onTick) onTick({ drawTime, open });
  }, [drawTime, open, onTick]);

  return (
    <div>
      <div className="countdown-big">{open ? fmt(remaining) : '¡Sorteo!'}</div>
      <div className="countdown-note">
        {open
          ? `Apuestas abiertas · cierran ${Math.round(BET_CLOSE_MS / 1000)} s antes`
          : 'Apuestas cerradas · sorteando…'}
      </div>
    </div>
  );
}
