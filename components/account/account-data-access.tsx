"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  TransactionSignature,
  VersionedTransaction,
} from "@solana/web3.js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useTransactionToast } from "../ui/ui-layout";
// 获取账户余额
export function useGetBalance({ address }: { address: PublicKey }) {
  // 获取connection
  const { connection } = useConnection();
  // 使用react-query
  return useQuery({
    queryKey: ["get-balance", { endpoint: connection.rpcEndpoint, address }],
    queryFn: () => connection.getBalance(address),
  });
}
// 获取Signature info
// getConfirmedSignaturesForAddress2 方法，获取指定地址的已确认签名。
export function useGetSignatures({ address }: { address: PublicKey }) {
  const { connection } = useConnection();

  return useQuery({
    queryKey: ["get-signatures", { endpoint: connection.rpcEndpoint, address }],
    // getConfirmedSignaturesForAddress2 方法，获取指定地址的已确认签名。
    queryFn: () => connection.getConfirmedSignaturesForAddress2(address),
  });
}
// 获取所有的TokenAccount
export function useGetTokenAccounts({ address }: { address: PublicKey }) {
  const { connection } = useConnection();

  return useQuery({
    queryKey: [
      "get-token-accounts",
      { endpoint: connection.rpcEndpoint, address },
    ],
    queryFn: async () => {
      // 获取一个address 下的所有TokenAccount  返回所有的address 和 余额
      const [tokenAccounts, token2022Accounts] = await Promise.all([
        connection.getParsedTokenAccountsByOwner(address, {
          programId: TOKEN_PROGRAM_ID,
        }),
        connection.getParsedTokenAccountsByOwner(address, {
          programId: TOKEN_2022_PROGRAM_ID,
        }),
      ]);
      return [...tokenAccounts.value, ...token2022Accounts.value];
    },
  });
}

export function useTransferSol({ address }: { address: PublicKey }) {
  const { connection } = useConnection();
  const transactionToast = useTransactionToast();
  const wallet = useWallet();
  const client = useQueryClient();

  return useMutation({
    mutationKey: [
      "transfer-sol",
      { endpoint: connection.rpcEndpoint, address },
    ],
    // 交互方法
    mutationFn: async (input: { destination: PublicKey; amount: number }) => {
      let signature: TransactionSignature = "";
      try {
        // 创建交易
        const { transaction, latestBlockhash } = await createTransaction({
          publicKey: address,
          destination: input.destination,
          amount: input.amount,
          connection,
        });

        // Send transaction and await for signature
        signature = await wallet.sendTransaction(transaction, connection);

        // Send transaction and await for signature
        await connection.confirmTransaction(
          { signature, ...latestBlockhash },
          "confirmed"
        );

        console.log(signature);
        return signature;
      } catch (error: unknown) {
        console.log("error", `Transaction failed! ${error}`, signature);

        return;
      }
    },
    onSuccess: (signature) => {
      if (signature) {
        transactionToast(signature);
      }
      return Promise.all([
        client.invalidateQueries({
          queryKey: [
            "get-balance",
            { endpoint: connection.rpcEndpoint, address },
          ],
        }),
        client.invalidateQueries({
          queryKey: [
            "get-signatures",
            { endpoint: connection.rpcEndpoint, address },
          ],
        }),
      ]);
    },
    onError: (error) => {
      toast.error(`Transaction failed! ${error}`);
    },
  });
}
// 请求空投
export function useRequestAirdrop({ address }: { address: PublicKey }) {
  const { connection } = useConnection();
  const transactionToast = useTransactionToast();
  const client = useQueryClient();
  //
  return useMutation({
    mutationKey: ["airdrop", { endpoint: connection.rpcEndpoint, address }],
    // 空投function
    mutationFn: async (amount: number = 1) => {
      // 获取最近latestBlockhash 、signature
      const [latestBlockhash, signature] = await Promise.all([
        connection.getLatestBlockhash(),
        connection.requestAirdrop(address, amount * LAMPORTS_PER_SOL),
      ]);
      // 验证交易
      await connection.confirmTransaction(
        { signature, ...latestBlockhash },
        "confirmed"
      );
      // 返回signature
      return signature;
    },
    // 成功之后
    onSuccess: (signature) => {
      // 提示signature message
      transactionToast(signature);
      // invalidateQueries 用于使缓存中的查询失效，从而触发这些查询的重新获取。
      return Promise.all([
        // 缓存中的查询失效  重新获取balance
        client.invalidateQueries({
          queryKey: [
            "get-balance",
            { endpoint: connection.rpcEndpoint, address },
          ],
        }),
        client.invalidateQueries({
          queryKey: [
            "get-signatures",
            { endpoint: connection.rpcEndpoint, address },
          ],
        }),
      ]);
    },
  });
}

async function createTransaction({
  publicKey,
  destination,
  amount,
  connection,
}: {
  publicKey: PublicKey;
  destination: PublicKey;
  amount: number;
  connection: Connection;
}): Promise<{
  transaction: VersionedTransaction;
  latestBlockhash: { blockhash: string; lastValidBlockHeight: number };
}> {
  // Get the latest blockhash to use in our transaction
  const latestBlockhash = await connection.getLatestBlockhash();

  // Create instructions to send, in this case a simple transfer
  const instructions = [
    SystemProgram.transfer({
      fromPubkey: publicKey,
      toPubkey: destination,
      lamports: amount * LAMPORTS_PER_SOL,
    }),
  ];

  // Create a new TransactionMessage with version and compile it to legacy
  const messageLegacy = new TransactionMessage({
    payerKey: publicKey,
    recentBlockhash: latestBlockhash.blockhash,
    instructions,
  }).compileToLegacyMessage();

  // Create a new VersionedTransaction which supports legacy and v0
  const transaction = new VersionedTransaction(messageLegacy);

  return {
    transaction,
    latestBlockhash,
  };
}
