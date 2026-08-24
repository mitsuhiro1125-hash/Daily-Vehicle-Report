import Link from "next/link";

export default function PageHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between mb-6 pt-6">
      <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
      <Link href="/" className="text-brand-600 font-bold text-base underline underline-offset-4">
        トップへ戻る
      </Link>
    </div>
  );
}
