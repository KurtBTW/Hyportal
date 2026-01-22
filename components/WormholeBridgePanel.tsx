"use client";

import React, { useState, useEffect, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount, TokenAccountNotFoundError } from "@solana/spl-token";
import { useConnection } from "@solana/wallet-adapter-react";
import { useEvmWallet, EvmConnectButton } from "./EvmWallet";
import { SOLANA_USDC_MINT, USDC_DECIMALS } from "@/lib/constants";

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
  const [bridgeUrl, setBridgeUrl] = useState<string>("");
  const iframeRef = useRef<HTMLIFrameElement>(null);

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

  // Build bridge URL based on direction and connected wallets
  useEffect(() => {
    let url = "https://portalbridge.com/";
    const params = new URLSearchParams();
    
    if (direction === "deposit") {
      params.set("sourceChain", "solana");
      // Default to a popular chain, user can change in Portal
      params.set("targetChain", "arbitrum");
    } else {
      params.set("sourceChain", "arbitrum");
      params.set("targetChain", "solana");
    }
    
    params.set("asset", "USDCso"); // Solana USDC
    
    // Pre-fill addresses if available
    if (direction === "deposit" && evmAddress) {
      params.set("targetAddress", evmAddress);
    } else if (direction === "withdraw" && solanaPublicKey) {
      params.set("targetAddress", solanaPublicKey.toBase58());
    }
    
    setBridgeUrl(`${url}?${params.toString()}`);
  }, [direction, evmAddress, solanaPublicKey]);

  const formatBalance = (bal: bigint) => {
    const num = Number(bal) / 10 ** USDC_DECIMALS;
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const canProceed = direction === "deposit" 
    ? (solanaConnected && evmConnected)
    : (evmConnected && isHyperEvm && solanaConnected);

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
            className="text-sm text-zinc-400 hover:text-white transition-colors"
          >
            ← Back
          </button>
        )}
      </div>

      {viewMode === "setup" ? (
        <>
          {/* Wallet Status Cards */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* Solana Wallet */}
            <div className={`p-4 rounded-xl border transition-colors ${
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
                  {formatBalance(solanaUsdcBalance)} USDC available
                </p>
              )}
            </div>

            {/* EVM Wallet */}
            <div className={`p-4 rounded-xl border transition-colors ${
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
                    ? "Bridge your USDC from Solana to HyperEVM using Wormhole Portal Bridge."
                    : "Bridge your USDC from HyperEVM back to Solana."}
                </p>
              </div>
            </div>
          </div>

          {/* What to expect */}
          <div className="mb-6 space-y-3">
            <h4 className="text-sm font-medium text-zinc-400">What to expect:</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-sm">
                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs">1</div>
                <span className="text-zinc-300">Connect both wallets above</span>
                {canProceed && <span className="text-green-400">✓</span>}
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs">2</div>
                <span className="text-zinc-300">Enter amount and confirm bridge</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs">3</div>
                <span className="text-zinc-300">Wait 2-5 minutes for confirmation</span>
              </div>
            </div>
          </div>

          {/* Start Bridge Button */}
          <button
            onClick={() => setViewMode("bridge")}
            disabled={!canProceed}
            className="w-full btn-primary py-4 text-base disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {!canProceed ? "Connect Both Wallets" : "Continue to Bridge"}
          </button>

          {/* Chain Info */}
          <div className="mt-6 pt-4 border-t border-white/10 grid grid-cols-2 gap-3 text-xs">
            <div className="p-2 rounded bg-white/5">
              <span className="text-zinc-500 block">HyperEVM Chain ID</span>
              <span className="text-white font-mono">999</span>
            </div>
            <div className="p-2 rounded bg-white/5">
              <span className="text-zinc-500 block">Est. Time</span>
              <span className="text-white">2-5 minutes</span>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Embedded Portal Bridge */}
          <div className="mb-4 p-3 rounded-lg bg-[#fbe572]/10 border border-[#fbe572]/30">
            <p className="text-sm text-[#fbe572]">
              <strong>Tip:</strong> Select your destination chain and enter the amount below. 
              Your recipient address has been pre-filled.
            </p>
          </div>

          {/* Pre-filled addresses display */}
          <div className="mb-4 grid grid-cols-2 gap-3 text-xs">
            {direction === "deposit" && evmAddress && (
              <div className="p-2 rounded bg-white/5">
                <span className="text-zinc-500 block mb-1">Recipient (EVM)</span>
                <span className="text-white font-mono break-all">{evmAddress.slice(0, 10)}...{evmAddress.slice(-8)}</span>
              </div>
            )}
            {direction === "withdraw" && solanaPublicKey && (
              <div className="p-2 rounded bg-white/5">
                <span className="text-zinc-500 block mb-1">Recipient (Solana)</span>
                <span className="text-white font-mono break-all">{solanaPublicKey.toBase58().slice(0, 8)}...{solanaPublicKey.toBase58().slice(-8)}</span>
              </div>
            )}
            <div className="p-2 rounded bg-white/5">
              <span className="text-zinc-500 block mb-1">Available USDC</span>
              <span className="text-white">{formatBalance(solanaUsdcBalance)} USDC</span>
            </div>
          </div>

          {/* Portal Bridge iframe */}
          <div className="relative rounded-xl overflow-hidden bg-[#0a0a0c] border border-white/10" style={{ height: "600px" }}>
            <iframe
              ref={iframeRef}
              src={bridgeUrl}
              className="w-full h-full"
              title="Portal Bridge"
              allow="clipboard-write"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation"
            />
            
            {/* Loading overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0c] pointer-events-none opacity-0 transition-opacity" id="bridge-loading">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-[#fbe572] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-zinc-400">Loading Portal Bridge...</p>
              </div>
            </div>
          </div>

          {/* Alternative link */}
          <div className="mt-4 text-center">
            <a
              href={bridgeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-zinc-500 hover:text-[#a1fce7] transition-colors"
            >
              Open in new tab if bridge does not load →
            </a>
          </div>
        </>
      )}
    </div>
  );
}
