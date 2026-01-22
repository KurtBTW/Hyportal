"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { HYPEREVM_CHAIN_ID, HYPEREVM_CHAIN, HYPEREVM_RPC } from "@/lib/constants";

// Extend Window interface for ethereum
declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, callback: (...args: unknown[]) => void) => void;
      removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
    };
  }
}

interface EvmWalletState {
  address: string | null;
  chainId: number | null;
  isConnected: boolean;
  isHyperEvm: boolean;
  provider: ethers.BrowserProvider | null;
  signer: ethers.Signer | null;
}

interface EvmWalletContextType extends EvmWalletState {
  connect: () => Promise<void>;
  disconnect: () => void;
  switchToHyperEvm: () => Promise<void>;
  error: string | null;
}

const EvmWalletContext = React.createContext<EvmWalletContextType | null>(null);

export function useEvmWallet() {
  const context = React.useContext(EvmWalletContext);
  if (!context) {
    throw new Error("useEvmWallet must be used within EvmWalletProvider");
  }
  return context;
}

export function EvmWalletProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<EvmWalletState>({
    address: null,
    chainId: null,
    isConnected: false,
    isHyperEvm: false,
    provider: null,
    signer: null,
  });
  const [error, setError] = useState<string | null>(null);

  const updateWalletState = useCallback(async () => {
    if (!window.ethereum) {
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = (await provider.listAccounts()) as ethers.JsonRpcSigner[];
      
      if (accounts.length === 0) {
        setState({
          address: null,
          chainId: null,
          isConnected: false,
          isHyperEvm: false,
          provider: null,
          signer: null,
        });
        return;
      }

      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);

      setState({
        address,
        chainId,
        isConnected: true,
        isHyperEvm: chainId === HYPEREVM_CHAIN_ID,
        provider,
        signer,
      });
      setError(null);
    } catch (err) {
      console.error("Error updating wallet state:", err);
      setError("Failed to connect to wallet");
    }
  }, []);

  // Listen for account and chain changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = () => {
      updateWalletState();
    };

    const handleChainChanged = () => {
      updateWalletState();
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    // Check initial state
    updateWalletState();

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
        window.ethereum.removeListener("chainChanged", handleChainChanged);
      }
    };
  }, [updateWalletState]);

  const connect = async () => {
    if (!window.ethereum) {
      setError("No EVM wallet detected. Please install MetaMask or Rabby.");
      return;
    }

    try {
      setError(null);
      await window.ethereum.request({ method: "eth_requestAccounts" });
      await updateWalletState();
    } catch (err) {
      console.error("Connect error:", err);
      setError("Failed to connect wallet");
    }
  };

  const disconnect = () => {
    setState({
      address: null,
      chainId: null,
      isConnected: false,
      isHyperEvm: false,
      provider: null,
      signer: null,
    });
  };

  const switchToHyperEvm = async () => {
    if (!window.ethereum) {
      setError("No EVM wallet detected");
      return;
    }

    try {
      setError(null);
      
      // Try to switch to HyperEVM
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: HYPEREVM_CHAIN.chainId }],
        });
      } catch (switchError: unknown) {
        // Chain not added, try to add it
        const err = switchError as { code?: number };
        if (err.code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [HYPEREVM_CHAIN],
          });
        } else {
          throw switchError;
        }
      }

      await updateWalletState();
    } catch (err) {
      console.error("Switch chain error:", err);
      setError("Failed to switch to HyperEVM network");
    }
  };

  return (
    <EvmWalletContext.Provider
      value={{
        ...state,
        connect,
        disconnect,
        switchToHyperEvm,
        error,
      }}
    >
      {children}
    </EvmWalletContext.Provider>
  );
}

// Connection button component
export function EvmConnectButton() {
  const { address, isConnected, isHyperEvm, connect, switchToHyperEvm, error } =
    useEvmWallet();

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (!isConnected) {
    return (
      <div>
        <button
          onClick={connect}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
        >
          Connect EVM Wallet
        </button>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>
    );
  }

  if (!isHyperEvm) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-yellow-500">Wrong Network</span>
          <span className="text-gray-400">{formatAddress(address!)}</span>
        </div>
        <button
          onClick={switchToHyperEvm}
          className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium"
        >
          Switch to HyperEVM
        </button>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-green-900/50 border border-green-600 rounded-lg">
      <span className="text-green-400">HyperEVM</span>
      <span className="text-white font-mono">{formatAddress(address!)}</span>
    </div>
  );
}
