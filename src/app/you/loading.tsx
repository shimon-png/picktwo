/**
 * Shown the moment someone taps the avatar, while the You page loads its data.
 * Same shapes as the real page so nothing jumps when it swaps in.
 */
function Bar({ className }: { className: string }) {
  return <span className={`block rounded-full bg-ink/10 ${className}`} />;
}

export default function YouLoading() {
  return (
    <div className="animate-pulse space-y-7" aria-busy="true" aria-label="Loading your profile">
      <header className="flex items-center gap-4 pt-1">
        <span className="size-16 shrink-0 rounded-full bg-ink/10" />
        <div className="flex-1 space-y-2.5">
          <Bar className="h-7 w-40" />
          <Bar className="h-3 w-24" />
          <Bar className="h-3 w-48" />
        </div>
      </header>

      <section className="card space-y-4 px-4 py-5">
        <Bar className="h-10 w-36" />
        <div className="grid grid-cols-3 gap-1.5">
          <Bar className="h-1.5" />
          <Bar className="h-1.5" />
          <Bar className="h-1.5" />
        </div>
        <Bar className="h-3 w-3/4" />
      </section>

      <section className="space-y-2.5">
        <Bar className="h-6 w-28" />
        {[0, 1, 2].map((i) => (
          <span key={i} className="block h-11 rounded-lg bg-ink/5" />
        ))}
      </section>

      <section className="space-y-3">
        <Bar className="h-6 w-36" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="size-9 rounded-md bg-ink/10" />
            <span className="size-9 rounded-md bg-ink/10" />
            <div className="flex-1 space-y-2">
              <Bar className="h-3 w-4/5" />
              <Bar className="h-2.5 w-1/2" />
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
