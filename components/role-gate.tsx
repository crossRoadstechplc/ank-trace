"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getRoleSession } from "@/lib/role-session";
import { LoadingScreen } from "@/components/spinner";

/** Client gate: dashboard routes require a session role. */
export function RoleGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const session = getRoleSession();
    if (!session) {
      router.replace("/select-role");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return <LoadingScreen message="Loading workspace…" />;
  }

  return <>{children}</>;
}
