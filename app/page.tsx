"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { EvmWalletProvider } from "@/components/EvmWallet";

// Dynamically import components to avoid SSR issues
const SolanaWalletProvider = dynamic(
  () => import("@/components/SolanaWalletProvider"),
  { ssr: false }
);

const JupiterSwapPanel = dynamic(
  () => import("@/components/JupiterSwapPanel"),
  { ssr: false, loading: () => <PanelSkeleton /> }
);

const WormholeBridgePanel = dynamic(
  () => import("@/components/WormholeBridgePanel"),
  { ssr: false, loading: () => <PanelSkeleton /> }
);

const HypurrDepositPanel = dynamic(
  () => import("@/components/HypurrDepositPanel"),
  { ssr: false, loading: () => <PanelSkeleton /> }
);

const HypurrWithdrawPanel = dynamic(
  () => import("@/components/HypurrWithdrawPanel"),
  { ssr: false, loading: () => <PanelSkeleton /> }
);

function PanelSkeleton() {
  return (
    <div className="card p-6">
      <div className="animate-pulse space-y-4">
        <div className="h-6 bg-white/10 rounded w-1/3" />
        <div className="h-12 bg-white/5 rounded" />
        <div className="h-12 bg-white/5 rounded" />
        <div className="h-12 bg-white/10 rounded" />
      </div>
    </div>
  );
}

type Tab = "deposit" | "withdraw";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("deposit");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <main className="min-h-screen py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <Header />
          <div className="mt-8 space-y-6">
            <PanelSkeleton />
            <PanelSkeleton />
            <PanelSkeleton />
          </div>
        </div>
      </main>
    );
  }

  return (
    <SolanaWalletProvider>
      <EvmWalletProvider>
        <main className="min-h-screen py-8 px-4">
          <div className="max-w-2xl mx-auto">
            <Header />

            {/* Tab Selector */}
            <div className="flex gap-2 mt-8 p-1 bg-white/5 rounded-lg w-fit">
              <button
                onClick={() => setActiveTab("deposit")}
                className={`tab-button ${activeTab === "deposit" ? "active" : ""}`}
              >
                Deposit
              </button>
              <button
                onClick={() => setActiveTab("withdraw")}
                className={`tab-button ${activeTab === "withdraw" ? "active" : ""}`}
              >
                Withdraw
              </button>
            </div>

            {/* Flow indicator */}
            <div className="flex items-center gap-2 mt-6 text-sm">
              {activeTab === "deposit" ? (
                <>
                  <span className="text-[#fbe572] font-medium">Swap SOL</span>
                  <ChevronRight />
                  <span className="text-[#a1fce7] font-medium">Bridge USDC</span>
                  <ChevronRight />
                  <span className="gradient-text-alt font-semibold">Deposit to HypurrFi</span>
                </>
              ) : (
                <>
                  <span className="text-[#fbe572] font-medium">Withdraw</span>
                  <ChevronRight />
                  <span className="text-[#a1fce7] font-medium">Bridge to Solana</span>
                </>
              )}
            </div>

            {/* Content */}
            <div className="mt-6 space-y-6">
              {activeTab === "deposit" ? <DepositFlow /> : <WithdrawFlow />}
            </div>

            {/* Footer */}
            <footer className="mt-12 pt-6 border-t border-white/10">
              <div className="flex items-center justify-center gap-6 text-sm text-zinc-500">
                <a
                  href="https://jup.ag"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Jupiter
                </a>
                <span className="text-zinc-700">|</span>
                <a
                  href="https://wormhole.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Wormhole
                </a>
                <span className="text-zinc-700">|</span>
                <a
                  href="https://app.hypurr.fi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  HypurrFi
                </a>
              </div>
              <p className="text-center text-xs text-zinc-600 mt-4">
                v0.1 - Non-custodial bridge
              </p>
            </footer>
          </div>
        </main>
      </EvmWalletProvider>
    </SolanaWalletProvider>
  );
}

function Header() {
  return (
    <div className="flex items-start justify-between">
      <div>
        <h1 className="text-4xl md:text-5xl font-bold gradient-text">
          HyPortal
        </h1>
        <p className="mt-2 text-zinc-400 max-w-md">
          Bridge your assets from Solana to HyperEVM and deposit into HypurrFi in one seamless flow.
        </p>
      </div>
      <div className="hidden md:block">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#fbe572] to-[#c2f4bc] opacity-80 blur-sm" />
      </div>
    </div>
  );
}

function ChevronRight() {
  return (
    <svg
      className="w-4 h-4 text-zinc-600"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function DepositFlow() {
  return (
    <>
      <JupiterSwapPanel />
      <WormholeBridgePanel direction="deposit" />
      <HypurrDepositPanel />
    </>
  );
}

function WithdrawFlow() {
  return (
    <>
      <HypurrWithdrawPanel />
      <WormholeBridgePanel direction="withdraw" />
      <div className="card p-4">
        <p className="text-sm text-zinc-400">
          <span className="text-[#fbe572]">Note:</span> Withdrawn USDC arrives on Solana as USDC.
          Future versions will support automatic USDC to SOL swap.
        </p>
      </div>
    </>
  );
}
