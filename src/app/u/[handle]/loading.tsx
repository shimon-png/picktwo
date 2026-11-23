/** Shown the moment someone taps a name or avatar, while the profile loads. Same shapes as the real page. */
function Bar({ className }: { className: string }) {
  return <span className={`block rounded-full bg-ink/10 ${className}`} />;
}

export default function ProfileLoading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading profile">
      <header className="flex items-start gap-4">
        <span className="size-16 shrink-0 rounded-full bg-ink/10" />
        <div className="flex-1 space-y-2.5 pt-1">
          <Bar className="h-6 w-40" />
          <Bar className="h-3 w-28" />
          <Bar className="h-3 w-44" />
          <Bar className="mt-3 h-8 w-24" />
        </div>
      </header>

      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card space-y-2 p-3">
            <Bar className="mx-auto h-6 w-10" />
            <Bar className="mx-auto h-2.5 w-14" />
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <Bar className="h-6 w-24" />
        {[0, 1, 2].map((i) => (
          <span key={i} className="block h-20 rounded-2xl bg-ink/5" />
        ))}
      </section>
    </div>
  );
}
