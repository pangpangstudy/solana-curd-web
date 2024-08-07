"use client";

import { getJournalProgram, getJournalProgramId } from "@journal/anchor";
import { useConnection } from "@solana/wallet-adapter-react";
import { Cluster, PublicKey } from "@solana/web3.js";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useCluster } from "../cluster/cluster-data-access";
import { useAnchorProvider } from "../solana/solana-provider";
import { useTransactionToast } from "../ui/ui-layout";
import { useMemo } from "react";

interface CreateEntryArgs {
  title: string;
  message: string;
  owner: PublicKey;
}

export function useJournalProgram() {
  const { connection } = useConnection();
  const { cluster } = useCluster();
  const transactionToast = useTransactionToast();
  // provider
  const provider = useAnchorProvider();
  // programId  不同网络返回不同的programId
  const programId = useMemo(
    () => getJournalProgramId(cluster.network as Cluster),
    [cluster]
  );
  // 使用provider 返回program实例   new Program(JournalIDL as Journal, provider)
  const program = getJournalProgram(provider);
  // 获取account中所有的journalEntryState的内容
  const accounts = useQuery({
    queryKey: ["journal", "all", { cluster }],
    queryFn: () => program.account.journalEntryState.all(),
  });
  //获取 Solana 程序账户的信息
  // data: Buffer | ParsedAccountData
  // executable: boolean;
  // lamports: number;
  // owner: PublicKey;
  // rentEpoch?: number;
  // ParsedAccountData
  // parsed: any;
  // program: string;
  // space: number;
  // await connection.getProgramAccounts(programId); 获取数据账户
  // await connection.getParsedAccountInfo(dataAccountAddress);获取数据账户
  const getProgramAccount = useQuery({
    queryKey: ["get-program-account", { cluster }],
    queryFn: () => connection.getParsedAccountInfo(programId),
  });
  // 程序交互
  const createEntry = useMutation<string, Error, CreateEntryArgs>({
    mutationKey: ["journalEntry", "create", { cluster }],
    mutationFn: async ({ title, message }) => {
      // 使用 Anchor 框架时，不需要直接处理 Buffer 或复杂的序列化/反序列化过程
      return program.methods.createJournalEntry(title, message).rpc();
    },
    onSuccess: (signature) => {
      transactionToast(signature);
      accounts.refetch();
    },
    onError: (error) => {
      toast.error(`Failed to create journal entry: ${error.message}`);
    },
  });

  return {
    program,
    programId,
    accounts,
    getProgramAccount,
    createEntry,
  };
}
//
export function useJournalProgramAccount({ account }: { account: PublicKey }) {
  const { cluster } = useCluster();
  const transactionToast = useTransactionToast();
  const { program, accounts } = useJournalProgram();

  const accountQuery = useQuery({
    queryKey: ["journal", "fetch", { cluster, account }],
    // account 是要读取的特定 Solana 账户的地址
    queryFn: () => program.account.journalEntryState.fetch(account),
  });

  const updateEntry = useMutation<string, Error, CreateEntryArgs>({
    mutationKey: ["journalEntry", "update", { cluster }],
    mutationFn: async ({ title, message, owner }) => {
      return program.methods.updateJournalEntry(title, message).rpc();
    },
    onSuccess: (signature) => {
      transactionToast(signature);
      accounts.refetch();
    },
    onError: (error) => {
      toast.error(`Failed to update journal entry: ${error.message}`);
    },
  });

  const deleteEntry = useMutation({
    mutationKey: ["journal", "deleteEntry", { cluster, account }],
    mutationFn: (title: string) =>
      program.methods.deleteJournalEntry(title).rpc(),
    onSuccess: (tx) => {
      transactionToast(tx);
      return accounts.refetch();
    },
  });

  return {
    accountQuery,
    updateEntry,
    deleteEntry,
  };
}
