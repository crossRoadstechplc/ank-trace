import { redirect } from "next/navigation";
import { AppShell } from "@/components/ledger/app-shell";
import { LedgerProvider } from "@/components/ledger/ledger-context";
import { RoleGate } from "@/components/role-gate";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/");

  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  const userName = user?.name || session.name || "";
  const companyName = user?.companyName || session.companyName || "";
  const contact = user?.email || user?.phone || session.email;

  return (
    <RoleGate>
      <LedgerProvider>
        <AppShell
          userName={userName}
          companyName={companyName}
          userContact={contact}
        >
          {children}
        </AppShell>
      </LedgerProvider>
    </RoleGate>
  );
}
