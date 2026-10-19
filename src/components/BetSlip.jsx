/** BetSlip — boleto: tipo de jugada, monto, premio potencial y confirmación. */
import { useMemo, useState } from 'react';
import { Button, Input, Modal, Alert, Badge, PriceTag } from '../ds.js';
import { BET_TYPES, betLabel, pad2 } from '../lib/bolita.js';
import { useBolita } from '../lib/store.jsx';

export function BetSlip({ betType, setBetType, selected, onPlaced }) {
  const { balance, state, placeBet } = useBolita();
  const [amount, setAmount] = useState('5');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState(null);

  const type = BET_TYPES[betType];
  const amountNum = Number(String(amount).replace(',', '.'));
  const prize = useMemo(
    () => (amountNum > 0 ? amountNum * type.multiplier : 0),
    [amountNum, type],
  );
  const valid = selected.length === type.numbers && amountNum > 0;

  const openConfirm = () => {
    setError(null);
    if (!valid) {
      setError(
        selected.length !== type.numbers
          ? `Elige ${type.numbers} ${type.numbers === 1 ? 'número' : 'números'} para el ${type.label}.`
          : 'Escribe un monto válido en USDC.',
      );
      return;
    }
    setConfirmOpen(true);
  };

  const confirm = () => {
    const res = placeBet({ type: betType, numbers: selected, amount: amountNum });
    if (!res.ok) {
      setError(res.error);
      setConfirmOpen(false);
      return;
    }
    setConfirmOpen(false);
    setError(null);
    onPlaced?.(res.bet);
  };

  const betPreview = { type: betType, numbers: selected, amount: amountNum };

  return (
    <div>
      <div className="bet-types" role="radiogroup" aria-label="Tipo de jugada">
        {Object.values(BET_TYPES).map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={betType === t.id}
            className={`bet-type-card${betType === t.id ? ' is-active' : ''}`}
            onClick={() => setBetType(t.id)}
          >
            <div className="mult">{t.multiplier}×</div>
            <div className="name">{t.label}</div>
            <div className="need">{t.numbers} {t.numbers === 1 ? 'número' : 'números'}</div>
          </button>
        ))}
      </div>

      {error && <Alert variant="danger" className="mb-2">{error}</Alert>}

      <Input
        label="Monto de la jugada (USDC)"
        type="number"
        min="0"
        step="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        hint={`Tu saldo: ${balance.toFixed(2)} USDC ${state.mode === 'demo' ? '(demo)' : '(testnet)'}`}
        fullWidth
      />

      <div className="prize-preview">
        <span>Si ganas, cobras</span>
        <span className="amount">{prize > 0 ? `${prize.toLocaleString('es-ES')} USDC` : '—'}</span>
      </div>

      <Button variant="lima" size="lg" fullWidth onClick={openConfirm} disabled={!valid}>
        Confirmar jugada · {amountNum > 0 ? `${amountNum} USDC` : ''}
      </Button>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirma tu jugada"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
            <Button variant="lima" onClick={confirm}>¡Jugar!</Button>
          </>
        }
      >
        <div className="confirm-summary">
          <div className="confirm-row"><span>Jugada</span><strong>{betLabel(betPreview)}</strong></div>
          <div className="confirm-row"><span>Tipo</span><strong>{type.title}</strong></div>
          <div className="confirm-row"><span>Monto</span><strong><PriceTag amount={amountNum} currency="USD" /></strong></div>
          <div className="confirm-row"><span>Premio potencial</span><strong>{prize.toLocaleString('es-ES')} USDC</strong></div>
          <div className="confirm-row"><span>Sorteo</span><strong>{new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} aprox.</strong></div>
          <Badge variant="warning">Testnet/demo · sin dinero real</Badge>
        </div>
      </Modal>
    </div>
  );
}
