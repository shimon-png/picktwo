import Link from "next/link";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`font-display text-xl font-extrabold tracking-tight ${className}`} aria-label="PickTwo home">
      <span className="text-a">Pick</span>
      <span className="text-b">Two</span>
    </Link>
  );
}
