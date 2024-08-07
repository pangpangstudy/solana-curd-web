"use client";

import dynamic from "next/dynamic";
import { AnchorProvider } from "@coral-xyz/anchor";
import { WalletError } from "@solana/wallet-adapter-base";
import {
  AnchorWallet,
  useConnection,
  useWallet,
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { ReactNode, useCallback, useMemo } from "react";
import { useCluster } from "../cluster/cluster-data-access";

require("@solana/wallet-adapter-react-ui/styles.css");
// 动态引入WalletMultiButton 并关闭ssr
export const WalletButton = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);
//
export function SolanaProvider({ children }: { children: ReactNode }) {
  // 获取当前集群
  const { cluster } = useCluster();
  // 获取集群endpoint
  const endpoint = useMemo(() => cluster.endpoint, [cluster]);
  const onError = useCallback((error: WalletError) => {
    console.error(error);
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={[]} onError={onError} autoConnect={true}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
// 设置AnchorProvider 方便程序交互
export function useAnchorProvider() {
  const { connection } = useConnection();
  const wallet = useWallet();

  return new AnchorProvider(connection, wallet as AnchorWallet, {
    commitment: "confirmed",
  });
}
