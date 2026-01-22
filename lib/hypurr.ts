// HypurrFi (Aave V3 Fork) Helpers
import { ethers } from "ethers";
import {
  HYPURRFI_POOL,
  HYPURRFI_PROTOCOL_DATA_PROVIDER,
  AAVE_POOL_ABI,
  PROTOCOL_DATA_PROVIDER_ABI,
  USDC_DECIMALS,
} from "./constants";
import { getHyperEvmProvider, getTokenAllowance, approveToken } from "./erc20";

export interface ReserveToken {
  symbol: string;
  tokenAddress: string;
}

export interface UserReserveData {
  currentATokenBalance: bigint;
  currentStableDebt: bigint;
  currentVariableDebt: bigint;
  principalStableDebt: bigint;
  scaledVariableDebt: bigint;
  stableBorrowRate: bigint;
  liquidityRate: bigint;
  stableRateLastUpdated: number;
  usageAsCollateralEnabled: boolean;
}

export interface ReserveData {
  liquidityRate: bigint; // Supply APY in RAY (1e27)
  variableBorrowRate: bigint;
  stableBorrowRate: bigint;
}

/**
 * Get HypurrFi Pool contract instance
 */
export function getPoolContract(signerOrProvider: ethers.Signer | ethers.Provider): ethers.Contract {
  return new ethers.Contract(HYPURRFI_POOL, AAVE_POOL_ABI, signerOrProvider);
}

/**
 * Get Protocol Data Provider contract instance
 */
export function getProtocolDataProvider(
  signerOrProvider: ethers.Signer | ethers.Provider
): ethers.Contract {
  return new ethers.Contract(
    HYPURRFI_PROTOCOL_DATA_PROVIDER,
    PROTOCOL_DATA_PROVIDER_ABI,
    signerOrProvider
  );
}

/**
 * Get all reserve tokens listed in HypurrFi
 */
export async function getAllReservesTokens(
  provider?: ethers.Provider
): Promise<ReserveToken[]> {
  const _provider = provider || getHyperEvmProvider();
  const dataProvider = getProtocolDataProvider(_provider);
  
  const reserves = await dataProvider.getAllReservesTokens();
  return reserves.map((r: [string, string]) => ({
    symbol: r[0],
    tokenAddress: r[1],
  }));
}

/**
 * Find USDC reserve address in HypurrFi
 * Returns null if USDC is not listed
 */
export async function findUsdcReserve(
  provider?: ethers.Provider
): Promise<string | null> {
  const reserves = await getAllReservesTokens(provider);
  
  // Look for USDC by symbol (case-insensitive)
  const usdcReserve = reserves.find(
    (r) => r.symbol.toUpperCase() === "USDC" || r.symbol.toUpperCase() === "USDC.E"
  );
  
  return usdcReserve?.tokenAddress || null;
}

/**
 * Check if a token address is a valid reserve in HypurrFi
 */
export async function isValidReserve(
  tokenAddress: string,
  provider?: ethers.Provider
): Promise<boolean> {
  const reserves = await getAllReservesTokens(provider);
  return reserves.some(
    (r) => r.tokenAddress.toLowerCase() === tokenAddress.toLowerCase()
  );
}

/**
 * Get user's position data for a reserve
 */
export async function getUserReserveData(
  assetAddress: string,
  userAddress: string,
  provider?: ethers.Provider
): Promise<UserReserveData> {
  const _provider = provider || getHyperEvmProvider();
  const dataProvider = getProtocolDataProvider(_provider);
  
  const data = await dataProvider.getUserReserveData(assetAddress, userAddress);
  
  return {
    currentATokenBalance: data[0],
    currentStableDebt: data[1],
    currentVariableDebt: data[2],
    principalStableDebt: data[3],
    scaledVariableDebt: data[4],
    stableBorrowRate: data[5],
    liquidityRate: data[6],
    stableRateLastUpdated: Number(data[7]),
    usageAsCollateralEnabled: data[8],
  };
}

/**
 * Supply (deposit) tokens to HypurrFi
 * @param assetAddress - The token to supply
 * @param amount - Amount in token units (with decimals)
 * @param onBehalfOf - Address to credit the deposit to
 * @param signer - Wallet signer
 */
export async function supply(
  assetAddress: string,
  amount: bigint,
  onBehalfOf: string,
  signer: ethers.Signer
): Promise<ethers.TransactionResponse> {
  // Check and approve if needed
  const signerAddress = await signer.getAddress();
  const allowance = await getTokenAllowance(assetAddress, signerAddress, HYPURRFI_POOL);
  
  if (allowance < amount) {
    // Approve max uint256 for convenience
    const approveTx = await approveToken(
      assetAddress,
      HYPURRFI_POOL,
      ethers.MaxUint256,
      signer
    );
    await approveTx.wait();
  }
  
  // Supply to pool
  const pool = getPoolContract(signer);
  return await pool.supply(assetAddress, amount, onBehalfOf, 0);
}

/**
 * Withdraw tokens from HypurrFi
 * @param assetAddress - The token to withdraw
 * @param amount - Amount in token units, or MaxUint256 for all
 * @param to - Address to receive the tokens
 * @param signer - Wallet signer
 */
export async function withdraw(
  assetAddress: string,
  amount: bigint,
  to: string,
  signer: ethers.Signer
): Promise<ethers.TransactionResponse> {
  const pool = getPoolContract(signer);
  return await pool.withdraw(assetAddress, amount, to);
}

/**
 * Get reserve data including supply APY (liquidity rate)
 */
export async function getReserveData(
  assetAddress: string,
  provider?: ethers.Provider
): Promise<ReserveData> {
  const _provider = provider || getHyperEvmProvider();
  const dataProvider = getProtocolDataProvider(_provider);
  
  const data = await dataProvider.getReserveData(assetAddress);
  
  return {
    liquidityRate: data[5], // Index 5 is liquidityRate
    variableBorrowRate: data[6],
    stableBorrowRate: data[7],
  };
}

/**
 * Convert RAY (1e27) rate to APY percentage
 * Aave stores rates in RAY format
 */
export function rayToApy(rayRate: bigint): number {
  const RAY = BigInt(10 ** 27);
  const SECONDS_PER_YEAR = 31536000;
  
  // Convert to rate per second
  const ratePerSecond = Number(rayRate) / Number(RAY);
  
  // Compound to get APY: (1 + rate/secondsPerYear)^secondsPerYear - 1
  // Simplified: rate is already annualized in Aave, just convert to percentage
  return (Number(rayRate) / Number(RAY)) * 100;
}

/**
 * Format USDC balance for display
 */
export function formatUsdcBalance(amount: bigint): string {
  const num = Number(amount) / 10 ** USDC_DECIMALS;
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

/**
 * Parse USDC amount from string input
 */
export function parseUsdcInput(amount: string): bigint {
  const num = parseFloat(amount);
  if (isNaN(num) || num < 0) {
    return BigInt(0);
  }
  return BigInt(Math.floor(num * 10 ** USDC_DECIMALS));
}
