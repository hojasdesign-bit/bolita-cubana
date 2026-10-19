# Bolita Crypto

La bolita cubana con criptomonedas — MVP web (React + Vite, español, mobile-first).

- **Juego:** números del 00 al 99. Fijo 75× · Corrido 25× · Parlé 900× · Candado 5000×.
- **Sorteos verificables:** cada 10 minutos, 3 números derivados del beacon de
  aleatoriedad **drand** (`round` + `randomness` → SHA-256 → bytes mod 100).
  Cada sorteo guarda ronda, randomness, hash y enlace de verificación.
- **Crypto (solo testnet/demo, sin dinero real):**
  - **Modo demo:** 1.000 USDC ficticios, sin wallet, todo instantáneo.
  - **Modo testnet:** MetaMask en **Base Sepolia** (chainId 84532), USDC de prueba de Circle.
    Los depósitos van a la tesorería de la banca on-chain; la banca **acredita saldos
    y ejecuta retiros manualmente** en este MVP (etiquetado honesto en la UI).
- **Persistencia:** localStorage (apuestas, saldos demo, historial). Sin backend.
- **Diseño:** componentes del sistema [Voltaje DS](../design-system) (`voltaje-ds`),
  estética festiva estilo megapot (pasteles, sticker badges, marquesina).

## Cómo correrlo

```bash
cd ~/workspace/bolita-crypto
npm install
npm run dev      # desarrollo → http://localhost:5173
npm run build    # build de producción (dist/)
npm run test:draw  # verifica la lógica del sorteo con node (22 pruebas)
```

## Configuración (.env)

```bash
cp .env.example .env
```

| Variable | Qué es |
|---|---|
| `VITE_TREASURY_ADDRESS` | **Tu dirección** en Base Sepolia. Recibe los depósitos USDC de testnet. Sin esto, la UI avisa que la tesorería no está configurada. |
| `VITE_ADMIN_PIN` | PIN del panel Banca (default `1234`). Es solo un gate de interfaz, **no seguridad real**. |
| `VITE_DRAW_INTERVAL_MS` | Intervalo entre sorteos (default `600000` = 10 min). |
| `VITE_BET_CLOSE_SECONDS` | Cierre de apuestas antes del sorteo (default `60`). |

## Conseguir USDC de testnet

1. Instala MetaMask y cambia a la red **Base Sepolia** (la app lo hace sola al conectar).
2. Pide USDC de prueba en **faucet.circle.com** (red Base Sepolia).
   Contrato USDC verificado en Base Sepolia: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
   (verificado contra docs de Circle y guías cruzadas con CDP; 6 decimales).
3. En la app (Wallet → Testnet → Depositar): envía USDC a la tesorería y registra
   el depósito; la banca lo acredita desde el panel Banca.

> **Nunca** se piden ni se guardan claves privadas o seed phrases: todo se firma
> en MetaMask vía `window.ethereum`.

## Cómo funciona el sorteo

1. Cada 10 min (alineado a epoch) la app consulta `https://drand.cloudflare.com/public/latest`
   (respaldo: `https://api.drand.sh/public/latest`; último recurso: aleatoriedad local etiquetada).
2. Calcula `SHA-256("round:randomness")` y toma bytes mod 100 saltando duplicados
   (re-hash si hiciera falta) → 3 números ganadores.
3. Evalúa las jugadas pendientes de ese sorteo y acredita premios al instante.
4. El historial guarda ronda drand, randomness, hash y enlace verificable.

Las apuestas cierran 60 segundos antes de cada sorteo.

## Estructura

```
src/
  lib/
    bolita.js   # reglas puras: tipos de jugada, charada, derivación, evaluación, calendario
    drand.js    # cliente del beacon drand + SHA-256 (WebCrypto)
    wallet.js   # ethers v6: MetaMask, cambio de red, USDC, depósitos
    store.jsx   # estado global + localStorage (apuestas, saldos, banca)
  components/
    Countdown.jsx  NumberGrid.jsx  BetSlip.jsx  WalletDrawer.jsx
    DrawHistory.jsx  HowToPlay.jsx  AdminPanel.jsx
  App.jsx  main.jsx  index.css  ds.js   # ds.js re-exporta Voltaje DS por ruta relativa
scripts/test-draw.mjs  # pruebas node de la lógica del sorteo
```

## Roadmap

- [ ] **Contrato escrow** en Base Sepolia: apuestas y pagos on-chain (hoy las
      apuestas se registran off-chain y la banca paga manualmente).
- [ ] Indexador de depósitos (detectar el `Transfer` a tesorería y acreditar solo).
- [ ] PIN admin real / roles (hoy es solo gate de UI).
- [ ] Endurecer reglas: límites de apuesta, anti-spam, pausas de emergencia.
- [ ] Auditoría de seguridad del contrato antes de cualquier **mainnet**
      (hoy: testnet/demo únicamente, por diseño).

## Decisiones pendientes de Adrián

- Su dirección de tesorería (`VITE_TREASURY_ADDRESS`).
- Despliegue (¿Cloudflare Pages como los otros proyectos?).
- Si quiere repo en GitHub para este proyecto.
