"use client";

import React, { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { WormholeConnectConfig } from "@wormhole-foundation/wormhole-connect";

// Dynamically import WormholeConnect to avoid SSR issues
const WormholeConnect = dynamic(
  () => import("@wormhole-foundation/wormhole-connect").then((mod) => mod.default),
  { ssr: false, loading: () => <div className="text-gray-400 text-center py-8">Loading Wormhole Bridge...</div> }
);

interface WormholeBridgePanelProps {
  direction: "deposit" | "withdraw";
}

export default function WormholeBridgePanel({ direction }: WormholeBridgePanelProps) {
  const [showManual, setShowManual] = useState(false);

  // Configure Wormhole Connect
  // Note: HyperEVM may not be directly supported in all Wormhole Connect versions
  const config = useMemo((): WormholeConnectConfig => {
    return {
      network: "Mainnet",
      // Use chains that are supported by Wormhole Connect
      chains: ["Solana"],
      tokens: ["USDC"],
      ui: {
        title: direction === "deposit" ? "Bridge to HyperEVM" : "Bridge to Solana",
      },
    };
  }, [direction]);

  const theme = useMemo(
    () => ({
      mode: "dark" as const,
      primary: "#8b5cf6",
      secondary: "#1f2937",
      text: "#ffffff",
      textSecondary: "#9ca3af",
      error: "#ef4444",
      success: "#22c55e",
    }),
    []
  );

  return (
    <div className="bg-gray-800 rounded-xl p-6 space-y-4">
      <h3 className="text-lg font-semibold text-white">
        {direction === "deposit" ? "2. Bridge USDC to HyperEVM" : "2. Bridge USDC to Solana"}
      </h3>
      
      <p className="text-sm text-gray-400">
        {direction === "deposit"
          ? "Bridge your Solana USDC to HyperEVM using Wormhole Portal Bridge."
          : "Bridge your HyperEVM USDC back to Solana using Wormhole Portal Bridge."}
      </p>

      {/* Toggle between embedded widget and manual instructions */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowManual(false)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            !showManual 
              ? "bg-purple-600 text-white" 
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
        >
          Use Widget
        </button>
        <button
          onClick={() => setShowManual(true)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            showManual 
              ? "bg-purple-600 text-white" 
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
        >
          Manual Bridge
        </button>
      </div>

      {!showManual ? (
        <div className="wormhole-connect-wrapper min-h-[400px]">
          <WormholeConnect config={config} theme={theme} />
        </div>
      ) : (
        <ManualBridgeInstructions direction={direction} />
      )}

      <div className="text-xs text-gray-500 space-y-1 border-t border-gray-700 pt-4">
        <p>
          Uses Wormhole Token Bridge (Portal) for USDC bridging.
        </p>
        <p>
          Bridge times: 1-5 minutes depending on network congestion.
        </p>
      </div>
    </div>
  );
}

function ManualBridgeInstructions({ direction }: { direction: "deposit" | "withdraw" }) {
  return (
    <div className="bg-gray-900 rounded-lg p-4 space-y-4">
      <h4 className="font-medium text-white">Manual Bridge Instructions</h4>
      
      {direction === "deposit" ? (
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
          <li>
            Go to{" "}
            <a
              href="https://portalbridge.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:underline"
            >
              Portal Bridge (portalbridge.com)
            </a>
          </li>
          <li>Select <strong>Solana</strong> as the source chain</li>
          <li>Select <strong>HyperEVM</strong> (or EVM-compatible chain ID 999) as destination</li>
          <li>Choose <strong>USDC</strong> as the token</li>
          <li>Enter the amount and your HyperEVM wallet address</li>
          <li>Complete the bridge transaction</li>
          <li>Wait for confirmation (typically 1-5 minutes)</li>
        </ol>
      ) : (
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
          <li>
            Go to{" "}
            <a
              href="https://portalbridge.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:underline"
            >
              Portal Bridge (portalbridge.com)
            </a>
          </li>
          <li>Select <strong>HyperEVM</strong> (chain ID 999) as the source chain</li>
          <li>Select <strong>Solana</strong> as the destination</li>
          <li>Choose <strong>USDC</strong> as the token</li>
          <li>Enter the amount and your Solana wallet address</li>
          <li>Complete the bridge transaction</li>
          <li>Wait for confirmation (typically 1-5 minutes)</li>
        </ol>
      )}

      <div className="bg-yellow-900/30 border border-yellow-600/50 rounded-lg p-3">
        <p className="text-yellow-300 text-sm">
          <strong>Note:</strong> If HyperEVM is not listed in Portal Bridge, it may not yet 
          support direct bridging. Check{" "}
          <a
            href="https://docs.wormhole.com/wormhole/explore-wormhole/supported-chains"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Wormhole supported chains
          </a>{" "}
          for the latest compatibility.
        </p>
      </div>
    </div>
  );
}
