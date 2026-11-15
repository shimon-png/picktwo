import { readFile } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const DOCS = ["terms", "privacy", "guidelines"] as const;

function inline(s: string) {
  const parts = s.split(/(\*\*[^*]+\*\*|_[^_]+_)/g);
  return parts.map((p, i) =>
    p.startsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : p.startsWith("_") && p.endsWith("_") ? <em key={i}>{p.slice(1, -1)}</em> : p,
  );
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  if (!(DOCS as readonly string[]).includes(doc)) notFound();
  const md = await readFile(path.join(process.cwd(), "content/legal", `${doc}.md`), "utf8");
  const blocks = md.split(/\n\n+/);
  return (
    <article className="space-y-4">
      <div className="rounded-xl bg-pp-soft p-3 text-sm font-semibold text-amber-900">Draft — pending legal review</div>
      {blocks.map((b, i) => {
        if (b.startsWith("# ")) return <h1 key={i} className="font-display text-3xl font-extrabold">{b.slice(2)}</h1>;
        if (b.startsWith("## ")) return <h2 key={i} className="pt-2 text-xl font-bold">{b.slice(3)}</h2>;
        if (b.startsWith("- "))
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {b.split("\n").map((l, j) => <li key={j}>{inline(l.replace(/^- /, ""))}</li>)}
            </ul>
          );
        return <p key={i} className="text-zinc-700 dark:text-zinc-300">{inline(b)}</p>;
      })}
    </article>
  );
}
