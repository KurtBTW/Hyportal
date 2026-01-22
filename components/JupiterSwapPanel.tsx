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
      setError("Failed to get swap quote");
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

      const swapData = await getSwapTransaction(quote, publicKey.toBase58());
      const transactionBuffer = Buffer.from(swapData.swapTransaction, "base64");
      const transaction = VersionedTransaction.deserialize(transactionBuffer);
      const signedTransaction = await signTransaction(transaction);

      setState("confirming");
      const signature = await connection.sendRawTransaction(
        signedTransaction.serialize(),
        { skipPreflight: false, maxRetries: 3 }
      );

      const latestBlockHash = await connection.getLatestBlockhash();
      await connection.confirmTransaction({
        signature,
        blockhash: latestBlockHash.blockhash,
        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      });

      setTxHash(signature);
      setState("complete");

      if (onSwapComplete) {
        onSwapComplete(signature, quote.outAmount);
      }
    } catch (err) {
      console.error("Swap error:", err);
      setError(err instanceof Error ? err.message : "Swap failed");
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
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#fbe572] to-[#c2f4bc] flex items-center justify-center text-black font-bold text-sm">
            1
          </div>
          <h3 className="text-lg font-semibold">Swap SOL to USDC</h3>
        </div>
        <WalletMultiButton />
      </div>

      {connected && (
        <div className="mb-4 text-sm text-zinc-400">
          Balance: <span className="text-white">{solBalance !== null ? `${formatBalance(solBalance)} SOL` : "..."}</span>
        </div>
      )}

      <div className="space-y-4">
        {/* Input */}
        <div>
          <label className="block text-sm text-zinc-500 mb-2">You pay</label>
          <div className="card-inner flex items-center p-4">
            <input
              type="number"
              value={solAmount}
              onChange={(e) => setSolAmount(e.target.value)}
              placeholder="0.0"
              min="0"
              step="0.01"
              className="flex-1 bg-transparent text-xl font-medium outline-none"
              disabled={!connected}
            />
            <div className="flex items-center gap-2 text-zinc-400">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-purple-700" />
              <span className="font-medium">SOL</span>
            </div>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>

        {/* Output */}
        <div>
          <label className="block text-sm text-zinc-500 mb-2">You receive</label>
          <div className="card-inner flex items-center p-4">
            <span className="flex-1 text-xl font-medium">
              {state === "quoting" ? (
                <span className="text-zinc-500">Loading...</span>
              ) : quote ? (
                formatQuoteOutputUsdc(quote)
              ) : (
                <span className="text-zinc-600">0.0</span>
              )}
            </span>
            <div className="flex items-center gap-2 text-zinc-400">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600" />
              <span className="font-medium">USDC</span>
            </div>
          </div>
        </div>

        {/* Quote details */}
        {quote && (
          <div className="text-sm text-zinc-500 space-y-1 px-1">
            <div className="flex justify-between">
              <span>Price Impact</span>
              <span className="text-zinc-300">{formatPriceImpact(quote)}</span>
            </div>
            <div className="flex justify-between">
              <span>Min. Received</span>
              <span className="text-zinc-300">
                {(Number(quote.otherAmountThreshold) / 10 ** 6).toFixed(2)} USDC
              </span>
            </div>
          </div>
        )}

        {/* Swap button */}
        <button
          onClick={handleSwap}
          disabled={!canSwap}
          className="w-full btn-primary py-4 text-base"
        >
          {state === "quoting" && "Getting Quote..."}
          {state === "swapping" && "Signing..."}
          {state === "confirming" && "Confirming..."}
          {state === "complete" && "Swap Complete!"}
          {state === "idle" && "Swap SOL to USDC"}
          {state === "error" && "Try Again"}
        </button>

        {/* Error */}
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Success */}
        {txHash && (
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
            <p className="text-green-400 text-sm">Transaction confirmed!</p>
            <a
              href={formatSolanaExplorerUrl(txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-400 text-sm hover:underline"
            >
              View on Solscan &rarr;
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
