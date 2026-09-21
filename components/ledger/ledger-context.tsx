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
import {
  fetchLedgerSnapshot,
  type LedgerApiResponse,
} from "@/lib/ledger/api-client";
import {
  installClientLedger,
  peekClientLedger,
  type Ledger,
} from "@/lib/ledger";
import type { BootstrapResult } from "@/lib/ledger/seed";
import { Toast } from "@/components/toast";
import { LoadingScreen } from "@/components/spinner";
import {
  getRoleSession,
  type SessionRole,
} from "@/lib/role-session";

type ToastState = { msg: string; isError: boolean; id: number };

type LedgerContextValue = {
  ledger: Ledger;
  actingActorId: string;
  sessionRole: SessionRole;
  userName: string;
  companyName: string;
  /** Login name for the acting profile (dashboard / self labels). */
  actingDisplayName: string;
  selectedLotId: string | null;
  setSelectedLotId: (id: string | null) => void;
  preferredTraceLotId: string | null;
  lotCode: (lotId: string) => string;
  assignCodes: () => void;
  /** Re-fetch from DB, or apply a mutation response snapshot. */
  refresh: (from?: LedgerApiResponse) => Promise<void>;
  version: number;
  toast: (msg: string, isError?: boolean) => void;
  onboardOpen: boolean;
  setOnboardOpen: (open: boolean) => void;
  /** After onboard, network expands/opens this actor. */
  networkFocusActorId: string | null;
  focusNetworkActor: (actorId: string | null) => void;
  ready: boolean;
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
  const [boot, setBoot] = useState<BootstrapResult | null>(() => peekClientLedger());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ready, setReady] = useState(() => !!peekClientLedger());
  const roleSession = useMemo(() => getRoleSession(), []);

  const resolved = useMemo(() => {
    if (!roleSession || !boot) return null;
    const match = [...boot.ledger.actors.values()].find(
      (a) =>
        a.actorType === roleSession.role &&
        a.legalIdentityRef === roleSession.legalIdentityRef,
    );
    return match ?? null;
  }, [boot, roleSession]);

  const [actingActorId, setActingActorIdState] = useState(
    () => resolved?.actorId ?? boot?.actingActorId ?? "",
  );
  const [sessionRole] = useState<SessionRole>(roleSession?.role ?? "exporter");
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [toastState, setToastState] = useState<ToastState | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [networkFocusActorId, setNetworkFocusActorId] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyBoot = useCallback((next: BootstrapResult) => {
    setBoot(next);
    setReady(true);
    setVersion((v) => v + 1);
  }, []);

  const refresh = useCallback(
    async (from?: LedgerApiResponse) => {
      const payload = from ?? (await fetchLedgerSnapshot());
      const next = installClientLedger(payload.snapshot);
      applyBoot(next);
    },
    [applyBoot],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const payload = await fetchLedgerSnapshot();
        if (cancelled) return;
        applyBoot(installClientLedger(payload.snapshot));
        setLoadError(null);
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Failed to load ledger.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyBoot]);

  useEffect(() => {
    if (resolved) setActingActorIdState(resolved.actorId);
    else if (boot?.actingActorId) setActingActorIdState(boot.actingActorId);
  }, [resolved, boot?.actingActorId]);

  // Exporter identity = logged-in person (name) on the single rich seed profile.
  const applyExporterIdentity = useCallback(() => {
    if (!boot) return;
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
  }, [boot, userName, companyName]);

  if (boot) applyExporterIdentity();

  useEffect(() => {
    applyExporterIdentity();
    setVersion((v) => v + 1);
  }, [applyExporterIdentity]);

  const toast = useCallback((msg: string, isError = false) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastState({ msg, isError, id: Date.now() });
    setToastVisible(true);
    toastTimer.current = setTimeout(() => setToastVisible(false), 3400);
  }, []);

  const actingDisplayName = useMemo(() => {
    const login = userName.trim();
    if (login) return login;
    const actor = boot?.ledger.actors.get(actingActorId);
    return actor?.displayName ?? "You";
  }, [userName, boot, actingActorId, version]);

  const focusNetworkActor = useCallback((actorId: string | null) => {
    setNetworkFocusActorId(actorId);
  }, []);

  const value = useMemo<LedgerContextValue | null>(() => {
    if (!boot) return null;
    return {
      ledger: boot.ledger,
      actingActorId,
      sessionRole,
      userName,
      companyName,
      actingDisplayName,
      selectedLotId,
      setSelectedLotId,
      preferredTraceLotId: boot.preferredTraceLotId,
      lotCode: boot.lotCode,
      assignCodes: boot.assignCodes,
      refresh,
      version,
      toast,
      onboardOpen,
      setOnboardOpen,
      networkFocusActorId,
      focusNetworkActor,
      ready,
    };
  }, [
    boot,
    actingActorId,
    sessionRole,
    userName,
    companyName,
    actingDisplayName,
    selectedLotId,
    refresh,
    version,
    toast,
    onboardOpen,
    networkFocusActorId,
    focusNetworkActor,
    ready,
  ]);

  if (!ready || !value) {
    return (
      <LoadingScreen
        message={loadError ?? "Loading network ledger…"}
        className="login-shell"
      />
    );
  }

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
