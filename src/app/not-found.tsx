import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card mx-auto mt-10 max-w-sm space-y-3 p-6 text-center">
      <div className="text-4xl">🤷</div>
      <h1 className="font-display text-xl font-extrabold">Not found</h1>
      <p className="text-zinc-600">This battle may have been deleted or never existed.</p>
      <Link href="/vote" className="btn-primary">Vote on something else</Link>
    </div>
  );
}
