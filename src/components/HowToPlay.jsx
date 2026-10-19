/** HowToPlay — explica los 4 tipos de jugada con ejemplos. */
import { Card, Alert, StickerBadge } from '../ds.js';
import { BET_TYPES, DRAW_INTERVAL_MS } from '../lib/bolita.js';

const TINTS = { fijo: 'sky', corrido: 'mint', parle: 'peach', candado: 'pink' };

export function HowToPlay() {
  return (
    <div>
      <div className="center mb-2">
        <StickerBadge tint="lima" size="lg">Sorteos cada {DRAW_INTERVAL_MS / 60000} min</StickerBadge>
      </div>
      <p className="section-sub center">
        En cada sorteo salen <strong>3 números</strong> del 00 al 99, generados con el
        beacon de aleatoriedad <strong>drand</strong> (verificable por cualquiera).
        Las apuestas cierran 60 segundos antes de cada sorteo.
      </p>

      {Object.values(BET_TYPES).map((t) => (
        <Card key={t.id} variant="pastel" tint={TINTS[t.id]} className="play-card">
          <h3>{t.title}</h3>
          <p style={{ margin: 0 }}>{t.desc}</p>
          <div className="example">
            <strong>Ejemplo:</strong> {t.example}
          </div>
        </Card>
      ))}

      <Alert variant="info" className="mt-4">
        <strong>La charada:</strong> cada número tiene su significado (el 16 es «la niña
        que todo lo brinda», el 99 el «serrucho»…). Úsala para elegir tu número de la suerte.
      </Alert>
      <Alert variant="warning" className="mt-2">
        Juegas con USDC de <strong>prueba</strong> (testnet) o saldo demo. Nada de esto
        es dinero real.
      </Alert>
    </div>
  );
}
