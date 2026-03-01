// Generates/imports HD wallets, stores encrypted seed via safeStorage,
// provides USDC balance checks and EIP-191 signing for x402 flows.

const { safeStorage } = require('electron');
const { ethers } = require('ethers');
const path = require('path');
const fs = require('fs');

// Base Mainnet config
const BASE_CHAIN_ID = 8453;
const BASE_RPC = 'https://mainnet.base.org';
const BASE_SEPOLIA_RPC = 'https://sepolia.base.org';
const USDC_ADDRESS_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // USDC on Base Mainnet
const USDC_ADDRESS_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'; // USDC on Base Sepolia
const USDC_DECIMALS = 6;

// Minimal ERC-20 ABI for balanceOf + transfer + approve
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

let dataDir = null;
let cachedWallet = null; // in-memory cached ethers.Wallet (never leaves process)

function setDataDir(dir) {
  dataDir = dir;
}

function getWalletFile() {
  return path.join(dataDir, 'flip-wallet.enc');
}

function getTxHistoryFile() {
  return path.join(dataDir, 'flip-wallet-tx.json');
}


function hasWallet() {
  return fs.existsSync(getWalletFile());
}

function createWallet() {
  const wallet = ethers.Wallet.createRandom();
  saveSeed(wallet.mnemonic.phrase);
  cachedWallet = wallet;
  return {
    address: wallet.address,
    created: true,
  };
}

function importWallet(mnemonicOrKey) {
  let wallet;
  const trimmed = mnemonicOrKey.trim();
  if (trimmed.startsWith('0x') && trimmed.length === 66) {
    // Private key import
    wallet = new ethers.Wallet(trimmed);
    saveSeed(trimmed); // store private key directly
  } else {
    // Mnemonic import
    wallet = ethers.Wallet.fromPhrase(trimmed);
    saveSeed(trimmed);
  }
  cachedWallet = wallet;
  return { address: wallet.address, imported: true };
}

function getWalletInfo() {
  const wallet = loadWallet();
  if (!wallet) return null;
  return {
    address: wallet.address,
    hasMnemonic: !!wallet.mnemonic,
  };
}

function exportMnemonic() {
  const wallet = loadWallet();
  if (!wallet) return null;
  return wallet.mnemonic?.phrase || null;
}

function deleteWallet() {
  const file = getWalletFile();
  if (fs.existsSync(file)) fs.unlinkSync(file);
  cachedWallet = null;
  // Also clear tx history
  const txFile = getTxHistoryFile();
  if (fs.existsSync(txFile)) fs.unlinkSync(txFile);
  return { deleted: true };
}


function saveSeed(seedOrKey) {
  if (!safeStorage.isEncryptionAvailable()) {
    // Fallback: base64 (less secure, but works in dev)
    fs.writeFileSync(getWalletFile(), Buffer.from(seedOrKey).toString('base64'));
    return;
  }
  const encrypted = safeStorage.encryptString(seedOrKey);
  fs.writeFileSync(getWalletFile(), encrypted);
}

function loadSeed() {
  const file = getWalletFile();
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file);
  if (!safeStorage.isEncryptionAvailable()) {
    return Buffer.from(raw.toString(), 'base64').toString('utf-8');
  }
  return safeStorage.decryptString(raw);
}

function loadWallet() {
  if (cachedWallet) return cachedWallet;
  const seed = loadSeed();
  if (!seed) return null;
  try {
    if (seed.startsWith('0x') && seed.length === 66) {
      cachedWallet = new ethers.Wallet(seed);
    } else {
      cachedWallet = ethers.Wallet.fromPhrase(seed);
    }
    return cachedWallet;
  } catch (e) {
    console.error('[Wallet] Failed to load wallet:', e.message);
    return null;
  }
}


function getProvider(testnet = false) {
  const rpc = testnet ? BASE_SEPOLIA_RPC : BASE_RPC;
  return new ethers.JsonRpcProvider(rpc);
}

function getUsdcAddress(testnet = false) {
  return testnet ? USDC_ADDRESS_SEPOLIA : USDC_ADDRESS_BASE;
}

async function getBalance(testnet = false) {
  const wallet = loadWallet();
  if (!wallet) return { error: 'No wallet' };
  try {
    const provider = getProvider(testnet);
    const [ethBal, usdcBal] = await Promise.all([
      provider.getBalance(wallet.address),
      getUsdcBalance(wallet.address, provider, testnet),
    ]);
    return {
      address: wallet.address,
      eth: ethers.formatEther(ethBal),
      usdc: ethers.formatUnits(usdcBal, USDC_DECIMALS),
      network: testnet ? 'base-sepolia' : 'base',
      chainId: testnet ? 84532 : BASE_CHAIN_ID,
    };
  } catch (e) {
    return { error: e.message, address: wallet.address };
  }
}

