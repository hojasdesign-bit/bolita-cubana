/** AdminPanel — panel de la banca: bankroll, apuestas abiertas, depósitos y retiros. */
import { useState } from 'react';
import {
  Button, Input, Alert, Badge, Card, StatCard, EmptyState,
} from '../ds.js';
import { betLabel, pad2 } from '../lib/bolita.js';
import { useBolita } from '../lib/store.jsx';

const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN || '1234';

function StatusBadge({ status }) {
  const map = {
    pendiente: 'warning', ganada: 'success', perdida: 'neutral',
    acreditado: 'success', aprobado: 'info', rechazado: 'danger',
  };
  return <Badge variant={map[status] || 'neutral'}>{status}</Badge>;
}

export function AdminPanel() {
  const {
    state, bankroll, openBets,
    adminCreditDeposit, adminResolveWithdrawal,
  } = useBolita();
  const [pin, setPin] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [pinError, setPinError] = useState(null);

  if (!unlocked) {
    return (
      <div>
        <h2 className="section-title">Banca</h2>
        <p className="section-sub">Panel de administración. El PIN es solo un gate de interfaz.</p>
        {pinError && <Alert variant="danger" className="mb-2">{pinError}</Alert>}
        <div className="pin-row">
          <Input
            label="PIN de la banca"
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="••••"
            onKeyDown={(e) => e.key === 'Enter' && tryUnlock()}
          />
          <Button variant="primary" onClick={tryUnlock} style={{ alignSelf: 'end' }}>Entrar</Button>
        </div>
        <Alert variant="info" className="mt-4">
          El PIN admin es solo un gate de UI para el MVP — no es seguridad real.
          Por defecto es <strong>1234</strong> (configurable con VITE_ADMIN_PIN).
        </Alert>
      </div>
    );

    function tryUnlock() {
      if (pin === ADMIN_PIN) {
        setUnlocked(true);
        setPinError(null);
      } else {
        setPinError('PIN incorrecto.');
      }
    }
  }

  const pendingDeposits = state.deposits.filter((d) => d.status === 'pendiente');
  const pendingWithdrawals = state.withdrawals.filter((w) => w.status === 'pendiente');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="section-title">Banca</h2>
        <Button variant="ghost" size="sm" onClick={() => setUnlocked(false)}>Bloquear</Button>
      </div>

      <div className="admin-grid">
        <StatCard label="Apostado" value={`${bankroll.staked.toFixed(2)}`} tint="sky" />
        <StatCard label="Pagado" value={`${bankroll.paid.toFixed(2)}`} tint="mint" />
        <StatCard label="Neto banca" value={`${bankroll.net.toFixed(2)}`} tint={bankroll.net >= 0 ? 'mint' : 'pink'} />
        <StatCard label="Apuestas abiertas" value={String(openBets.length)} tint="peach" />
      </div>

      <h3 className="section-title" style={{ fontSize: '1.25rem' }}>
        Depósitos pendientes ({pendingDeposits.length})
      </h3>
      {pendingDeposits.length === 0 ? (
        <EmptyState title="Sin depósitos pendientes" />
      ) : (
        <div className="list-stack mb-2">
          {pendingDeposits.map((d) => (
            <div key={d.id} className="row-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>{d.amount} USDC</strong>
                <StatusBadge status={d.status} />
              </div>
              <div className="mono mt-2">{d.address}</div>
              {d.txHash && <div className="mono">{d.txHash}</div>}
              <div className="meta">{new Date(d.createdAt).toLocaleString('es-ES')}</div>
              <div className="item-actions">
                <Button variant="lima" size="sm" onClick={() => adminCreditDeposit(d.id, true)}>
                  Acreditar
                </Button>
                <Button variant="outline" size="sm" onClick={() => adminCreditDeposit(d.id, false)}>
                  Rechazar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h3 className="section-title mt-4" style={{ fontSize: '1.25rem' }}>
        Retiros pendientes ({pendingWithdrawals.length})
      </h3>
      {pendingWithdrawals.length === 0 ? (
        <EmptyState title="Sin retiros pendientes" />
      ) : (
        <div className="list-stack mb-2">
          {pendingWithdrawals.map((w) => (
            <div key={w.id} className="row-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>{w.amount} USDC</strong>
                <StatusBadge status={w.status} />
              </div>
              <div className="mono mt-2">→ {w.toAddress}</div>
              <div className="meta">{new Date(w.createdAt).toLocaleString('es-ES')}</div>
              <Alert variant="warning" className="mt-2">
                Al aprobar, ejecuta el pago <strong>manualmente</strong> desde la tesorería.
              </Alert>
              <div className="item-actions">
                <Button variant="lima" size="sm" onClick={() => adminResolveWithdrawal(w.id, true)}>
                  Aprobar (pago manual)
                </Button>
                <Button variant="outline" size="sm" onClick={() => adminResolveWithdrawal(w.id, false)}>
                  Rechazar y devolver
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h3 className="section-title mt-4" style={{ fontSize: '1.25rem' }}>
        Apuestas abiertas ({openBets.length})
      </h3>
      {openBets.length === 0 ? (
        <EmptyState title="Sin apuestas abiertas" />
      ) : (
        <div className="list-stack">
          {openBets.slice(0, 20).map((b) => (
            <div key={b.id} className="row-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>{betLabel(b)}</strong>
                <span>{b.amount} USDC</span>
              </div>
              <div className="meta">
                Sorteo {new Date(b.drawTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} · {b.mode}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
