"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getClientLedger, type Ledger } from "@/lib/ledger";
import { Toast } from "@/components/toast";
import {
  getRoleSession,
  type SessionRole,
} from "@/lib/role-session";

type ToastState = { msg: string; isError: boolean; id: number };

type LedgerContextValue = {
  ledger: Ledger;
  actingActorId: string;
  sessionRole: SessionRole;
  selectedLotId: string | null;
  setSelectedLotId: (id: string | null) => void;
  preferredTraceLotId: string | null;
  lotCode: (lotId: string) => string;
  assignCodes: () => void;
  refresh: () => void;
  version: number;
  toast: (msg: string, isError?: boolean) => void;
};

const LedgerContext = createContext<LedgerContextValue | null>(null);

export function LedgerProvider({
  children,
  userName = "",
  companyName = "",
}: {
  children: ReactNode;
  userName?: string;
  companyName?: string;
}) {
  const boot = useMemo(() => getClientLedger(), []);
  const roleSession = useMemo(() => getRoleSession(), []);

  const resolved = useMemo(() => {
    if (!roleSession) return null;
    const match = [...boot.ledger.actors.values()].find(
      (a) =>
        a.actorType === roleSession.role &&
        a.legalIdentityRef === roleSession.legalIdentityRef,
    );
    return match ?? null;
  }, [boot.ledger, roleSession]);

  const initialActorId = resolved?.actorId ?? boot.actingActorId;
  const [actingActorId, setActingActorIdState] = useState(initialActorId);
  const [sessionRole] = useState<SessionRole>(roleSession?.role ?? "exporter");
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [toastState, setToastState] = useState<ToastState | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (resolved) setActingActorIdState(resolved.actorId);
  }, [resolved]);

  // Exporter identity = logged-in person (name) on the single rich seed profile.
  const applyExporterIdentity = useCallback(() => {
    const exporters = [...boot.ledger.actors.values()].filter(
      (a) => a.actorType === "exporter",
    );
    const exporter = exporters[0];
    if (!exporter) return;
    if (userName.trim()) {
      exporter.displayName = userName.trim();
      exporter.metadata.contactPerson = userName.trim();
    }
    if (companyName.trim()) {
      exporter.metadata.companyName = companyName.trim();
    }
  }, [boot.ledger, userName, companyName]);

  applyExporterIdentity();

  useEffect(() => {
    applyExporterIdentity();
    setVersion((v) => v + 1);
  }, [applyExporterIdentity]);

  const refresh = useCallback(() => {
    boot.assignCodes();
    setVersion((v) => v + 1);
  }, [boot]);

  const toast = useCallback((msg: string, isError = false) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastState({ msg, isError, id: Date.now() });
    setToastVisible(true);
    toastTimer.current = setTimeout(() => setToastVisible(false), 3400);
  }, []);

  const value = useMemo<LedgerContextValue>(
    () => ({
      ledger: boot.ledger,
      actingActorId,
      sessionRole,
      selectedLotId,
      setSelectedLotId,
      preferredTraceLotId: boot.preferredTraceLotId,
      lotCode: boot.lotCode,
      assignCodes: boot.assignCodes,
      refresh,
      version,
      toast,
    }),
    [
      boot.ledger,
      boot.lotCode,
      boot.assignCodes,
      boot.preferredTraceLotId,
      actingActorId,
      sessionRole,
      selectedLotId,
      refresh,
      version,
      toast,
    ],
  );

  return (
    <LedgerContext.Provider value={value}>
      {children}
      <Toast
        message={toastState?.msg ?? null}
        isError={toastState?.isError}
        visible={toastVisible}
      />
    </LedgerContext.Provider>
  );
}

export function useLedger(): LedgerContextValue {
  const ctx = useContext(LedgerContext);
  if (!ctx) throw new Error("useLedger must be used within LedgerProvider");
  return ctx;
}
