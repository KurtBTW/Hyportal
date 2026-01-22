"use client";

import React, { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { EvmWalletProvider, useEvmWallet } from "@/components/EvmWallet";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount, TokenAccountNotFoundError } from "@solana/spl-token";
import { getSwapQuote, getSwapTransaction, JupiterQuote } from "@/lib/jupiter";
import { findUsdcReserve, supply, getUserReserveData } from "@/lib/hypurr";
import { getTokenBalance } from "@/lib/erc20";
import { 
  SOLANA_USDC_MINT, 
  USDC_DECIMALS, 
  SOL_DECIMALS,
  parseSolAmount,
  formatSolanaExplorerUrl,
  formatHyperEvmExplorerUrl 
} from "@/lib/constants";

const SolanaWalletProvider = dynamic(
  () => import("@/components/SolanaWalletProvider"),
  { ssr: false }
);

type FlowStep = "input" | "swap" | "bridge" | "deposit" | "complete";
type InputMode = "sol" | "usdc";

function HyPortalApp() {
  const { publicKey: solanaPublicKey, signTransaction, connected: solanaConnected } = useWallet();
  const { connection } = useConnection();
  const { address: evmAddress, isConnected: evmConnected, isHyperEvm, signer, connect: connectEvm, switchToHyperEvm } = useEvmWallet();

  // Flow state
  const [step, setStep] = useState<FlowStep>("input");
  const [inputMode, setInputMode] = useState<InputMode>("sol");
  const [amount, setAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Destination address - can be manually entered OR connected wallet
  const [destinationAddress, setDestinationAddress] = useState("");
  const [useConnectedWallet, setUseConnectedWallet] = useState(false);

  // Balances
  const [solBalance, setSolBalance] = useState<bigint>(BigInt(0));
  const [solanaUsdcBalance, setSolanaUsdcBalance] = useState<bigint>(BigInt(0));
  const [hyperEvmUsdcBalance, setHyperEvmUsdcBalance] = useState<bigint>(BigInt(0));
  const [hypurrfiBalance, setHypurrfiBalance] = useState<bigint>(BigInt(0));

  // Transaction state
  const [quote, setQuote] = useState<JupiterQuote | null>(null);
  const [usdcToDeposit, setUsdcToDeposit] = useState<string>("0");
  const [txHashes, setTxHashes] = useState<{ swap?: string; bridge?: string; deposit?: string }>({});
  const [usdcReserveAddress, setUsdcReserveAddress] = useState<string | null>(null);

  // Get effective destination address
  const effectiveDestination = useConnectedWallet && evmAddress ? evmAddress : destinationAddress;
  const isValidAddress = effectiveDestination && /^0x[a-fA-F0-9]{40}$/.test(effectiveDestination);

  // Auto-fill destination when wallet connects
  useEffect(() => {
    if (evmAddress && !destinationAddress) {
      setDestinationAddress(evmAddress);
      setUseConnectedWallet(true);
    }
  }, [evmAddress, destinationAddress]);

  // Fetch Solana balances
  const fetchSolanaBalances = useCallback(async () => {
    if (!solanaPublicKey || !connection) {
      setSolBalance(BigInt(0));
      setSolanaUsdcBalance(BigInt(0));
      return;
    }

    try {
      const sol = await connection.getBalance(solanaPublicKey);
      setSolBalance(BigInt(sol));

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
      console.error("Error fetching Solana balances:", err);
    }
  }, [solanaPublicKey, connection]);

  // Fetch HyperEVM balances (only when wallet connected for deposit step)
  const fetchHyperEvmBalances = useCallback(async () => {
    if (!evmAddress || !isHyperEvm) {
      setHyperEvmUsdcBalance(BigInt(0));
      setHypurrfiBalance(BigInt(0));
      return;
    }

    try {
      const reserve = await findUsdcReserve();
      if (reserve) {
        setUsdcReserveAddress(reserve);
        const balance = await getTokenBalance(reserve, evmAddress);
        setHyperEvmUsdcBalance(balance);
        const userData = await getUserReserveData(reserve, evmAddress);
        setHypurrfiBalance(userData.currentATokenBalance);
      }
    } catch (err) {
      console.error("Error fetching HyperEVM balances:", err);
    }
  }, [evmAddress, isHyperEvm]);

  useEffect(() => {
    fetchSolanaBalances();
    const interval = setInterval(fetchSolanaBalances, 10000);
    return () => clearInterval(interval);
  }, [fetchSolanaBalances]);

  useEffect(() => {
    if (step === "deposit" || step === "complete") {
      fetchHyperEvmBalances();
      const interval = setInterval(fetchHyperEvmBalances, 10000);
      return () => clearInterval(interval);
    }
  }, [fetchHyperEvmBalances, step]);

  // Fetch quote when amount changes (for SOL input)
  useEffect(() => {
    if (inputMode === "sol" && amount && parseFloat(amount) > 0) {
      const fetchQuote = async () => {
        try {
          const lamports = parseSolAmount(amount).toString();
          const q = await getSwapQuote(lamports);
          setQuote(q);
          setUsdcToDeposit((Number(q.outAmount) / 10 ** USDC_DECIMALS).toFixed(2));
        } catch {
          setQuote(null);
        }
      };
      const timer = setTimeout(fetchQuote, 500);
      return () => clearTimeout(timer);
    } else if (inputMode === "usdc" && amount) {
      setUsdcToDeposit(amount);
      setQuote(null);
    }
  }, [amount, inputMode]);

  // Format helpers
  const formatSol = (lamports: bigint) => (Number(lamports) / 10 ** SOL_DECIMALS).toFixed(4);
  const formatUsdc = (units: bigint) => (Number(units) / 10 ** USDC_DECIMALS).toFixed(2);

  // Can proceed from input step
  const canProceedFromInput = solanaConnected && 
    parseFloat(amount) > 0 && 
    isValidAddress;

  // Step 1: Swap SOL to USDC
  const handleSwap = async () => {
    if (!solanaPublicKey || !signTransaction || !quote) return;
    
    setIsProcessing(true);
    setError(null);

    try {
      const swapData = await getSwapTransaction(quote, solanaPublicKey.toBase58());
      const txBuffer = Buffer.from(swapData.swapTransaction, "base64");
      const tx = VersionedTransaction.deserialize(txBuffer);
      const signed = await signTransaction(tx);
      
      const signature = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight });

      setTxHashes(prev => ({ ...prev, swap: signature }));
      await fetchSolanaBalances();
      setStep("bridge");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Swap failed");
    } finally {
      setIsProcessing(false);
    }
  };

  // Step 2: Bridge (opens Portal Bridge)
  const handleBridge = () => {
    const url = `https://portalbridge.com/?sourceChain=solana&targetChain=arbitrum&asset=USDC&targetAddress=${effectiveDestination}`;
    window.open(url, "_blank", "width=500,height=700");
  };

  // Step 2b: Confirm bridge complete - need to connect wallet for deposit
  const proceedToDeposit = async () => {
    if (!evmConnected) {
      setError("Please connect your EVM wallet to deposit");
      return;
    }
    if (!isHyperEvm) {
      setError("Please switch to HyperEVM network");
      return;
    }
    
    setIsProcessing(true);
    await fetchHyperEvmBalances();
    setStep("deposit");
    setIsProcessing(false);
  };

  // Step 3: Deposit to HypurrFi
  const handleDeposit = async () => {
    if (!signer || !evmAddress || !usdcReserveAddress) return;

    setIsProcessing(true);
    setError(null);

    try {
      const depositAmount = hyperEvmUsdcBalance;
      const tx = await supply(usdcReserveAddress, depositAmount, evmAddress, signer);
      const receipt = await tx.wait();

      setTxHashes(prev => ({ ...prev, deposit: receipt?.hash || tx.hash }));
      await fetchHyperEvmBalances();
      setStep("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deposit failed");
    } finally {
      setIsProcessing(false);
    }
  };

  // Reset flow
  const resetFlow = () => {
    setStep("input");
    setAmount("");
    setQuote(null);
    setUsdcToDeposit("0");
    setTxHashes({});
    setError(null);
  };

  // Determine which steps are complete
  const getStepStatus = (s: FlowStep): "complete" | "current" | "pending" => {
    const order: FlowStep[] = ["input", "swap", "bridge", "deposit", "complete"];
    const currentIndex = order.indexOf(step);
    const stepIndex = order.indexOf(s);
    
    // Skip swap step if using USDC
    if (s === "swap" && inputMode === "usdc") {
      return step === "input" ? "pending" : "complete";
    }
    
    if (stepIndex < currentIndex) return "complete";
    if (stepIndex === currentIndex) return "current";
    return "pending";
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold gradient-text">HyPortal</h1>
          <p className="text-zinc-500 text-sm mt-1">Solana → HyperEVM → HypurrFi</p>
        </div>

        {/* Main Card */}
        <div className="card p-6">
          {/* Progress Steps */}
          <div className="flex items-center justify-between mb-6">
            <StepIndicator label="Fund" status={getStepStatus("swap")} number={1} />
            <StepConnector active={getStepStatus("bridge") !== "pending"} />
            <StepIndicator label="Bridge" status={getStepStatus("bridge")} number={2} />
            <StepConnector active={getStepStatus("deposit") !== "pending"} />
            <StepIndicator label="Deposit" status={getStepStatus("deposit")} number={3} />
          </div>

          {/* Input Step */}
          {step === "input" && (
            <div className="space-y-4">
              {/* Solana Wallet Connection */}
              <div className={`p-3 rounded-xl border transition-all ${solanaConnected ? "border-green-500/30 bg-green-500/5" : "border-white/10 bg-white/5"}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${solanaConnected ? "bg-green-400" : "bg-zinc-600"}`} />
                    <span className="text-sm font-medium">Solana Wallet</span>
                  </div>
                  <WalletMultiButton className="!h-8 !text-xs !px-3" />
                </div>
              </div>

              {/* Input Mode Toggle */}
              <div className="flex gap-2 p-1 bg-white/5 rounded-lg">
                <button
                  onClick={() => { setInputMode("sol"); setAmount(""); }}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${inputMode === "sol" ? "bg-gradient-to-r from-[#fbe572] to-[#c2f4bc] text-black" : "text-zinc-400"}`}
                >
                  Swap SOL
                </button>
                <button
                  onClick={() => { setInputMode("usdc"); setAmount(""); }}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${inputMode === "usdc" ? "bg-gradient-to-r from-[#fbe572] to-[#c2f4bc] text-black" : "text-zinc-400"}`}
                >
                  Use USDC
                </button>
              </div>

              {/* Amount Input */}
              <div className="card-inner p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-zinc-500">
                    {inputMode === "sol" ? "You pay" : "Amount to bridge"}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {solanaConnected ? `Balance: ${inputMode === "sol" ? formatSol(solBalance) : formatUsdc(solanaUsdcBalance)} ${inputMode === "sol" ? "SOL" : "USDC"}` : "Connect wallet"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="flex-1 bg-transparent text-2xl font-semibold outline-none"
                  />
                  <button
                    onClick={() => {
                      if (inputMode === "sol") {
                        const max = Math.max(0, Number(solBalance) / 10 ** SOL_DECIMALS - 0.01);
                        setAmount(max.toFixed(4));
                      } else {
                        setAmount(formatUsdc(solanaUsdcBalance));
                      }
                    }}
                    disabled={!solanaConnected}
                    className="text-xs text-[#fbe572] hover:underline disabled:opacity-50"
                  >
                    MAX
                  </button>
                  <span className="text-zinc-400 font-medium">{inputMode === "sol" ? "SOL" : "USDC"}</span>
                </div>
              </div>

              {/* Destination Address */}
              <div className="card-inner p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-zinc-500">HyperEVM Destination</span>
                  {evmConnected && (
                    <button
                      onClick={() => {
                        setUseConnectedWallet(!useConnectedWallet);
                        if (!useConnectedWallet && evmAddress) {
                          setDestinationAddress(evmAddress);
                        }
                      }}
                      className="text-xs text-[#fbe572] hover:underline"
                    >
                      {useConnectedWallet ? "Enter manually" : "Use connected"}
                    </button>
                  )}
                </div>
                
                {useConnectedWallet && evmAddress ? (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-400" />
                    <span className="font-mono text-sm text-zinc-300">{evmAddress}</span>
                  </div>
                ) : (
                  <input
                    type="text"
                    value={destinationAddress}
                    onChange={(e) => {
                      setDestinationAddress(e.target.value);
                      setUseConnectedWallet(false);
                    }}
                    placeholder="0x..."
                    className="w-full bg-transparent font-mono text-sm outline-none text-zinc-300"
                  />
                )}
                
                {!evmConnected && (
                  <button
                    onClick={connectEvm}
                    className="mt-2 text-xs text-zinc-500 hover:text-[#fbe572] transition-colors"
                  >
                    Or connect wallet →
                  </button>
                )}
              </div>

              {/* Output Preview */}
              {parseFloat(amount) > 0 && isValidAddress && (
                <div className="card-inner p-4 bg-[#fbe572]/5 border-[#fbe572]/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">You will deposit</span>
                    <span className="text-lg font-semibold text-[#a1fce7]">
                      ~{usdcToDeposit} USDC
                    </span>
                  </div>
                  {inputMode === "sol" && quote && (
                    <p className="text-xs text-zinc-500 mt-1">via Jupiter Swap</p>
                  )}
                </div>
              )}

              {/* Continue Button */}
              <button
                onClick={() => inputMode === "sol" ? setStep("swap") : setStep("bridge")}
                disabled={!canProceedFromInput}
                className="w-full btn-primary py-4 text-base disabled:opacity-50"
              >
                {!solanaConnected ? "Connect Solana Wallet" : 
                 !isValidAddress ? "Enter destination address" :
                 "Continue"}
              </button>
            </div>
          )}

          {/* Swap Step */}
          {step === "swap" && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#fbe572] to-[#c2f4bc] mx-auto flex items-center justify-center mb-4">
                  <span className="text-2xl">🔄</span>
                </div>
                <h3 className="text-lg font-semibold mb-1">Swap SOL to USDC</h3>
                <p className="text-sm text-zinc-400">
                  {amount} SOL → ~{usdcToDeposit} USDC
                </p>
              </div>

              <div className="card-inner p-3 text-sm">
                <div className="flex justify-between mb-1">
                  <span className="text-zinc-500">Rate</span>
                  <span className="text-zinc-300">via Jupiter</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Slippage</span>
                  <span className="text-zinc-300">0.5%</span>
                </div>
              </div>

              <button
                onClick={handleSwap}
                disabled={isProcessing}
                className="w-full btn-primary py-4 text-base disabled:opacity-50"
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner /> Swapping...
                  </span>
                ) : (
                  "Confirm Swap"
                )}
              </button>

              <button onClick={() => setStep("input")} className="w-full text-sm text-zinc-500 hover:text-white">
                ← Back
              </button>
            </div>
          )}

          {/* Bridge Step */}
          {step === "bridge" && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#a1fce7] to-[#22c55e] mx-auto flex items-center justify-center mb-4">
                  <span className="text-2xl">🌉</span>
                </div>
                <h3 className="text-lg font-semibold mb-1">Bridge to HyperEVM</h3>
                <p className="text-sm text-zinc-400">
                  {formatUsdc(solanaUsdcBalance)} USDC available
                </p>
              </div>

              <div className="card-inner p-4 text-sm">
                <div className="flex justify-between mb-2">
                  <span className="text-zinc-500">To Address</span>
                  <span className="font-mono text-zinc-300 text-xs">{effectiveDestination.slice(0, 8)}...{effectiveDestination.slice(-6)}</span>
                </div>
                <p className="text-xs text-zinc-500">
                  Bridge will open in a new window. Complete the transfer, then return here.
                </p>
              </div>

              <button
                onClick={handleBridge}
                className="w-full btn-primary py-4 text-base"
              >
                Open Portal Bridge
              </button>

              {/* Connect wallet for deposit OR skip if just bridging */}
              <div className="card-inner p-4">
                <p className="text-xs text-zinc-500 mb-3">After bridging, connect wallet to deposit:</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${evmConnected && isHyperEvm ? "bg-green-400" : "bg-zinc-600"}`} />
                    <span className="text-sm">HyperEVM</span>
                  </div>
                  {!evmConnected ? (
                    <button onClick={connectEvm} className="btn-primary !py-1.5 !px-3 !text-xs">
                      Connect
                    </button>
                  ) : !isHyperEvm ? (
                    <button onClick={switchToHyperEvm} className="btn-secondary !py-1.5 !px-3 !text-xs">
                      Switch Network
                    </button>
                  ) : (
                    <span className="text-xs text-green-400">Ready</span>
                  )}
                </div>
              </div>

              <button
                onClick={proceedToDeposit}
                disabled={isProcessing || !evmConnected || !isHyperEvm}
                className="w-full btn-secondary py-3 text-sm disabled:opacity-50"
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner /> Checking...
                  </span>
                ) : (
                  "Continue to Deposit"
                )}
              </button>

              <button onClick={() => setStep("input")} className="w-full text-sm text-zinc-500 hover:text-white">
                ← Back
              </button>
            </div>
          )}

          {/* Deposit Step */}
          {step === "deposit" && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#fbe572] to-[#c2f4bc] mx-auto flex items-center justify-center mb-4">
                  <span className="text-2xl">🏦</span>
                </div>
                <h3 className="text-lg font-semibold mb-1">Deposit to HypurrFi</h3>
                <p className="text-sm text-zinc-400">
                  {formatUsdc(hyperEvmUsdcBalance)} USDC on HyperEVM
                </p>
              </div>

              {hyperEvmUsdcBalance <= BigInt(0) ? (
                <div className="card-inner p-4 text-center">
                  <p className="text-sm text-zinc-400 mb-3">
                    No USDC detected yet. Bridge may still be processing.
                  </p>
                  <button
                    onClick={fetchHyperEvmBalances}
                    disabled={isProcessing}
                    className="btn-secondary !py-2 !px-4 !text-sm"
                  >
                    {isProcessing ? <Spinner /> : "Check Again"}
                  </button>
                </div>
              ) : (
                <>
                  <div className="card-inner p-3 text-sm">
                    <div className="flex justify-between mb-1">
                      <span className="text-zinc-500">Protocol</span>
                      <span className="text-zinc-300">HypurrFi (Aave V3)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Amount</span>
                      <span className="text-[#a1fce7] font-medium">{formatUsdc(hyperEvmUsdcBalance)} USDC</span>
                    </div>
                  </div>

                  <button
                    onClick={handleDeposit}
                    disabled={isProcessing}
                    className="w-full btn-primary py-4 text-base disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <span className="flex items-center justify-center gap-2">
                        <Spinner /> Depositing...
                      </span>
                    ) : (
                      "Confirm Deposit"
                    )}
                  </button>
                </>
              )}

              <button onClick={() => setStep("bridge")} className="w-full text-sm text-zinc-500 hover:text-white">
                ← Back
              </button>
            </div>
          )}

          {/* Complete Step */}
          {step === "complete" && (
            <div className="space-y-4">
              <div className="text-center py-6">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#22c55e] to-[#a1fce7] mx-auto flex items-center justify-center mb-4">
                  <span className="text-3xl">✓</span>
                </div>
                <h3 className="text-xl font-semibold mb-1 gradient-text">Deposit Complete!</h3>
                <p className="text-sm text-zinc-400">
                  Your USDC is now earning yield on HypurrFi
                </p>
              </div>

              <div className="card-inner p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Deposited</span>
                  <span className="text-[#a1fce7] font-semibold">{formatUsdc(hypurrfiBalance)} USDC</span>
                </div>
                {txHashes.deposit && (
                  <a href={formatHyperEvmExplorerUrl(txHashes.deposit)} target="_blank" rel="noopener noreferrer" className="block text-xs text-[#fbe572] hover:underline text-right">
                    View transaction →
                  </a>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <a
                  href="https://app.hypurr.fi/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary py-3 text-sm text-center"
                >
                  View on HypurrFi
                </a>
                <button onClick={resetFlow} className="btn-primary py-3 text-sm">
                  New Deposit
                </button>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
              <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-zinc-600 mt-4">
          Powered by Jupiter + Wormhole + HypurrFi
        </p>
      </div>
    </main>
  );
}

function StepIndicator({ label, status, number }: { label: string; status: "complete" | "current" | "pending"; number: number }) {
  return (
    <div className="flex flex-col items-center">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
        status === "complete" 
          ? "bg-[#22c55e] text-black" 
          : status === "current"
          ? "bg-gradient-to-br from-[#fbe572] to-[#c2f4bc] text-black"
          : "bg-white/10 text-zinc-500"
      }`}>
        {status === "complete" ? "✓" : number}
      </div>
      <span className={`text-xs mt-1 ${status === "pending" ? "text-zinc-600" : "text-zinc-400"}`}>
        {label}
      </span>
    </div>
  );
}

function StepConnector({ active }: { active: boolean }) {
  return (
    <div className={`flex-1 h-0.5 mx-2 rounded transition-all ${active ? "bg-[#22c55e]" : "bg-white/10"}`} />
  );
}

function Spinner() {
  return <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />;
}

export default function Home() {
  return (
    <SolanaWalletProvider>
      <EvmWalletProvider>
        <HyPortalApp />
      </EvmWalletProvider>
    </SolanaWalletProvider>
  );
}
