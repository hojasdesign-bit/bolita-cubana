/** WalletDrawer — modos demo/testnet, depósito, retiro y movimientos. */
import { useEffect, useState } from 'react';
import {
  Drawer, Button, Input, Alert, Badge, Card,
  BalanceCard, AddressChip, EmptyState,
} from '../ds.js';
import { useBolita } from '../lib/store.jsx';
import {
  connectWallet, getUsdcBalance, depositToTreasury, shortAddress,
  USDC_ADDRESS_BASE_SEPOLIA, BASE_SEPOLIA_CHAIN_ID,
} from '../lib/wallet.js';

const TREASURY = import.meta.env.VITE_TREASURY_ADDRESS || '';
const TREASURY_OK = /^0x[0-9a-fA-F]{40}$/.test(TREASURY);

function StatusBadge({ status }) {
  const map = {
    pendiente: 'warning', acreditado: 'success', aprobado: 'info',
    rechazado: 'danger', pagado: 'success',
  };
  return <Badge variant={map[status] || 'neutral'}>{status}</Badge>;
}

export function WalletDrawer({ open, onClose }) {
  const {
    state, balance, setMode, setWalletAddress, disconnectWallet,
    requestDeposit, requestWithdraw, resetDemo,
  } = useBolita();

  const [signer, setSigner] = useState(null);
  const [provider, setProvider] = useState(null);
  const [onchain, setOnchain] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const [depAmount, setDepAmount] = useState('10');
  const [depTx, setDepTx] = useState('');
  const [wdAmount, setWdAmount] = useState('');
  const [wdTo, setWdTo] = useState('');

  const address = state.walletAddress;
  const isTestnet = state.mode === 'testnet';

  const refreshOnchain = async (prov, addr) => {
    if (!prov || !addr) return;
    try {
      setOnchain(await getUsdcBalance(prov, addr));
    } catch {
      setOnchain(null);
    }
  };

  const doConnect = async () => {
    setErr(null);
    setBusy(true);
    try {
      const { address: addr, provider: prov, signer: s } = await connectWallet();
      setWalletAddress(addr);
      setProvider(prov);
      setSigner(s);
      setMode('testnet');
      refreshOnchain(prov, addr);
    } catch (e) {
      setErr(e.message || 'No se pudo conectar la wallet.');
    } finally {
      setBusy(false);
    }
  };

  const doDisconnect = () => {
    disconnectWallet();
    setSigner(null);
    setProvider(null);
    setOnchain(null);
  };

  const doDepositOnchain = async () => {
    setErr(null);
    const amount = Number(String(depAmount).replace(',', '.'));
    if (!(amount > 0)) { setErr('Escribe un monto válido para depositar.'); return; }
    if (!TREASURY_OK) { setErr('La banca aún no configuró su dirección de tesorería.'); return; }
    if (!signer) { setErr('Conecta tu wallet primero.'); return; }
    setBusy(true);
    try {
      const hash = await depositToTreasury(signer, TREASURY, amount);
      requestDeposit({ amount, txHash: hash });
      setDepTx(hash);
      refreshOnchain(provider, address);
    } catch (e) {
      setErr(e.message || 'El depósito fue rechazado en la wallet.');
    } finally {
      setBusy(false);
    }
  };

  const doRegisterManual = () => {
    const amount = Number(String(depAmount).replace(',', '.'));
    const res = requestDeposit({ amount, txHash: depTx });
    if (!res.ok) setErr(res.error);
    else { setDepTx(''); setErr(null); }
  };

  const doWithdraw = () => {
    setErr(null);
    const amount = Number(String(wdAmount).replace(',', '.'));
    const res = requestWithdraw({ amount, toAddress: wdTo || address });
    if (!res.ok) setErr(res.error);
    else { setWdAmount(''); setWdTo(''); }
  };

  const myDeposits = state.deposits.filter((d) => address && d.address === address.toLowerCase());
  const myWithdrawals = state.withdrawals.filter((w) => address && w.address === address.toLowerCase());

  useEffect(() => {
    if (open && provider && address) refreshOnchain(provider, address);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open ]);

  return (
    <Drawer open={open} onClose={onClose} title="Mi wallet" position="bottom">
      {err && <Alert variant="danger" className="mb-2">{err}</Alert>}

      <div className="wallet-block">
        <h3>Modo de juego</h3>
        <div className="mode-switch">
          <Button
            variant={state.mode === 'demo' ? 'primary' : 'outline'}
            fullWidth
            onClick={() => setMode('demo')}
          >
            Demo
          </Button>
          <Button
            variant={state.mode === 'testnet' ? 'primary' : 'outline'}
            fullWidth
            onClick={() => (address ? setMode('testnet') : doConnect())}
          >
            Testnet
          </Button>
        </div>
        <Alert variant="info">
          <strong>Demo:</strong> 1.000 USDC ficticios, sin wallet, todo instantáneo.{' '}
          <strong>Testnet:</strong> USDC real de prueba en Base Sepolia (chain {BASE_SEPOLIA_CHAIN_ID}).
          Nada aquí es dinero real.
        </Alert>
      </div>

      {!isTestnet && (
        <div className="wallet-block">
          <BalanceCard
            balance={balance}
            currency="USDC"
            label="Saldo demo"
            onSend={() => {}}
            onReceive={() => {}}
          />
          <Button variant="outline" fullWidth className="mt-2" onClick={resetDemo}>
            Recargar 1.000 USDC demo
          </Button>
        </div>
      )}

      {isTestnet && (
        <>
          <div className="wallet-block">
            <h3>Conexión</h3>
            {!address ? (
              <Button variant="brand" fullWidth loading={busy} onClick={doConnect}>
                Conectar MetaMask
              </Button>
            ) : (
              <>
                <AddressChip address={address} />
                <p className="mono mt-2">{shortAddress(address)}</p>
                <Button variant="ghost" size="sm" onClick={doDisconnect}>Desconectar</Button>
              </>
            )}
          </div>

          {address && (
            <>
              <div className="wallet-block">
                <BalanceCard
                  balance={balance}
                  currency="USDC"
                  label="Saldo para jugar (testnet)"
                  onSend={() => {}}
                  onReceive={() => {}}
                />
                <p className="section-sub mt-2">
                  En tu wallet (on-chain): {onchain == null ? '…' : `${onchain.toFixed(2)} USDC`}
                </p>
              </div>

              <div className="wallet-block">
                <h3>Depositar</h3>
                {!TREASURY_OK && (
                  <Alert variant="warning" className="mb-2">
                    La banca aún no configuró su dirección de tesorería (VITE_TREASURY_ADDRESS).
                  </Alert>
                )}
                <p className="section-sub">Dirección de tesorería de la banca:</p>
                {TREASURY_OK ? <AddressChip address={TREASURY} /> : <p className="mono">sin configurar</p>}
                <ol className="steps">
                  <li>Consigue USDC de prueba en <strong>faucet.circle.com</strong> (red Base Sepolia).</li>
                  <li>Envía USDC a la tesorería desde tu wallet.</li>
                  <li>Registra el depósito aquí para que la banca lo acredite.</li>
                </ol>
                <Input
                  label="Monto a depositar (USDC)"
                  type="number" min="0" step="0.01"
                  value={depAmount} onChange={(e) => setDepAmount(e.target.value)}
                  fullWidth
                />
                <div className="mt-2" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Button variant="lima" loading={busy} onClick={doDepositOnchain} disabled={!TREASURY_OK}>
                    Enviar con MetaMask
                  </Button>
                </div>
                <Input
                  label="¿Ya lo enviaste manualmente? Pega el hash (opcional)"
                  value={depTx} onChange={(e) => setDepTx(e.target.value)}
                  placeholder="0x…"
                  fullWidth
                  hint="La banca acredita los depósitos manualmente en este MVP."
                />
                <Button variant="outline" fullWidth className="mt-2" onClick={doRegisterManual}>
                  Registrar depósito
                </Button>

                {myDeposits.length > 0 && (
                  <div className="list-stack mt-4">
                    {myDeposits.map((d) => (
                      <div key={d.id} className="row-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong>Depósito · {d.amount} USDC</strong>
                          <StatusBadge status={d.status} />
                        </div>
                        {d.txHash && <div className="mono mt-2">{d.txHash}</div>}
                        <div className="meta">{new Date(d.createdAt).toLocaleString('es-ES')}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="wallet-block">
                <h3>Retirar</h3>
                <Alert variant="warning" className="mb-2">
                  Los retiros los ejecuta la banca <strong>manualmente</strong> en este MVP.
                </Alert>
                <Input
                  label="Monto a retirar (USDC)"
                  type="number" min="0" step="0.01"
                  value={wdAmount} onChange={(e) => setWdAmount(e.target.value)}
                  fullWidth
                />
                <Input
                  label="Dirección de destino (opcional)"
                  value={wdTo} onChange={(e) => setWdTo(e.target.value)}
                  placeholder={address}
                  fullWidth
                />
                <Button variant="primary" fullWidth className="mt-2" onClick={doWithdraw}>
                  Solicitar retiro
                </Button>

                {myWithdrawals.length > 0 && (
                  <div className="list-stack mt-4">
                    {myWithdrawals.map((w) => (
                      <div key={w.id} className="row-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong>Retiro · {w.amount} USDC</strong>
                          <StatusBadge status={w.status} />
                        </div>
                        <div className="mono mt-2">{w.toAddress}</div>
                        <div className="meta">{new Date(w.createdAt).toLocaleString('es-ES')}</div>
                      </div>
                    ))}
                  </div>
                )}
                {myWithdrawals.length === 0 && myDeposits.length === 0 && (
                  <EmptyState
                    title="Sin movimientos"
                    description="Tus depósitos y retiros aparecerán aquí."
                  />
                )}
              </div>

              <div className="wallet-block">
                <h3>Contrato USDC</h3>
                <p className="mono">{USDC_ADDRESS_BASE_SEPOLIA}</p>
                <p className="section-sub">USDC nativo de Circle en Base Sepolia · 6 decimales · solo testnet.</p>
              </div>
            </>
          )}
        </>
      )}
    </Drawer>
  );
}
