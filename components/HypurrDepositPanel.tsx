"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useEvmWallet, EvmConnectButton } from "./EvmWallet";
import {
  findUsdcReserve,
  supply,
  formatUsdcBalance,
  parseUsdcInput,
  getUserReserveData,
} from "@/lib/hypurr";
import { getTokenBalance } from "@/lib/erc20";
import { formatHyperEvmExplorerUrl, USDC_DECIMALS } from "@/lib/constants";

type DepositState = "idle" | "checking" | "approving" | "depositing" | "complete" | "error";

export default function HypurrDepositPanel() {
  const { isConnected, isHyperEvm, signer, address } = useEvmWallet();

  const [usdcAddress, setUsdcAddress] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<bigint>(BigInt(0));
  const [depositedBalance, setDepositedBalance] = useState<bigint>(BigInt(0));
  const [amount, setAmount] = useState("");
  const [state, setState] = useState<DepositState>("idle");
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
        setError(
          "Bridged USDC token is not listed in HypurrFi reserves; cannot deposit."
        );
        setState("error");
        return;
      }

      setUsdcAddress(reserveAddress);

      // Get wallet USDC balance
      const balance = await getTokenBalance(reserveAddress, address);
      setUsdcBalance(balance);

      // Get deposited balance in HypurrFi
      const userData = await getUserReserveData(reserveAddress, address);
      setDepositedBalance(userData.currentATokenBalance);

      setState("idle");
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Failed to fetch USDC data. Please try again.");
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

  const handleDeposit = async () => {
    if (!signer || !address || !usdcAddress) {
      setError("Wallet not connected or USDC not found");
      return;
    }

    const depositAmount = parseUsdcInput(amount);
    if (depositAmount <= BigInt(0)) {
      setError("Please enter a valid amount");
      return;
    }

    if (depositAmount > usdcBalance) {
      setError("Insufficient USDC balance");
      return;
    }

    try {
      setState("depositing");
      setError(null);
      setTxHash(null);

      // Supply to HypurrFi (handles approval internally)
      const tx = await supply(usdcAddress, depositAmount, address, signer);
      const receipt = await tx.wait();

      setTxHash(receipt?.hash || tx.hash);
      setState("complete");

      // Refresh balances
      await refreshData();
      setAmount("");
    } catch (err) {
      console.error("Deposit error:", err);
      setError(err instanceof Error ? err.message : "Deposit failed. Please try again.");
      setState("error");
    }
  };

  const setMaxAmount = () => {
    const maxUsdc = Number(usdcBalance) / 10 ** USDC_DECIMALS;
    setAmount(maxUsdc.toString());
  };

  const canDeposit =
    isConnected &&
    isHyperEvm &&
    usdcAddress &&
    state === "idle" &&
    parseFloat(amount) > 0 &&
    parseUsdcInput(amount) <= usdcBalance;

  return (
    <div className="bg-gray-800 rounded-xl p-6 space-y-4">
      <div className="flex justify-between items-start">
        <h3 className="text-lg font-semibold text-white">3. Deposit to HypurrFi</h3>
        <EvmConnectButton />
      </div>

      {isConnected && isHyperEvm && (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-gray-400">
            <span>Wallet USDC</span>
            <span className="text-white">{formatUsdcBalance(usdcBalance)} USDC</span>
          </div>
          <div className="flex justify-between text-gray-400">
            <span>Deposited in HypurrFi</span>
            <span className="text-green-400">{formatUsdcBalance(depositedBalance)} USDC</span>
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
            <label className="block text-sm text-gray-400 mb-1">Deposit Amount</label>
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
            onClick={handleDeposit}
            disabled={!canDeposit}
            className={`w-full py-3 rounded-lg font-semibold transition-colors ${
              canDeposit
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-gray-600 text-gray-400 cursor-not-allowed"
            }`}
          >
            {state === "checking" && "Checking USDC..."}
            {state === "approving" && "Approving..."}
            {state === "depositing" && "Depositing..."}
            {state === "complete" && "Deposit Complete!"}
            {state === "idle" && "Deposit to HypurrFi"}
            {state === "error" && "Try Again"}
          </button>
        </div>
      )}

      {!isConnected && (
        <p className="text-gray-400 text-sm">
          Connect your EVM wallet and switch to HyperEVM to deposit.
        </p>
      )}

      {isConnected && !isHyperEvm && (
        <p className="text-yellow-400 text-sm">
          Please switch to HyperEVM network to deposit.
        </p>
      )}

      {error && (
        <div className="p-3 bg-red-900/50 border border-red-500 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {txHash && (
        <div className="p-3 bg-green-900/50 border border-green-500 rounded-lg">
          <p className="text-green-300 text-sm">Deposit confirmed!</p>
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
