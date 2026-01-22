// ERC20 Token Helpers for HyperEVM
import { ethers } from "ethers";
import { ERC20_ABI, HYPEREVM_RPC } from "./constants";

/**
 * Get a read-only provider for HyperEVM
 */
export function getHyperEvmProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(HYPEREVM_RPC);
}

/**
 * Get an ERC20 contract instance
 */
export function getErc20Contract(
  tokenAddress: string,
  signerOrProvider: ethers.Signer | ethers.Provider
): ethers.Contract {
  return new ethers.Contract(tokenAddress, ERC20_ABI, signerOrProvider);
}

/**
 * Get token balance for an address
 */
export async function getTokenBalance(
  tokenAddress: string,
  walletAddress: string,
  provider?: ethers.Provider
): Promise<bigint> {
  const _provider = provider || getHyperEvmProvider();
  const contract = getErc20Contract(tokenAddress, _provider);
  return await contract.balanceOf(walletAddress);
}

/**
 * Get token allowance
 */
export async function getTokenAllowance(
  tokenAddress: string,
  ownerAddress: string,
  spenderAddress: string,
  provider?: ethers.Provider
): Promise<bigint> {
  const _provider = provider || getHyperEvmProvider();
  const contract = getErc20Contract(tokenAddress, _provider);
  return await contract.allowance(ownerAddress, spenderAddress);
}

/**
 * Get token decimals
 */
export async function getTokenDecimals(
  tokenAddress: string,
  provider?: ethers.Provider
): Promise<number> {
  const _provider = provider || getHyperEvmProvider();
  const contract = getErc20Contract(tokenAddress, _provider);
  return await contract.decimals();
}

/**
 * Approve token spending
 */
export async function approveToken(
  tokenAddress: string,
  spenderAddress: string,
  amount: bigint,
  signer: ethers.Signer
): Promise<ethers.TransactionResponse> {
  const contract = getErc20Contract(tokenAddress, signer);
  return await contract.approve(spenderAddress, amount);
}

/**
 * Format token amount for display
 */
export function formatTokenAmount(amount: bigint, decimals: number): string {
  const divisor = BigInt(10 ** decimals);
  const whole = amount / divisor;
  const fraction = amount % divisor;
  
  const fractionStr = fraction.toString().padStart(decimals, "0");
  const trimmedFraction = fractionStr.replace(/0+$/, "");
  
  if (trimmedFraction) {
    return `${whole}.${trimmedFraction}`;
  }
  return whole.toString();
}

/**
 * Parse token amount from string
 */
export function parseTokenAmount(amount: string, decimals: number): bigint {
  const [whole, fraction = ""] = amount.split(".");
  const paddedFraction = fraction.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(whole + paddedFraction);
}
