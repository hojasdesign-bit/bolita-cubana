/** DrawHistory — historial de sorteos con datos de verificación drand. */
import { Badge, Card, EmptyState } from '../ds.js';
import { pad2 } from '../lib/bolita.js';
import { useBolita } from '../lib/store.jsx';

export function DrawHistory() {
  const { state } = useBolita();

  if (state.draws.length === 0) {
    return (
      <EmptyState
        title="Aún no hay sorteos"
        description="El primer sorteo se resuelve automáticamente cada 10 minutos."
      />
    );
  }

  return (
    <div className="list-stack">
      {state.draws.map((d) => (
        <Card key={d.drawTime} variant="outline" padding="md">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong>{new Date(d.drawTime).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</strong>
            <Badge variant={d.beacon.source === 'local (demo)' ? 'warning' : 'success'}>
              {d.beacon.source}
            </Badge>
          </div>
          <div className="draw-balls mb-2">
            {d.numbers.map((n, i) => (
              <span key={i} className="ball ball--win ball--sm">{pad2(n)}</span>
            ))}
          </div>
          <div className="meta">
            Ronda drand: <span className="mono">{d.beacon.round ?? '—'}</span>
          </div>
          <div className="meta">
            Randomness: <span className="mono">{d.beacon.randomness.slice(0, 20)}…</span>
          </div>
          <div className="meta">
            SHA-256: <span className="mono">{d.hashHex.slice(0, 20)}…</span>
          </div>
          {d.beacon.verifyUrl && (
            <a className="verify-link" href={d.beacon.verifyUrl} target="_blank" rel="noreferrer">
              Verificar en drand →
            </a>
          )}
        </Card>
      ))}
    </div>
  );
}
