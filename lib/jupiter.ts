// Jupiter Swap API v6 Helpers
import axios from "axios";
import { JUPITER_API_BASE, SOLANA_SOL_MINT, SOLANA_USDC_MINT } from "./constants";

export interface JupiterQuote {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: unknown[];
}

export interface JupiterSwapResponse {
  swapTransaction: string; // Base64 encoded transaction
  lastValidBlockHeight: number;
  prioritizationFeeLamports: number;
}

/**
 * Get a quote for swapping SOL to USDC
 * @param amountInLamports - Amount of SOL in lamports (1 SOL = 10^9 lamports)
 * @param slippageBps - Slippage tolerance in basis points (default 50 = 0.5%)
 */
export async function getSwapQuote(
  amountInLamports: string,
  slippageBps: number = 50
): Promise<JupiterQuote> {
  const url = `${JUPITER_API_BASE}/quote`;
  
  const response = await axios.get<JupiterQuote>(url, {
    params: {
      inputMint: SOLANA_SOL_MINT,
      outputMint: SOLANA_USDC_MINT,
      amount: amountInLamports,
      slippageBps: slippageBps,
      swapMode: "ExactIn",
    },
  });

  return response.data;
}

/**
 * Get a swap transaction for the given quote
 * @param quote - The quote from getSwapQuote
 * @param userPublicKey - The user's Solana wallet public key (base58)
 */
export async function getSwapTransaction(
  quote: JupiterQuote,
  userPublicKey: string
): Promise<JupiterSwapResponse> {
  const url = `${JUPITER_API_BASE}/swap`;

  const response = await axios.post<JupiterSwapResponse>(url, {
    quoteResponse: quote,
    userPublicKey: userPublicKey,
    wrapAndUnwrapSol: true, // Auto-wrap SOL
    dynamicComputeUnitLimit: true,
    prioritizationFeeLamports: "auto",
  });

  return response.data;
}

/**
 * Format USDC output amount from quote for display
 */
export function formatQuoteOutputUsdc(quote: JupiterQuote): string {
  const amount = BigInt(quote.outAmount);
  const usdc = Number(amount) / 10 ** 6;
  return usdc.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

/**
 * Calculate price impact percentage for display
 */
export function formatPriceImpact(quote: JupiterQuote): string {
  const impact = parseFloat(quote.priceImpactPct);
  return `${(impact * 100).toFixed(2)}%`;
}
