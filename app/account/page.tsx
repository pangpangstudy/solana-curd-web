import AccountListFeature from "@/components/account/account-list-feature";

export default function Page() {
  // 显示一些账户信息  如果钱包已经链接  就重定向到动态页 没有就显示连接按钮
  return <AccountListFeature />;
}
