import { redirect } from "next/navigation";
import { AppShell } from "@/components/ledger/app-shell";
import { LedgerProvider } from "@/components/ledger/ledger-context";
import { RoleGate } from "@/components/role-gate";
import { getSession } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/");

  return (
    <RoleGate>
      <LedgerProvider>
        <AppShell userEmail={session.email}>{children}</AppShell>
      </LedgerProvider>
    </RoleGate>
  );
}
