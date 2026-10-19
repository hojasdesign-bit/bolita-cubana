/** NumberGrid — selector de números 00–99 con charada y quick-pick. */
import { Button } from '../ds.js';
import { pad2, charadaDe, BET_TYPES } from '../lib/bolita.js';

const ALL = Array.from({ length: 100 }, (_, i) => i);

function randomPick(count, exclude = []) {
  const pool = ALL.filter((n) => !exclude.includes(n));
  const out = [];
  while (out.length < count && pool.length) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return out;
}

export function NumberGrid({ selected, onChange, betType }) {
  const need = BET_TYPES[betType].numbers;

  const toggle = (n) => {
    if (selected.includes(n)) {
      onChange(selected.filter((x) => x !== n));
    } else if (selected.length < need) {
      onChange([...selected, n].sort((a, b) => a - b));
    }
  };

  const quickPick = () => onChange(randomPick(need));
  const luckyNumber = () => {
    // "Número de la suerte": uno con significado en la charada.
    const withMeaning = ALL.filter((n) => charadaDe(n));
    const pick = withMeaning[Math.floor(Math.random() * withMeaning.length)];
    onChange(need === 1 ? [pick] : randomPick(need - 1, [pick]).concat(pick).sort((a, b) => a - b));
  };

  const meanings = selected
    .map((n) => ({ n, m: charadaDe(n) }))
    .filter((x) => x.m);

  return (
    <div>
      <div className="num-tools">
        <Button variant="outline" size="sm" onClick={quickPick}>Aleatorio</Button>
        <Button variant="lima" size="sm" onClick={luckyNumber}>Número de la suerte</Button>
        {selected.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => onChange([])}>Limpiar</Button>
        )}
      </div>

      {meanings.length > 0 && (
        <div className="charada-line">
          {meanings.map(({ n, m }) => (
            <div key={n}>
              <strong>{pad2(n)}</strong> · {m}
            </div>
          ))}
        </div>
      )}

      <div className="num-grid" role="group" aria-label="Selector de números del 00 al 99">
        {ALL.map((n) => (
          <button
            key={n}
            type="button"
            className={`num-cell${selected.includes(n) ? ' is-selected' : ''}`}
            onClick={() => toggle(n)}
            aria-pressed={selected.includes(n)}
          >
            {pad2(n)}
          </button>
        ))}
      </div>
      <p className="section-sub">
        Elige {need} {need === 1 ? 'número' : 'números'} para tu jugada {BET_TYPES[betType].label.toUpperCase()}.
      </p>
    </div>
  );
}
