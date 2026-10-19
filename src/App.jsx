/** Bolita Crypto — la bolita cubana con USDC (testnet/demo). */
import { useMemo, useState } from 'react';
import {
  Button, Card, StatCard, Ticker, StickerBadge, Badge,
  TransactionRow, EmptyState, Alert, PriceTag,
} from './ds.js';
import { useBolita } from './lib/store.jsx';
import { BET_TYPES, betLabel, pad2 } from './lib/bolita.js';
import { Countdown } from './components/Countdown.jsx';
import { NumberGrid } from './components/NumberGrid.jsx';
import { BetSlip } from './components/BetSlip.jsx';
import { WalletDrawer } from './components/WalletDrawer.jsx';
import { DrawHistory } from './components/DrawHistory.jsx';
import { HowToPlay } from './components/HowToPlay.jsx';
import { AdminPanel } from './components/AdminPanel.jsx';

const TABS = [
  { id: 'jugar', label: 'Jugar' },
  { id: 'jugadas', label: 'Jugadas' },
  { id: 'sorteos', label: 'Sorteos' },
  { id: 'aprende', label: 'Aprende' },
  { id: 'banca', label: 'Banca' },
];

const TICKER_ITEMS = [
  'Sorteos cada 10 minutos',
  'Paga hasta 5000× en el candado',
  'Sorteo verificable con drand',
  'Juega con USDC en Base Sepolia',
  'Fijo 75× · Corrido 25× · Parlé 900×',
  'La charada trae suerte: 16, 99…',
];

function Hero({ onPlay }) {
  const { state, openBets } = useBolita();
  const pool = useMemo(
    () => openBets.reduce((a, b) => a + b.amount, 0),
    [openBets],
  );
  const lastDraw = state.draws[0];

  return (
    <section className="hero">
      <div className="hero-badges">
        <StickerBadge tint="lima">Testnet</StickerBadge>
        <StickerBadge tint="sky">100% verificable</StickerBadge>
        <StickerBadge tint="peach">Paga 5000×</StickerBadge>
      </div>
      <h1 className="hero-title">
        Bolita<br /><span className="hl">Crypto</span>
      </h1>
      <p className="hero-sub">
        La bolita cubana de toda la vida, ahora con USDC.
        Sorteos cada 10 minutos, verificables por cualquiera.
      </p>

      <div className="hero-cards">
        <Card variant="pastel" tint="mint">
          <div className="countdown-note" style={{ marginBottom: 4 }}>Próximo sorteo en</div>
          <Countdown />
        </Card>
        <StatCard
          label="En juego ahora"
          value={`${pool.toFixed(0)} USDC`}
          tint="peach"
        />
      </div>

      {lastDraw && (
        <Card variant="outline" className="mb-2" style={{ textAlign: 'left' }}>
          <div className="countdown-note" style={{ marginBottom: 6 }}>Último sorteo</div>
          <div className="draw-balls">
            {lastDraw.numbers.map((n, i) => (
              <span key={i} className="ball ball--win ball--sm">{pad2(n)}</span>
            ))}
          </div>
        </Card>
      )}

      <Button variant="lima" size="lg" fullWidth onClick={onPlay}>
        Jugar ahora
      </Button>
    </section>
  );
}

