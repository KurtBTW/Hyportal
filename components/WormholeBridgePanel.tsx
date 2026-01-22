"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount, TokenAccountNotFoundError } from "@solana/spl-token";
import { useConnection } from "@solana/wallet-adapter-react";
import { useEvmWallet, EvmConnectButton } from "./EvmWallet";
import { SOLANA_USDC_MINT, USDC_DECIMALS } from "@/lib/constants";
import dynamic from "next/dynamic";

// Dynamically import Wormhole Connect to avoid SSR issues
const WormholeConnect = dynamic(
  () => import("@wormhole-foundation/wormhole-connect"),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[500px]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#fbe572] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400 text-sm">Loading Bridge Widget...</p>
        </div>
      </div>
    )
  }
);

interface WormholeBridgePanelProps {
  direction: "deposit" | "withdraw";
}

type ViewMode = "setup" | "bridge";

export default function WormholeBridgePanel({ direction }: WormholeBridgePanelProps) {
  const { publicKey: solanaPublicKey, connected: solanaConnected } = useWallet();
  const { connection } = useConnection();
  const { address: evmAddress, isConnected: evmConnected, isHyperEvm } = useEvmWallet();
  
  const [viewMode, setViewMode] = useState<ViewMode>("setup");
  const [solanaUsdcBalance, setSolanaUsdcBalance] = useState<bigint>(BigInt(0));
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch Solana USDC balance
  useEffect(() => {
    if (!solanaPublicKey || !connection) {
      setSolanaUsdcBalance(BigInt(0));
      return;
    }

    const fetchBalance = async () => {
      try {
        const usdcMint = new PublicKey(SOLANA_USDC_MINT);
        const tokenAccount = await getAssociatedTokenAddress(usdcMint, solanaPublicKey);
        try {
          const account = await getAccount(connection, tokenAccount);
          setSolanaUsdcBalance(account.amount);
        } catch (e) {
          if (e instanceof TokenAccountNotFoundError) {
            setSolanaUsdcBalance(BigInt(0));
          }
        }
      } catch (err) {
        console.error("Error fetching USDC balance:", err);
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 15000);
    return () => clearInterval(interval);
  }, [solanaPublicKey, connection]);

  const formatBalance = (bal: bigint) => {
    const num = Number(bal) / 10 ** USDC_DECIMALS;
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const canProceed = direction === "deposit" 
    ? (solanaConnected && evmConnected)
    : (evmConnected && isHyperEvm && solanaConnected);

  // Wormhole Connect configuration
  const wormholeConfig = {
    network: "Mainnet",
    chains: ["Solana", "Arbitrum", "Optimism", "Base", "Polygon", "Ethereum"],
    tokens: ["USDC"],
    rpcs: {
      Solana: "https://api.mainnet-beta.solana.com",
    },
  } as any; // Use any to avoid complex Wormhole types

  // Custom theme for Wormhole Connect
  const wormholeTheme = {
    mode: "dark",
    primary: "#fbe572",
    secondary: "#0f0f12",
    text: "#ffffff",
    textSecondary: "#a1a1aa",
    error: "#ef4444",
    success: "#22c55e",
    badge: {
      background: "rgba(255, 255, 255, 0.1)",
      text: "#ffffff",
    },
    button: {
      primary: "#fbe572",
      primaryText: "#0a0a0c",
      disabled: "rgba(255, 255, 255, 0.1)",
      disabledText: "#71717a",
    },
    card: {
      background: "#0f0f12",
      secondary: "rgba(255, 255, 255, 0.02)",
    },
    font: {
      primary: "Inter, system-ui, sans-serif",
    },
  } as any;

  if (!mounted) {
    return (
      <div className="card p-6">
        <div className="h-[400px] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#fbe572] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#a1fce7] to-[#22c55e] flex items-center justify-center text-black font-bold text-sm">
            2
          </div>
          <h3 className="text-lg font-semibold">
            {direction === "deposit" ? "Bridge USDC to HyperEVM" : "Bridge USDC to Solana"}
          </h3>
        </div>
        {viewMode === "bridge" && (
          <button
            onClick={() => setViewMode("setup")}
            className="text-sm text-zinc-400 hover:text-white transition-colors flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        )}
      </div>

      {viewMode === "setup" ? (
        <>
          {/* Wallet Status Cards */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* Solana Wallet */}
            <div className={`p-4 rounded-xl border transition-all ${
              solanaConnected 
                ? "bg-green-500/5 border-green-500/30" 
                : "bg-white/5 border-white/10"
            }`}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-2 h-2 rounded-full ${solanaConnected ? "bg-green-400" : "bg-zinc-600"}`} />
                <span className="text-sm font-medium">Solana</span>
              </div>
              <WalletMultiButton className="!w-full !justify-center !h-9 !text-sm" />
              {solanaConnected && (
                <p className="text-xs text-zinc-400 mt-2 text-center">
                  {formatBalance(solanaUsdcBalance)} USDC
                </p>
              )}
            </div>

            {/* EVM Wallet */}
            <div className={`p-4 rounded-xl border transition-all ${
              evmConnected && isHyperEvm
                ? "bg-green-500/5 border-green-500/30"
                : evmConnected
                ? "bg-yellow-500/5 border-yellow-500/30"
                : "bg-white/5 border-white/10"
            }`}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-2 h-2 rounded-full ${
                  evmConnected && isHyperEvm 
                    ? "bg-green-400" 
                    : evmConnected 
                    ? "bg-yellow-400" 
                    : "bg-zinc-600"
                }`} />
                <span className="text-sm font-medium">HyperEVM</span>
              </div>
              <EvmConnectButton />
            </div>
          </div>

          {/* Bridge Info */}
          <div className="mb-6 p-4 rounded-xl bg-gradient-to-br from-[#fbe572]/10 to-[#a1fce7]/10 border border-white/10">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#fbe572] to-[#a1fce7] flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-white mb-1">
                  {direction === "deposit" ? "Solana → HyperEVM" : "HyperEVM → Solana"}
                </h4>
                <p className="text-sm text-zinc-400">
                  {direction === "deposit"
                    ? "Bridge USDC using Wormhole. Select destination chain and complete the bridge."
                    : "Bridge your USDC back to Solana using Wormhole."}
                </p>
              </div>
            </div>
          </div>

          {/* Steps */}
          <div className="mb-6 space-y-3">
            <h4 className="text-sm font-medium text-zinc-400">Bridge Steps:</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-sm">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${canProceed ? "bg-green-500/20 text-green-400" : "bg-white/10 text-zinc-400"}`}>
                  {canProceed ? "✓" : "1"}
                </div>
                <span className={canProceed ? "text-green-400" : "text-zinc-300"}>Connect both wallets</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs text-zinc-400">2</div>
                <span className="text-zinc-300">Select amount and destination</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs text-zinc-400">3</div>
                <span className="text-zinc-300">Approve and confirm transaction</span>
              </div>
            </div>
          </div>

          {/* Start Bridge Button */}
          <button
            onClick={() => setViewMode("bridge")}
            disabled={!canProceed}
            className="w-full btn-primary py-4 text-base disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {!canProceed ? "Connect Both Wallets to Continue" : "Open Bridge Widget"}
          </button>

          {/* Quick Reference */}
          <div className="mt-6 pt-4 border-t border-white/10 grid grid-cols-3 gap-3 text-xs">
            <div className="p-2 rounded bg-white/5 text-center">
              <span className="text-zinc-500 block">Chain ID</span>
              <span className="text-white font-mono">999</span>
            </div>
            <div className="p-2 rounded bg-white/5 text-center">
              <span className="text-zinc-500 block">Bridge</span>
              <span className="text-white">Wormhole</span>
            </div>
            <div className="p-2 rounded bg-white/5 text-center">
              <span className="text-zinc-500 block">Time</span>
              <span className="text-white">~5 min</span>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Bridge Widget View */}
          <div className="mb-4 p-3 rounded-lg bg-[#fbe572]/10 border border-[#fbe572]/30">
            <p className="text-sm text-[#fbe572]">
              <strong>Note:</strong> Select your source and destination chains below. For HyperEVM, 
              you may need to bridge to an intermediate chain first (like Arbitrum), then transfer.
            </p>
          </div>

          {/* Connected Addresses */}
          <div className="mb-4 grid grid-cols-2 gap-3 text-xs">
            {solanaPublicKey && (
              <div className="p-2 rounded bg-white/5">
                <span className="text-zinc-500 block mb-1">Solana</span>
                <span className="text-white font-mono">{solanaPublicKey.toBase58().slice(0, 6)}...{solanaPublicKey.toBase58().slice(-4)}</span>
              </div>
            )}
            {evmAddress && (
              <div className="p-2 rounded bg-white/5">
                <span className="text-zinc-500 block mb-1">EVM</span>
                <span className="text-white font-mono">{evmAddress.slice(0, 6)}...{evmAddress.slice(-4)}</span>
              </div>
            )}
          </div>

          {/* Wormhole Connect Widget */}
          <div className="wormhole-connect-container rounded-xl overflow-hidden border border-white/10 min-h-[500px]" style={{ background: '#0f0f12' }}>
            <Suspense fallback={
              <div className="flex items-center justify-center h-[500px]">
                <div className="w-8 h-8 border-2 border-[#fbe572] border-t-transparent rounded-full animate-spin" />
              </div>
            }>
              <WormholeConnect 
                config={wormholeConfig} 
                theme={wormholeTheme}
              />
            </Suspense>
          </div>

          {/* Fallback */}
          <div className="mt-4 text-center">
            <a
              href="https://portalbridge.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-zinc-500 hover:text-[#a1fce7] transition-colors inline-flex items-center gap-1"
            >
              Open Portal Bridge in new tab
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </>
      )}
    </div>
  );
}
