"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card mx-auto mt-10 max-w-sm space-y-3 p-6 text-center">
      <div className="text-4xl">😵</div>
      <h1 className=" text-xl font-medium">Something went wrong</h1>
      <button className="btn-primary" onClick={reset}>Try again</button>
    </div>
  );
}
