import Link from "next/link";

export default function Home() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">Fantasy Cricket App</h1>
      <nav className="space-y-4">
        <Link href="/my-team" className="block text-blue-500 hover:underline">
          My Team
        </Link>
        <Link href="/transfer-market" className="block text-blue-500 hover:underline">
          Transfer Market
        </Link>
        <Link href="/points" className="block text-blue-500 hover:underline">
          Points
        </Link>
      </nav>
    </div>
  );
}