async function getUsdcBalance(address, provider, testnet = false) {
  try {
    const usdc = new ethers.Contract(getUsdcAddress(testnet), ERC20_ABI, provider);
    return await usdc.balanceOf(address);
  } catch {
    return 0n;
  }
}


async function sendUsdc(toAddress, amountStr, testnet = false) {
  const wallet = loadWallet();
  if (!wallet) return { error: 'No wallet' };
  try {
    const provider = getProvider(testnet);
    const signer = wallet.connect(provider);
    const usdc = new ethers.Contract(getUsdcAddress(testnet), ERC20_ABI, signer);
    const amount = ethers.parseUnits(amountStr, USDC_DECIMALS);
    const tx = await usdc.transfer(toAddress, amount);
    const receipt = await tx.wait();
    const entry = {
      id: Date.now(),
      type: 'send',
      to: toAddress,
      amount: amountStr,
      asset: 'USDC',
      txHash: receipt.hash,
      network: testnet ? 'base-sepolia' : 'base',
      timestamp: Date.now(),
    };
    saveTxHistory(entry);
    return { success: true, txHash: receipt.hash };
  } catch (e) {
    return { error: e.message };
  }
}

async function sendEth(toAddress, amountStr, testnet = false) {
  const wallet = loadWallet();
  if (!wallet) return { error: 'No wallet' };
  try {
    const provider = getProvider(testnet);
    const signer = wallet.connect(provider);
    const tx = await signer.sendTransaction({
      to: toAddress,
      value: ethers.parseEther(amountStr),
    });
    const receipt = await tx.wait();
    const entry = {
      id: Date.now(),
      type: 'send',
      to: toAddress,
      amount: amountStr,
      asset: 'ETH',
      txHash: receipt.hash,
      network: testnet ? 'base-sepolia' : 'base',
      timestamp: Date.now(),
    };
    saveTxHistory(entry);
    return { success: true, txHash: receipt.hash };
  } catch (e) {
    return { error: e.message };
  }
}


async function signX402Payment(paymentRequirements) {
  const wallet = loadWallet();
  if (!wallet) return { error: 'No wallet' };
  try {
    const { price, payTo, network } = paymentRequirements;
    const testnet = network?.includes('84532');
    const provider = getProvider(testnet);
    const signer = wallet.connect(provider);
    const usdcAddr = getUsdcAddress(testnet);
    const usdc = new ethers.Contract(usdcAddr, ERC20_ABI, signer);
    const amount = ethers.parseUnits(price.replace('$', ''), USDC_DECIMALS);

    // Check USDC balance
    const bal = await usdc.balanceOf(wallet.address);
    if (bal < amount) {
      return { error: `Insufficient USDC. Need ${price}, have $${ethers.formatUnits(bal, USDC_DECIMALS)}` };
    }

    // For x402 exact scheme: sign an EIP-191 authorization message
    // The facilitator will submit the actual on-chain transfer
    const deadline = Math.floor(Date.now() / 1000) + 300; // 5 min validity
    const message = ethers.solidityPacked(
      ['address', 'address', 'uint256', 'uint256', 'address'],
      [wallet.address, payTo, amount, deadline, usdcAddr]
    );
    const messageHash = ethers.keccak256(message);
    const signature = await signer.signMessage(ethers.getBytes(messageHash));

    return {
      scheme: 'exact',
      network: network || `eip155:${testnet ? 84532 : BASE_CHAIN_ID}`,
      payload: {
        signature,
        from: wallet.address,
        to: payTo,
        amount: amount.toString(),
        token: usdcAddr,
        deadline,
        chainId: testnet ? 84532 : BASE_CHAIN_ID,
      },
    };
  } catch (e) {
    return { error: e.message };
  }
}


function getTxHistory() {
  try {
    const file = getTxHistoryFile();
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return [];
  }
}

function saveTxHistory(entry) {
  const history = getTxHistory();
  history.unshift(entry);
  // Keep last 500 transactions
  const trimmed = history.slice(0, 500);
  fs.writeFileSync(getTxHistoryFile(), JSON.stringify(trimmed, null, 2));
}

function addTxRecord(entry) {
  saveTxHistory(entry);
  return { success: true };
}

module.exports = {
  setDataDir,
  hasWallet,
  createWallet,
  importWallet,
  getWalletInfo,
  exportMnemonic,
  deleteWallet,
  getBalance,
  sendUsdc,
  sendEth,
  signX402Payment,
  getTxHistory,
  addTxRecord,
};
