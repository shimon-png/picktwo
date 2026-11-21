import type { ZipCheck } from "@/lib/use-zip";

/** Line under a ZIP input: the error, or the place the ZIP belongs to once it checks out. */
export function ZipHint({ check }: { check: ZipCheck }) {
  if (check.state === "bad") return <p className="mt-1 text-xs text-b">{check.message}</p>;
  if (check.state === "ok" && (check.city || check.region))
    return <p className="mt-1 text-xs text-zinc-500">✓ {[check.city, check.region].filter(Boolean).join(", ")}</p>;
  return null;
}
