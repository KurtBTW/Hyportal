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

  // Find USDC reserve and fetch balances
  const refreshData = useCallback(async () => {
    if (!isConnected || !isHyperEvm || !address) return;

    try {
      setState("checking");
      setError(null);

      // Find USDC in HypurrFi reserves
      const reserveAddress = await findUsdcReserve();
      
      if (!reserveAddress) {
        setError("USDC not found in HypurrFi reserves.");
        setState("error");
        return;
      }

      setUsdcAddress(reserveAddress);

      // Get wallet USDC balance
      const balance = await getTokenBalance(reserveAddress, address);
      setWalletBalance(balance);

      // Get deposited balance in HypurrFi
      const userData = await getUserReserveData(reserveAddress, address);
      setDepositedBalance(userData.currentATokenBalance);

      setState("idle");
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Failed to fetch data. Please try again.");
      setState("error");
    }
  }, [isConnected, isHyperEvm, address]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Refresh periodically
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
      // Withdraw max
      withdrawAmount = ethers.MaxUint256;
    } else {
      withdrawAmount = parseUsdcInput(amount);
    }

    if (withdrawAmount <= BigInt(0) && withdrawAmount !== ethers.MaxUint256) {
      setError("Please enter a valid amount");
      return;
    }

    if (withdrawAmount > depositedBalance && withdrawAmount !== ethers.MaxUint256) {
      setError("Insufficient deposited balance");
      return;
    }

    try {
      setState("withdrawing");
      setError(null);
      setTxHash(null);

      // Withdraw from HypurrFi
      const tx = await withdraw(usdcAddress, withdrawAmount, address, signer);
      const receipt = await tx.wait();

      setTxHash(receipt?.hash || tx.hash);
      setState("complete");

      // Refresh balances
      await refreshData();
      setAmount("");
    } catch (err) {
      console.error("Withdraw error:", err);
      setError(err instanceof Error ? err.message : "Withdrawal failed. Please try again.");
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
    <div className="bg-gray-800 rounded-xl p-6 space-y-4">
      <div className="flex justify-between items-start">
        <h3 className="text-lg font-semibold text-white">1. Withdraw from HypurrFi</h3>
        <EvmConnectButton />
      </div>

      {isConnected && isHyperEvm && (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-gray-400">
            <span>Deposited in HypurrFi</span>
            <span className="text-green-400">{formatUsdcBalance(depositedBalance)} USDC</span>
          </div>
          <div className="flex justify-between text-gray-400">
            <span>Wallet USDC</span>
            <span className="text-white">{formatUsdcBalance(walletBalance)} USDC</span>
          </div>
          {usdcAddress && (
            <div className="text-xs text-gray-500 break-all">
              Reserve: {usdcAddress}
            </div>
          )}
        </div>
      )}

      {isConnected && isHyperEvm && usdcAddress && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Withdraw Amount</label>
            <div className="flex items-center gap-2 bg-gray-900 rounded-lg p-3">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                min="0"
                step="0.01"
                className="flex-1 bg-transparent text-white text-lg outline-none"
                disabled={state !== "idle" && state !== "error"}
              />
              <button
                onClick={setMaxAmount}
                className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
              >
                MAX
              </button>
              <span className="text-gray-400 font-medium">USDC</span>
            </div>
          </div>

          <button
            onClick={handleWithdraw}
            disabled={!canWithdraw}
            className={`w-full py-3 rounded-lg font-semibold transition-colors ${
              canWithdraw
                ? "bg-orange-600 hover:bg-orange-700 text-white"
                : "bg-gray-600 text-gray-400 cursor-not-allowed"
            }`}
          >
            {state === "checking" && "Checking Balance..."}
            {state === "withdrawing" && "Withdrawing..."}
            {state === "complete" && "Withdrawal Complete!"}
            {state === "idle" && "Withdraw from HypurrFi"}
            {state === "error" && "Try Again"}
          </button>

          {depositedBalance === BigInt(0) && state === "idle" && (
            <p className="text-gray-400 text-sm text-center">
              No USDC deposited in HypurrFi
            </p>
          )}
        </div>
      )}

      {!isConnected && (
        <p className="text-gray-400 text-sm">
          Connect your EVM wallet and switch to HyperEVM to withdraw.
        </p>
      )}

      {isConnected && !isHyperEvm && (
        <p className="text-yellow-400 text-sm">
          Please switch to HyperEVM network to withdraw.
        </p>
      )}

      {error && (
        <div className="p-3 bg-red-900/50 border border-red-500 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {txHash && (
        <div className="p-3 bg-green-900/50 border border-green-500 rounded-lg">
          <p className="text-green-300 text-sm">Withdrawal confirmed!</p>
          <a
            href={formatHyperEvmExplorerUrl(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-400 text-sm hover:underline break-all"
          >
            View on Hyperscan
          </a>
        </div>
      )}
    </div>
  );
}
