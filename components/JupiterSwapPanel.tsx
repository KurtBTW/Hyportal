"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { VersionedTransaction } from "@solana/web3.js";
import {
  getSwapQuote,
  getSwapTransaction,
  formatQuoteOutputUsdc,
  formatPriceImpact,
  JupiterQuote,
} from "@/lib/jupiter";
import { parseSolAmount, formatSolanaExplorerUrl, SOL_DECIMALS } from "@/lib/constants";

interface JupiterSwapPanelProps {
  onSwapComplete?: (txHash: string, usdcAmount: string) => void;
}

type SwapState = "idle" | "quoting" | "swapping" | "confirming" | "complete" | "error";

export default function JupiterSwapPanel({ onSwapComplete }: JupiterSwapPanelProps) {
  const { publicKey, signTransaction, connected } = useWallet();
  const { connection } = useConnection();

  const [solAmount, setSolAmount] = useState("");
  const [quote, setQuote] = useState<JupiterQuote | null>(null);
  const [state, setState] = useState<SwapState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [solBalance, setSolBalance] = useState<bigint | null>(null);

  // Fetch SOL balance
  useEffect(() => {
    if (!publicKey || !connection) {
      setSolBalance(null);
      return;
    }

    const fetchBalance = async () => {
      try {
        const balance = await connection.getBalance(publicKey);
        setSolBalance(BigInt(balance));
      } catch (err) {
        console.error("Error fetching balance:", err);
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 10000);
    return () => clearInterval(interval);
  }, [publicKey, connection]);

  // Fetch quote when amount changes
  const fetchQuote = useCallback(async () => {
    if (!solAmount || parseFloat(solAmount) <= 0) {
      setQuote(null);
      return;
    }

    try {
      setState("quoting");
      setError(null);
      const amountLamports = parseSolAmount(solAmount).toString();
      const newQuote = await getSwapQuote(amountLamports);
      setQuote(newQuote);
      setState("idle");
    } catch (err) {
      console.error("Quote error:", err);
      setError("Failed to get swap quote. Try again.");
      setState("error");
      setQuote(null);
    }
  }, [solAmount]);

  // Debounce quote fetching
  useEffect(() => {
    const timer = setTimeout(fetchQuote, 500);
    return () => clearTimeout(timer);
  }, [fetchQuote]);

  const handleSwap = async () => {
    if (!publicKey || !signTransaction || !quote) {
      setError("Wallet not connected or no quote available");
      return;
    }

    try {
      setState("swapping");
      setError(null);
      setTxHash(null);

      // Get swap transaction
      const swapData = await getSwapTransaction(quote, publicKey.toBase58());

      // Deserialize transaction
      const transactionBuffer = Buffer.from(swapData.swapTransaction, "base64");
      const transaction = VersionedTransaction.deserialize(transactionBuffer);

      // Sign transaction
      const signedTransaction = await signTransaction(transaction);

      // Send transaction
      setState("confirming");
      const signature = await connection.sendRawTransaction(
        signedTransaction.serialize(),
        {
          skipPreflight: false,
          maxRetries: 3,
        }
      );

      // Confirm transaction
      const latestBlockHash = await connection.getLatestBlockhash();
      await connection.confirmTransaction({
        signature,
        blockhash: latestBlockHash.blockhash,
        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      });

      setTxHash(signature);
      setState("complete");

      // Notify parent
      if (onSwapComplete) {
        onSwapComplete(signature, quote.outAmount);
      }
    } catch (err) {
      console.error("Swap error:", err);
      setError(err instanceof Error ? err.message : "Swap failed. Please try again.");
      setState("error");
    }
  };

  const formatBalance = (lamports: bigint) => {
    const sol = Number(lamports) / 10 ** SOL_DECIMALS;
    return sol.toLocaleString(undefined, { maximumFractionDigits: 4 });
  };

  const canSwap =
    connected &&
    quote &&
    state === "idle" &&
    parseFloat(solAmount) > 0 &&
    solBalance &&
    parseSolAmount(solAmount) <= solBalance;

  return (
    <div className="bg-gray-800 rounded-xl p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-white">1. Swap SOL to USDC</h3>
        <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700" />
      </div>

      {connected && (
        <div className="text-sm text-gray-400">
          Balance: {solBalance !== null ? `${formatBalance(solBalance)} SOL` : "Loading..."}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-sm text-gray-400 mb-1">You pay</label>
          <div className="flex items-center gap-2 bg-gray-900 rounded-lg p-3">
            <input
              type="number"
              value={solAmount}
              onChange={(e) => setSolAmount(e.target.value)}
              placeholder="0.0"
              min="0"
              step="0.01"
              className="flex-1 bg-transparent text-white text-lg outline-none"
              disabled={!connected}
            />
            <span className="text-gray-400 font-medium">SOL</span>
          </div>
          {solBalance && parseSolAmount(solAmount || "0") > solBalance && (
            <p className="text-red-500 text-sm mt-1">Insufficient SOL balance</p>
          )}
        </div>

        <div className="flex justify-center">
          <div className="bg-gray-700 rounded-full p-2">
            <svg
              className="w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">You receive</label>
          <div className="flex items-center gap-2 bg-gray-900 rounded-lg p-3">
            <span className="flex-1 text-white text-lg">
              {state === "quoting" ? (
                <span className="text-gray-500">Loading...</span>
              ) : quote ? (
                formatQuoteOutputUsdc(quote)
              ) : (
                <span className="text-gray-500">0.0</span>
              )}
            </span>
            <span className="text-gray-400 font-medium">USDC</span>
          </div>
        </div>

        {quote && (
          <div className="text-sm text-gray-400 space-y-1">
            <div className="flex justify-between">
              <span>Price Impact</span>
              <span>{formatPriceImpact(quote)}</span>
            </div>
            <div className="flex justify-between">
              <span>Min. Received</span>
              <span>
                {(Number(quote.otherAmountThreshold) / 10 ** 6).toFixed(2)} USDC
              </span>
            </div>
          </div>
        )}

        <button
          onClick={handleSwap}
          disabled={!canSwap}
          className={`w-full py-3 rounded-lg font-semibold transition-colors ${
            canSwap
              ? "bg-green-600 hover:bg-green-700 text-white"
              : "bg-gray-600 text-gray-400 cursor-not-allowed"
          }`}
        >
          {state === "quoting" && "Getting Quote..."}
          {state === "swapping" && "Signing Transaction..."}
          {state === "confirming" && "Confirming..."}
          {state === "complete" && "Swap Complete!"}
          {state === "idle" && "Swap SOL to USDC"}
          {state === "error" && "Try Again"}
        </button>

        {error && (
          <div className="p-3 bg-red-900/50 border border-red-500 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        {txHash && (
          <div className="p-3 bg-green-900/50 border border-green-500 rounded-lg">
            <p className="text-green-300 text-sm">Transaction confirmed!</p>
            <a
              href={formatSolanaExplorerUrl(txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-400 text-sm hover:underline break-all"
            >
              View on Solscan
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
