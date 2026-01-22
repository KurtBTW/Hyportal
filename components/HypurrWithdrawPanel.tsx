"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { useEvmWallet, EvmConnectButton } from "./EvmWallet";
import {
  findUsdcReserve,
  withdraw,
  formatUsdcBalance,
  parseUsdcInput,
  getUserReserveData,
} from "@/lib/hypurr";
import { getTokenBalance } from "@/lib/erc20";
import { formatHyperEvmExplorerUrl, USDC_DECIMALS } from "@/lib/constants";

type WithdrawState = "idle" | "checking" | "withdrawing" | "complete" | "error";

export default function HypurrWithdrawPanel() {
  const { isConnected, isHyperEvm, signer, address } = useEvmWallet();

  const [usdcAddress, setUsdcAddress] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<bigint>(BigInt(0));
  const [depositedBalance, setDepositedBalance] = useState<bigint>(BigInt(0));
  const [amount, setAmount] = useState("");
  const [state, setState] = useState<WithdrawState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const refreshData = useCallback(async () => {
    if (!isConnected || !isHyperEvm || !address) return;

    try {
      setState("checking");
      setError(null);

      const reserveAddress = await findUsdcReserve();

      if (!reserveAddress) {
        setError("USDC not found in HypurrFi reserves.");
        setState("error");
        return;
      }

      setUsdcAddress(reserveAddress);

      const balance = await getTokenBalance(reserveAddress, address);
      setWalletBalance(balance);

      const userData = await getUserReserveData(reserveAddress, address);
      setDepositedBalance(userData.currentATokenBalance);

      setState("idle");
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Failed to fetch data");
      setState("error");
    }
  }, [isConnected, isHyperEvm, address]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  useEffect(() => {
    if (!isConnected || !isHyperEvm) return;
    const interval = setInterval(refreshData, 15000);
    return () => clearInterval(interval);
  }, [isConnected, isHyperEvm, refreshData]);

  const handleWithdraw = async () => {
    if (!signer || !address || !usdcAddress) {
      setError("Wallet not connected or USDC not found");
      return;
    }

    let withdrawAmount: bigint;
    if (amount.toLowerCase() === "max" || parseUsdcInput(amount) >= depositedBalance) {
      withdrawAmount = ethers.MaxUint256;
    } else {
      withdrawAmount = parseUsdcInput(amount);
    }

    if (withdrawAmount <= BigInt(0) && withdrawAmount !== ethers.MaxUint256) {
      setError("Please enter a valid amount");
      return;
    }

    try {
      setState("withdrawing");
      setError(null);
      setTxHash(null);

      const tx = await withdraw(usdcAddress, withdrawAmount, address, signer);
      const receipt = await tx.wait();

      setTxHash(receipt?.hash || tx.hash);
      setState("complete");

      await refreshData();
      setAmount("");
    } catch (err) {
      console.error("Withdraw error:", err);
      setError(err instanceof Error ? err.message : "Withdrawal failed");
      setState("error");
    }
  };

  const setMaxAmount = () => {
    const maxUsdc = Number(depositedBalance) / 10 ** USDC_DECIMALS;
    setAmount(maxUsdc.toString());
  };

  const canWithdraw =
    isConnected &&
    isHyperEvm &&
    usdcAddress &&
    state === "idle" &&
    parseFloat(amount) > 0 &&
    depositedBalance > BigInt(0);

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#fbe572] to-[#c2f4bc] flex items-center justify-center text-black font-bold text-sm">
            1
          </div>
          <h3 className="text-lg font-semibold">Withdraw from HypurrFi</h3>
        </div>
        <EvmConnectButton />
      </div>

      {isConnected && isHyperEvm && (
        <div className="space-y-3 mb-6">
          <div className="card-inner p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-zinc-500">Deposited in HypurrFi</span>
              <span className="text-[#a1fce7] font-medium">{formatUsdcBalance(depositedBalance)} USDC</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-500">Wallet USDC</span>
              <span className="text-white font-medium">{formatUsdcBalance(walletBalance)} USDC</span>
            </div>
          </div>
        </div>
      )}

      {isConnected && isHyperEvm && usdcAddress && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-500 mb-2">Withdraw Amount</label>
            <div className="card-inner flex items-center p-4">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                min="0"
                step="0.01"
                className="flex-1 bg-transparent text-xl font-medium outline-none"
                disabled={state !== "idle" && state !== "error"}
              />
              <button
                onClick={setMaxAmount}
                className="px-2 py-1 text-xs bg-white/10 text-zinc-300 rounded hover:bg-white/20 transition-colors mr-2"
              >
                MAX
              </button>
              <span className="text-zinc-400 font-medium">USDC</span>
            </div>
          </div>

          <button
            onClick={handleWithdraw}
            disabled={!canWithdraw}
            className="w-full btn-secondary py-4 text-base border-[#fbe572]/30 hover:border-[#fbe572]/50"
          >
            {state === "checking" && "Checking..."}
            {state === "withdrawing" && "Withdrawing..."}
            {state === "complete" && "Withdrawal Complete!"}
            {state === "idle" && "Withdraw from HypurrFi"}
            {state === "error" && "Try Again"}
          </button>

          {depositedBalance === BigInt(0) && state === "idle" && (
            <p className="text-zinc-500 text-sm text-center">
              No USDC deposited in HypurrFi
            </p>
          )}
        </div>
      )}

      {!isConnected && (
        <p className="text-zinc-400 text-sm">
          Connect your EVM wallet and switch to HyperEVM to withdraw.
        </p>
      )}

      {isConnected && !isHyperEvm && (
        <p className="text-[#fbe572] text-sm">
          Please switch to HyperEVM network to withdraw.
        </p>
      )}

      {error && (
        <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {txHash && (
        <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
          <p className="text-green-400 text-sm">Withdrawal confirmed!</p>
          <a
            href={formatHyperEvmExplorerUrl(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-400 text-sm hover:underline"
          >
            View on Hyperscan &rarr;
          </a>
        </div>
      )}
    </div>
  );
}
