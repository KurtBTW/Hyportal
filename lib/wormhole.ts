// Wormhole/Portal Bridge Helpers
// Simplified helper functions for bridge UI

import { USDC_DECIMALS } from "./constants";

export interface BridgeQuote {
  inputAmount: string;
  outputAmount: string;
  fee: string;
  estimatedTime: string;
  route: string;
}

/**
 * Get a quote for bridging USDC
 * Portal Bridge has minimal fees, mostly just gas
 */
export function getBridgeQuote(amountUsdc: string): BridgeQuote {
  const amount = parseFloat(amountUsdc);
  const fee = 0.1; // ~$0.10 relayer fee estimate
  const output = Math.max(0, amount - fee);
  
  return {
    inputAmount: amountUsdc,
    outputAmount: output.toFixed(6),
    fee: fee.toFixed(2),
    estimatedTime: "2-5 minutes",
    route: "Wormhole Token Bridge",
  };
}

/**
 * Parse USDC amount to smallest units
 */
export function parseUsdcBridgeAmount(amount: string): bigint {
  const num = parseFloat(amount);
  return BigInt(Math.floor(num * 10 ** USDC_DECIMALS));
}

/**
 * Format USDC amount for display
 */
export function formatUsdcBridgeAmount(amount: bigint): string {
  const num = Number(amount) / 10 ** USDC_DECIMALS;
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

/**
 * Build Portal Bridge URL with pre-filled parameters
 */
export function buildPortalBridgeUrl(params: {
  sourceChain?: string;
  targetChain?: string;
  asset?: string;
  sourceAddress?: string;
  targetAddress?: string;
}): string {
  const baseUrl = "https://portalbridge.com/";
  const urlParams = new URLSearchParams();
  
  if (params.sourceChain) urlParams.set("sourceChain", params.sourceChain);
  if (params.targetChain) urlParams.set("targetChain", params.targetChain);
  if (params.asset) urlParams.set("asset", params.asset);
  if (params.targetAddress) urlParams.set("targetAddress", params.targetAddress);
  
  const queryString = urlParams.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

/**
 * Get Wormhole chain name from common names
 */
export function getWormholeChainName(chain: string): string {
  const chainMap: Record<string, string> = {
    solana: "solana",
    hyperevm: "evmos", // HyperEVM uses evmos chain ID in Wormhole
    ethereum: "ethereum",
    arbitrum: "arbitrum",
    optimism: "optimism",
    polygon: "polygon",
    base: "base",
    avalanche: "avalanche",
    bsc: "bsc",
  };
  
  return chainMap[chain.toLowerCase()] || chain.toLowerCase();
}
