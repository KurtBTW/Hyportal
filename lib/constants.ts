// HyPortal Constants

// ============ CHAIN CONFIGURATION ============

// HyperEVM Mainnet
export const HYPEREVM_CHAIN_ID = 999;
export const HYPEREVM_RPC = process.env.NEXT_PUBLIC_HYPEREVM_RPC_URL || "https://rpc.hyperliquid.xyz/evm";
export const HYPEREVM_EXPLORER = "https://hyperscan.xyz";

// HyperEVM Chain Config for wallet
export const HYPEREVM_CHAIN = {
  chainId: `0x${HYPEREVM_CHAIN_ID.toString(16)}`, // 0x3e7
  chainName: "HyperEVM",
  nativeCurrency: {
    name: "HYPE",
    symbol: "HYPE",
    decimals: 18,
  },
  rpcUrls: [HYPEREVM_RPC],
  blockExplorerUrls: [HYPEREVM_EXPLORER],
};

// Solana
export const SOLANA_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
export const SOLANA_EXPLORER = "https://solscan.io";

// ============ TOKEN ADDRESSES ============

// Solana USDC (Native)
export const SOLANA_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

// SOL (Native) - for Jupiter
export const SOLANA_SOL_MINT = "So11111111111111111111111111111111111111112";

// HyperEVM USDC (Wormhole bridged) - will be resolved dynamically
// This is the expected address, but we verify against HypurrFi reserves
export const HYPEREVM_USDC_EXPECTED = "0x2e4f4d1b9a2c4f2b8c1e3a4d5f6e7a8b9c0d1e2f"; // Placeholder - resolved dynamically

// ============ HYPURRFI (AAVE V3 FORK) ADDRESSES ============

export const HYPURRFI_POOL = "0xceCcE0EB9DD2Ef7996e01e25DD70e461F918A14b";
export const HYPURRFI_PROTOCOL_DATA_PROVIDER = "0x895C799a5bbdCb63B80bEE5BD94E7b9138D977d6";

// ============ DECIMALS ============

export const USDC_DECIMALS = 6;
export const SOL_DECIMALS = 9;

// ============ MINIMAL ABIs ============

export const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function symbol() view returns (string)",
];

export const AAVE_POOL_ABI = [
  "function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)",
  "function withdraw(address asset, uint256 amount, address to) returns (uint256)",
];

export const PROTOCOL_DATA_PROVIDER_ABI = [
  "function getAllReservesTokens() view returns (tuple(string symbol, address tokenAddress)[])",
  "function getUserReserveData(address asset, address user) view returns (uint256 currentATokenBalance, uint256 currentStableDebt, uint256 currentVariableDebt, uint256 principalStableDebt, uint256 scaledVariableDebt, uint256 stableBorrowRate, uint256 liquidityRate, uint40 stableRateLastUpdated, bool usageAsCollateralEnabled)",
];

// ============ JUPITER API ============

export const JUPITER_API_BASE = "https://quote-api.jup.ag/v6";

// ============ WORMHOLE CONNECT CONFIG ============

// Wormhole chain names
export const WORMHOLE_SOLANA_CHAIN = "Solana";
export const WORMHOLE_HYPEREVM_CHAIN = "evmos"; // HyperEVM uses evmos identifier in Wormhole

// ============ HELPER FUNCTIONS ============

export const formatSolanaExplorerUrl = (txHash: string) => 
  `${SOLANA_EXPLORER}/tx/${txHash}`;

export const formatHyperEvmExplorerUrl = (txHash: string) => 
  `${HYPEREVM_EXPLORER}/tx/${txHash}`;

export const formatUsdcAmount = (amount: bigint): string => {
  const num = Number(amount) / 10 ** USDC_DECIMALS;
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
};

export const parseUsdcAmount = (amount: string): bigint => {
  const num = parseFloat(amount);
  return BigInt(Math.floor(num * 10 ** USDC_DECIMALS));
};

export const formatSolAmount = (lamports: bigint): string => {
  const num = Number(lamports) / 10 ** SOL_DECIMALS;
  return num.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 9 });
};

export const parseSolAmount = (amount: string): bigint => {
  const num = parseFloat(amount);
  return BigInt(Math.floor(num * 10 ** SOL_DECIMALS));
};
