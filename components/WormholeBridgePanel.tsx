"use client";

import React, { useState } from "react";

interface WormholeBridgePanelProps {
  direction: "deposit" | "withdraw";
}

export default function WormholeBridgePanel({ direction }: WormholeBridgePanelProps) {
  const [copied, setCopied] = useState(false);

  const portalUrl = "https://portalbridge.com/";
  
  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#a1fce7] to-[#22c55e] flex items-center justify-center text-black font-bold text-sm">
          2
        </div>
        <h3 className="text-lg font-semibold">
          {direction === "deposit" ? "Bridge USDC to HyperEVM" : "Bridge USDC to Solana"}
        </h3>
      </div>

      <p className="text-sm text-zinc-400 mb-6">
        {direction === "deposit"
          ? "Bridge your Solana USDC to HyperEVM using Wormhole Portal Bridge."
          : "Bridge your HyperEVM USDC back to Solana using Wormhole Portal Bridge."}
      </p>

      {/* Bridge Steps */}
      <div className="space-y-4">
        <div className="card-inner p-4">
          <ol className="space-y-3 text-sm">
            {direction === "deposit" ? (
              <>
                <li className="flex gap-3">
                  <span className="text-[#fbe572] font-medium">1.</span>
                  <span className="text-zinc-300">
                    Open{" "}
                    <a
                      href={portalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#a1fce7] hover:underline"
                    >
                      Portal Bridge
                    </a>
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-[#fbe572] font-medium">2.</span>
                  <span className="text-zinc-300">Select <strong className="text-white">Solana</strong> as source</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-[#fbe572] font-medium">3.</span>
                  <span className="text-zinc-300">Select <strong className="text-white">HyperEVM</strong> (Chain ID: 999) as destination</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-[#fbe572] font-medium">4.</span>
                  <span className="text-zinc-300">Choose <strong className="text-white">USDC</strong> token</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-[#fbe572] font-medium">5.</span>
                  <span className="text-zinc-300">Complete the bridge transaction</span>
                </li>
              </>
            ) : (
              <>
                <li className="flex gap-3">
                  <span className="text-[#fbe572] font-medium">1.</span>
                  <span className="text-zinc-300">
                    Open{" "}
                    <a
                      href={portalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#a1fce7] hover:underline"
                    >
                      Portal Bridge
                    </a>
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-[#fbe572] font-medium">2.</span>
                  <span className="text-zinc-300">Select <strong className="text-white">HyperEVM</strong> (Chain ID: 999) as source</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-[#fbe572] font-medium">3.</span>
                  <span className="text-zinc-300">Select <strong className="text-white">Solana</strong> as destination</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-[#fbe572] font-medium">4.</span>
                  <span className="text-zinc-300">Choose <strong className="text-white">USDC</strong> token</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-[#fbe572] font-medium">5.</span>
                  <span className="text-zinc-300">Complete the bridge transaction</span>
                </li>
              </>
            )}
          </ol>
        </div>

        {/* Quick Reference */}
        <div className="card-inner p-4">
          <h4 className="text-sm font-medium text-zinc-400 mb-3">Quick Reference</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-zinc-500">HyperEVM Chain ID</span>
              <button
                onClick={() => handleCopyAddress("999")}
                className="text-white font-mono hover:text-[#fbe572] transition-colors"
              >
                999 {copied ? "✓" : ""}
              </button>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-500">HyperEVM RPC</span>
              <span className="text-zinc-300 font-mono text-xs">rpc.hyperliquid.xyz/evm</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-500">Bridge Time</span>
              <span className="text-zinc-300">~1-5 minutes</span>
            </div>
          </div>
        </div>

        {/* Open Portal Button */}
        <a
          href={portalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full btn-secondary text-center py-4"
        >
          Open Portal Bridge &rarr;
        </a>

        {/* Note */}
        <p className="text-xs text-zinc-500 text-center">
          Portal Bridge uses Wormhole for secure cross-chain transfers
        </p>
      </div>
    </div>
  );
}
