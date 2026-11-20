import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const DOCS = ["terms", "privacy", "guidelines"] as const;

function inline(s: string) {
  const parts = s.split(/(\*\*[^*]+\*\*|_[^_]+_|\[[^\]]+\]\(\/[^)\s]*\))/g);
  return parts.map((p, i) => {
    const link = /^\[([^\]]+)\]\((\/[^)\s]*)\)$/.exec(p);
    if (link)
      return (
        <Link key={i} href={link[2]} className="font-medium text-accent underline">
          {link[1]}
        </Link>
      );
    return p.startsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : p.startsWith("_") && p.endsWith("_") ? <em key={i}>{p.slice(1, -1)}</em> : p;
  });
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  if (!(DOCS as readonly string[]).includes(doc)) notFound();
  const md = await readFile(path.join(process.cwd(), "content/legal", `${doc}.md`), "utf8");
  // A heading line followed directly by text (no blank line) becomes two blocks.
  const blocks = md
    .trim()
    .split(/\n\n+/)
    .flatMap((b) => (/^#{1,2} /.test(b) && b.includes("\n") ? [b.slice(0, b.indexOf("\n")), b.slice(b.indexOf("\n") + 1)] : [b]));
  return (
    <article className="space-y-4">
      <div className="rounded-xl bg-pp-soft p-3 text-sm font-medium text-amber-900">Draft — pending legal review</div>
      {blocks.map((b, i) => {
        if (b.startsWith("# ")) return <h1 key={i} className=" text-3xl font-medium">{b.slice(2)}</h1>;
        if (b.startsWith("## ")) return <h2 key={i} className="pt-2 text-xl font-medium">{b.slice(3)}</h2>;
        if (b.startsWith("- "))
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {b.split("\n").map((l, j) => <li key={j}>{inline(l.replace(/^- /, ""))}</li>)}
            </ul>
          );
        return <p key={i} className="text-zinc-700">{inline(b)}</p>;
      })}
    </article>
  );
}
