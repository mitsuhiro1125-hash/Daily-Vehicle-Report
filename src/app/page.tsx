import Link from "next/link";

// トップ画面：各機能への入口をまとめたメニュー画面
export default function HomePage() {
  const menuItems = [
    {
      href: "/nippo",
      label: "日報を入力する",
      desc: "毎日の車両利用を入力します",
      color: "bg-brand-600",
    },
    {
      href: "/geppo",
      label: "月報を見る",
      desc: "月ごとの一覧確認・CSV出力",
      color: "bg-emerald-600",
    },
    {
      href: "/vehicles",
      label: "車両管理",
      desc: "車両の登録・編集・削除",
      color: "bg-slate-600",
    },
    {
      href: "/drivers",
      label: "運転者管理",
      desc: "運転者の登録・編集・削除",
      color: "bg-slate-600",
    },
  ];

  return (
    <main className="flex-1 flex flex-col justify-center px-6 py-10">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          車両月報作成アプリ
        </h1>
        <p className="text-gray-500 text-base">
          毎日の入力から、月報の確認・出力までこの1つで完結します
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`${item.color} text-white rounded-2xl shadow-md p-6 flex flex-col gap-1 active:scale-[0.98] transition`}
          >
            <span className="text-xl font-bold">{item.label}</span>
            <span className="text-sm opacity-90">{item.desc}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
