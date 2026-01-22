"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { EvmWalletProvider } from "@/components/EvmWallet";

// Dynamically import components that use wallet adapters (SSR issues)
const SolanaWalletProvider = dynamic(
  () => import("@/components/SolanaWalletProvider"),
  { ssr: false }
);

const JupiterSwapPanel = dynamic(
  () => import("@/components/JupiterSwapPanel"),
  { ssr: false, loading: () => <PanelSkeleton title="1. Swap SOL to USDC" /> }
);

const WormholeBridgePanel = dynamic(
  () => import("@/components/WormholeBridgePanel"),
  { ssr: false, loading: () => <PanelSkeleton title="2. Bridge USDC" /> }
);

const HypurrDepositPanel = dynamic(
  () => import("@/components/HypurrDepositPanel"),
  { ssr: false, loading: () => <PanelSkeleton title="3. Deposit to HypurrFi" /> }
);

const HypurrWithdrawPanel = dynamic(
  () => import("@/components/HypurrWithdrawPanel"),
  { ssr: false, loading: () => <PanelSkeleton title="1. Withdraw from HypurrFi" /> }
);

function PanelSkeleton({ title }: { title: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-6 animate-pulse">
      <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
      <div className="space-y-3">
        <div className="h-10 bg-gray-700 rounded" />
        <div className="h-10 bg-gray-700 rounded" />
        <div className="h-12 bg-gray-700 rounded" />
      </div>
    </div>
  );
}

type Tab = "deposit" | "withdraw";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("deposit");

  return (
    <SolanaWalletProvider>
      <EvmWalletProvider>
        <main className="min-h-screen py-8 px-4">
          <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-green-400 bg-clip-text text-transparent">
                HyPortal
              </h1>
              <p className="text-gray-400">
                Solana &rarr; HyperEVM &rarr; HypurrFi
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Non-custodial bridge and deposit in one flow
              </p>
            </div>

            {/* Tab Selector */}
            <div className="flex mb-6 rounded-lg overflow-hidden">
              <button
                onClick={() => setActiveTab("deposit")}
                className={`flex-1 tab-button ${
                  activeTab === "deposit" ? "active" : ""
                }`}
              >
                Deposit
              </button>
              <button
                onClick={() => setActiveTab("withdraw")}
                className={`flex-1 tab-button ${
                  activeTab === "withdraw" ? "active" : ""
                }`}
              >
                Withdraw
              </button>
            </div>

            {/* Content */}
            {activeTab === "deposit" ? (
              <DepositFlow />
            ) : (
              <WithdrawFlow />
            )}

            {/* Footer */}
            <footer className="mt-8 text-center text-sm text-gray-500">
              <p>
                Powered by{" "}
                <a
                  href="https://jup.ag"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:underline"
                >
                  Jupiter
                </a>
                {" + "}
                <a
                  href="https://wormhole.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:underline"
                >
                  Wormhole
                </a>
                {" + "}
                <a
                  href="https://hypurr.fi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:underline"
                >
                  HypurrFi
                </a>
              </p>
              <p className="mt-2 text-xs text-gray-600">
                v0 - SOL only, mainnet-ready
              </p>
            </footer>
          </div>
        </main>
      </EvmWalletProvider>
    </SolanaWalletProvider>
  );
}

function DepositFlow() {
  const [swapComplete, setSwapComplete] = useState(false);

  return (
    <div className="space-y-6">
      {/* Step 1: Swap SOL to USDC on Solana */}
      <JupiterSwapPanel
        onSwapComplete={() => setSwapComplete(true)}
      />

      {/* Step 2: Bridge Solana USDC to HyperEVM */}
      <WormholeBridgePanel direction="deposit" />

      {/* Step 3: Deposit to HypurrFi */}
      <HypurrDepositPanel />

      {/* Flow indicator */}
      <div className="bg-gray-800/50 rounded-xl p-4">
        <h4 className="text-sm font-medium text-gray-400 mb-3">Flow Status</h4>
        <div className="flex items-center justify-between text-sm">
          <FlowStep
            number={1}
            label="Swap"
            status={swapComplete ? "complete" : "pending"}
          />
          <FlowArrow />
          <FlowStep
            number={2}
            label="Bridge"
            status="pending"
          />
          <FlowArrow />
          <FlowStep
            number={3}
            label="Deposit"
            status="pending"
          />
        </div>
      </div>
    </div>
  );
}

function WithdrawFlow() {
  return (
    <div className="space-y-6">
      {/* Step 1: Withdraw from HypurrFi */}
      <HypurrWithdrawPanel />

      {/* Step 2: Bridge HyperEVM USDC to Solana */}
      <WormholeBridgePanel direction="withdraw" />

      {/* Note about v0 */}
      <div className="bg-gray-800/50 rounded-xl p-4 text-sm text-gray-400">
        <p>
          <strong>Note (v0):</strong> Withdrawn USDC arrives on Solana as USDC.
          A future version will support automatic USDC &rarr; SOL swap.
        </p>
      </div>
    </div>
  );
}

function FlowStep({
  number,
  label,
  status,
}: {
  number: number;
  label: string;
  status: "pending" | "active" | "complete";
}) {
  const bgColor =
    status === "complete"
      ? "bg-green-600"
      : status === "active"
      ? "bg-purple-600"
      : "bg-gray-600";

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`w-8 h-8 rounded-full ${bgColor} flex items-center justify-center text-white font-medium`}
      >
        {status === "complete" ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          number
        )}
      </div>
      <span className="text-gray-400 text-xs">{label}</span>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="flex-1 flex items-center justify-center px-2">
      <div className="h-0.5 w-full bg-gray-600" />
      <svg
        className="w-4 h-4 text-gray-600 -ml-1"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5l7 7-7 7"
        />
      </svg>
    </div>
  );
}