function MyBets() {
  const { state } = useBolita();
  const [filter, setFilter] = useState('todas');

  const bets = state.bets.filter((b) =>
    filter === 'todas' ? true : b.status === filter,
  );

  const rowProps = (b) => {
    const won = b.status === 'ganada';
    const lost = b.status === 'perdida';
    return {
      type: won ? 'receive' : lost ? 'send' : 'swap',
      title: betLabel(b),
      date: `${new Date(b.drawTime).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${b.mode}`,
      amount: won ? (b.payout || 0) : -b.amount,
      status: b.status === 'pendiente' ? 'pending' : won ? 'completed' : 'failed',
    };
  };

  return (
    <div>
      <div className="filters">
        {[
          ['todas', 'Todas'],
          ['pendiente', 'Pendientes'],
          ['ganada', 'Ganadas'],
          ['perdida', 'Perdidas'],
        ].map(([v, l]) => (
          <button
            key={v}
            type="button"
            className={`filter-chip${filter === v ? ' is-active' : ''}`}
            onClick={() => setFilter(v)}
          >
            {l}
          </button>
        ))}
      </div>
      {bets.length === 0 ? (
        <EmptyState
          title="Sin jugadas"
          description="Cuando juegues, tus boletos aparecerán aquí con su estado."
        />
      ) : (
        <div className="list-stack">
          {bets.map((b) => (
            <div key={b.id}>
              <TransactionRow {...rowProps(b)} />
              {b.resultDetail && b.status !== 'pendiente' && (
                <div className="meta" style={{ padding: '0 4px 8px' }}>{b.resultDetail}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const { state, balance, setMode } = useBolita();
  const [tab, setTab] = useState('jugar');
  const [walletOpen, setWalletOpen] = useState(false);
  const [betType, setBetType] = useState('fijo');
  const [selected, setSelected] = useState([]);
  const [justPlaced, setJustPlaced] = useState(null);

  const changeBetType = (t) => {
    setBetType(t);
    setSelected([]);
  };

  const goPlay = () => {
    setTab('jugar');
    setTimeout(() => {
      document.getElementById('selector')?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  return (
    <div className="bolita">
      <div className="marquee-band">
        <Ticker items={TICKER_ITEMS} speed="normal" />
      </div>

      <header className="header">
        <div className="header-inner">
          <span className="logo">Bolita<span className="logo-bolt">⚡</span>Crypto</span>
          <span className="header-spacer" />
          <Badge variant={state.mode === 'demo' ? 'neutral' : 'brand'}>
            {state.mode === 'demo' ? 'DEMO' : 'TESTNET'}
          </Badge>
          <Button variant="primary" size="sm" onClick={() => setWalletOpen(true)}>
            {balance.toFixed(0)} USDC · Wallet
          </Button>
        </div>
      </header>

      <main className="wrap">
        {tab === 'jugar' && (
          <>
            <Hero onPlay={goPlay} />

            <section className="section" id="selector">
              <h2 className="section-title">Elige tus números</h2>
              <p className="section-sub">
                Del 00 al 99 · {BET_TYPES[betType].desc}
              </p>
              <NumberGrid selected={selected} onChange={setSelected} betType={betType} />
            </section>

            <section className="section" style={{ paddingTop: 0 }}>
              <h2 className="section-title">Tu boleto</h2>
              <p className="section-sub">
                {selected.length > 0
                  ? `Números: ${selected.map(pad2).join(' · ')}`
                  : 'Selecciona tus números arriba.'}
              </p>
              <BetSlip
                betType={betType}
                setBetType={changeBetType}
                selected={selected}
                onPlaced={(bet) => {
                  setJustPlaced(bet);
                  setSelected([]);
                  setTab('jugadas');
                }}
              />
              {justPlaced && tab === 'jugar' && (
                <Alert variant="success" className="mt-4">
                  ¡Boleto registrado! {betLabel(justPlaced)} · {justPlaced.amount} USDC.
                </Alert>
              )}
            </section>
          </>
        )}

        {tab === 'jugadas' && (
          <section className="section">
            <h2 className="section-title">Mis jugadas</h2>
            <p className="section-sub">Boletos pendientes, ganados y perdidos.</p>
            <MyBets />
          </section>
        )}

        {tab === 'sorteos' && (
          <section className="section">
            <h2 className="section-title">Historial de sorteos</h2>
            <p className="section-sub">
              Cada sorteo guarda la ronda drand y el hash para que cualquiera lo verifique.
            </p>
            <DrawHistory />
          </section>
        )}

        {tab === 'aprende' && (
          <section className="section">
            <h2 className="section-title">Cómo se juega</h2>
            <p className="section-sub">Cuatro formas de jugar, del 00 al 99.</p>
            <HowToPlay />
          </section>
        )}

        {tab === 'banca' && (
          <section className="section">
            <AdminPanel />
          </section>
        )}
      </main>

      <nav className="tabbar" aria-label="Navegación principal">
        <div className="tabbar-inner">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`tab${tab === t.id ? ' is-active' : ''}`}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
            >
              <span className="dot" aria-hidden="true" />
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <WalletDrawer open={walletOpen} onClose={() => setWalletOpen(false)} />
    </div>
  );
}
