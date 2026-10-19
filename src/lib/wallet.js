/**
 * wallet.js — Conexión MetaMask + USDC en Base Sepolia (testnet).
 * NUNCA se piden ni se guardan claves privadas o seed phrases:
 * todo se firma en la wallet del usuario vía window.ethereum.
 */
import { ethers } from 'ethers';
import {
  BASE_SEPOLIA_CHAIN_ID,
  BASE_SEPOLIA_CHAIN_ID_HEX,
  USDC_ADDRESS_BASE_SEPOLIA,
  USDC_DECIMALS,
} from './bolita.js';

export { BASE_SEPOLIA_CHAIN_ID, USDC_ADDRESS_BASE_SEPOLIA, USDC_DECIMALS };

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

const BASE_SEPOLIA_PARAMS = {
  chainId: BASE_SEPOLIA_CHAIN_ID_HEX,
  chainName: 'Base Sepolia',
  nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://sepolia.base.org'],
  blockExplorerUrls: ['https://sepolia.basescan.org'],
};

function getEthereum() {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('No se detectó wallet. Instala MetaMask para usar el modo testnet.');
  }
  return window.ethereum;
}

/** Conecta la wallet y cambia a Base Sepolia si hace falta. Devuelve { address, provider, signer }. */
export async function connectWallet() {
  const eth = getEthereum();
  const provider = new ethers.BrowserProvider(eth);
  await provider.send('eth_requestAccounts', []);
  await ensureBaseSepolia(provider);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  return { address, provider, signer };
}

/** Cambia la red a Base Sepolia (la agrega si no existe). */
export async function ensureBaseSepolia(provider) {
  const net = await provider.getNetwork();
  if (Number(net.chainId) === BASE_SEPOLIA_CHAIN_ID) return;
  const eth = getEthereum();
  try {
    await eth.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BASE_SEPOLIA_CHAIN_ID_HEX }],
    });
  } catch (err) {
    if (err?.code === 4902) {
      await eth.request({ method: 'wallet_addEthereumChain', params: [BASE_SEPOLIA_PARAMS] });
    } else {
      throw err;
    }
  }
}

function usdcContract(providerOrSigner) {
  return new ethers.Contract(USDC_ADDRESS_BASE_SEPOLIA, ERC20_ABI, providerOrSigner);
}

/** Balance de USDC (testnet) de una dirección, como número. */
export async function getUsdcBalance(provider, address) {
  const c = usdcContract(provider);
  const raw = await c.balanceOf(address);
  return Number(ethers.formatUnits(raw, USDC_DECIMALS));
}

/**
 * Depósito on-chain: transfiere USDC de testnet a la tesorería.
 * La firma ocurre en MetaMask; aquí solo se construye la transacción.
 */
export async function depositToTreasury(signer, treasury, amount) {
  if (!ethers.isAddress(treasury)) throw new Error('Dirección de tesorería inválida.');
  const c = usdcContract(signer);
  const units = ethers.parseUnits(String(amount), USDC_DECIMALS);
  const tx = await c.transfer(treasury, units);
  return tx.hash;
}

/** Acorta una dirección para mostrarla. */
export function shortAddress(addr) {
  if (!addr || addr.length < 10) return addr ?? '';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
