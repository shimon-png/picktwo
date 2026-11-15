"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function MarkRead() {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => {
      fetch("/api/notifications/read", { method: "POST" }).then(() => router.refresh());
    }, 1500);
    return () => clearTimeout(t);
  }, [router]);
  return null;
}
