"use client";

import { clusterApiUrl, Connection } from "@solana/web3.js";
import { atom, useAtomValue, useSetAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { createContext, ReactNode, useContext } from "react";
import toast from "react-hot-toast";
// 定义 Cluster 接口，描述一个 Solana 集群的结构。
export interface Cluster {
  name: string;
  endpoint: string;
  network?: ClusterNetwork;
  active?: boolean;
}
// 定义 ClusterNetwork 枚举，列出 Solana 的不同网络类型。
export enum ClusterNetwork {
  Mainnet = "mainnet-beta",
  Testnet = "testnet",
  Devnet = "devnet",
  Custom = "custom",
}

// 默认不配置主网集群  需要的话 要自己配置endpoint
// 定义默认的 Solana 集群列表，包括 devnet、本地网络和 testnet。
export const defaultClusters: Cluster[] = [
  {
    name: "devnet",
    endpoint: clusterApiUrl("devnet"),
    network: ClusterNetwork.Devnet,
  },
  { name: "local", endpoint: "http://localhost:8899" },
  {
    name: "testnet",
    endpoint: clusterApiUrl("testnet"),
    network: ClusterNetwork.Testnet,
  },
];
// 使用 Jotai 创建持久化的状态，存储当前选中的集群和所有可用集群
const clusterAtom = atomWithStorage<Cluster>(
  "solana-cluster",
  defaultClusters[0]
);
const clustersAtom = atomWithStorage<Cluster[]>(
  "solana-clusters",
  defaultClusters
);
// 创建派生状态，用于计算活跃集群和当前选中的集群。
const activeClustersAtom = atom<Cluster[]>((get) => {
  const clusters = get(clustersAtom);
  const cluster = get(clusterAtom);
  return clusters.map((item) => ({
    ...item,
    active: item.name === cluster.name,
  }));
});

const activeClusterAtom = atom<Cluster>((get) => {
  const clusters = get(activeClustersAtom);

  return clusters.find((item) => item.active) || clusters[0];
});
// Context接口定义：
export interface ClusterProviderContext {
  cluster: Cluster;
  clusters: Cluster[];
  addCluster: (cluster: Cluster) => void;
  deleteCluster: (cluster: Cluster) => void;
  setCluster: (cluster: Cluster) => void;
  getExplorerUrl(path: string): string;
}

const Context = createContext<ClusterProviderContext>(
  {} as ClusterProviderContext
);

export function ClusterProvider({ children }: { children: ReactNode }) {
  // 获取当前集群 和 集群列表
  const cluster = useAtomValue(activeClusterAtom);
  const clusters = useAtomValue(activeClustersAtom);
  const setCluster = useSetAtom(clusterAtom);
  const setClusters = useSetAtom(clustersAtom);
  //
  const value: ClusterProviderContext = {
    cluster,
    clusters: clusters.sort((a, b) => (a.name > b.name ? 1 : -1)),
    // 添加一个集群
    addCluster: (cluster: Cluster) => {
      try {
        // 要保证集群能够链接
        new Connection(cluster.endpoint);
        setClusters([...clusters, cluster]);
      } catch (err) {
        toast.error(`${err}`);
      }
    },
    // 删除一个集群
    deleteCluster: (cluster: Cluster) => {
      setClusters(clusters.filter((item) => item.name !== cluster.name));
    },
    // 设置当前集群
    setCluster: (cluster: Cluster) => setCluster(cluster),
    // 根据当前集群设置ExplorerUrl
    getExplorerUrl: (path: string) =>
      `https://explorer.solana.com/${path}${getClusterUrlParam(cluster)}`,
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
// 自定义Context Hook
export function useCluster() {
  return useContext(Context);
}
// 主要目的是生成一个 URL 参数字符串，用于指定 Solana Explorer 或其他 Solana 工具应该使用哪个网络集群
function getClusterUrlParam(cluster: Cluster): string {
  let suffix = "";
  switch (cluster.network) {
    case ClusterNetwork.Devnet:
      suffix = "devnet";
      break;
    case ClusterNetwork.Mainnet:
      suffix = "";
      break;
    case ClusterNetwork.Testnet:
      suffix = "testnet";
      break;
    default:
      suffix = `custom&customUrl=${encodeURIComponent(cluster.endpoint)}`;
      break;
  }
  // https://explorer.solana.com/tx/[transaction_id]?cluster=devnet
  return suffix.length ? `?cluster=${suffix}` : "";
}
