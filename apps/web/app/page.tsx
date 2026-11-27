"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { ErrorCard } from "@/components/ErrorCard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { QrPanel } from "@/components/desktop/QrPanel";
import { UploadZone } from "@/components/desktop/UploadZone";
import { uploadModel, type ModelUploaded } from "@/lib/api";
import { handlePhoneMessage, onPhoneConnected, resetPose } from "@/lib/motion";
import { errorScreen } from "@/lib/errors";
import { useConnection } from "@/lib/store";
import { startNewSession, useDesktopSession } from "@/lib/useDesktopSession";
import { usePivotSocket } from "@/lib/usePivotSocket";

const Scene = dynamic(() => import("@/components/viewer/Scene"), { ssr: false });

const SAMPLE = "/samples/pivot-block.glb";

export default function DesktopPage() {
  const { session, error } = useDesktopSession();
  const [uploaded, setUploaded] = useState<ModelUploaded | null>(null);
  const [sampleError, setSampleError] = useState<string | null>(null);

  usePivotSocket({
    sessionId: session?.sessionId ?? "",
    role: "desktop",
    token: session?.desktopToken ?? "",
    enabled: !!session,
    onMessage: (msg) => {
      if (msg.t === "q" || msg.t === "recenter" || msg.t === "mode") handlePhoneMessage(msg);
    },
  });
  const phoneConnected = useConnection((s) => s.peerConnected);
  const socketStatus = useConnection((s) => s.status);
  const socketError = useConnection((s) => s.error);
  const fatal = socketStatus === "failed" ? errorScreen(socketError) : null;

  useEffect(() => {
    if (phoneConnected) onPhoneConnected();
  }, [phoneConnected]);

  const model =
    uploaded ??
    (session?.initial?.modelUrl
      ? { modelUrl: session.initial.modelUrl, modelName: session.initial.modelName ?? "model" }
      : null);

  const modelUrl = model?.modelUrl;
  useEffect(() => resetPose(), [modelUrl]);

  const useSample = useCallback(async () => {
    if (!session) return;
    setSampleError(null);
    try {
      const blob = await (await fetch(SAMPLE)).blob();
      const file = new File([blob], "pivot-block.glb", { type: "model/gltf-binary" });
      setUploaded(await uploadModel(session.sessionId, session.desktopToken, file, () => {}));
    } catch (e) {
      setSampleError((e as Error).message);
    }
  }, [session]);

  return (
    <main className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-4 px-6 py-4">
        <h1 className="shrink-0">
          {/* Finalized wordmark lockup (docs/brand); the dark variant has a white wordmark. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/pivot-logo.png" alt="Pivot" className="h-10 w-auto dark:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/pivot-logo-dark.png"
            alt="Pivot"
            className="hidden h-10 w-auto dark:block"
          />
        </h1>
        <div className="flex min-w-0 items-center gap-4">
          {model && <span className="truncate text-sm text-fg/60">{model.modelName}</span>}
          <ThemeToggle />
        </div>
      </header>

      <section className="relative flex-1">
        {fatal && (
          <div className="absolute inset-0 z-10 bg-bg/95">
            <ErrorCard
              screen={{
                ...fatal,
                body: "Start a new session and scan the new QR code with your phone.",
              }}
              actionLabel="Start a new session"
              onAction={startNewSession}
            />
          </div>
        )}
        {socketStatus === "reconnecting" && (
          <div className="absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-full bg-warn/15 px-4 py-1.5 text-sm text-warn">
            Reconnecting to server…
          </div>
        )}
        {error && <Centered className="text-danger">{error}</Centered>}
        {!error && !session && <Centered className="text-fg/50">Starting session…</Centered>}

        {session && !model && (
          <Centered>
            <div className="w-full max-w-lg space-y-4 text-center">
              <UploadZone
                sessionId={session.sessionId}
                token={session.desktopToken}
                onUploaded={setUploaded}
              />
              <button
                onClick={useSample}
                className="text-sm text-accent underline-offset-4 hover:underline"
              >
                or try the sample model
              </button>
              {sampleError && <p className="text-sm text-danger">{sampleError}</p>}
            </div>
          </Centered>
        )}

        {session && model && (
          <>
            <div className="absolute inset-0">
              <Scene url={model.modelUrl} orbit={!phoneConnected} />
            </div>
            <div className="absolute right-6 top-2">
              <QrPanel pairUrl={session.pairUrl} />
            </div>
            <div className="absolute bottom-6 left-6 w-64">
              <UploadZone
                compact
                sessionId={session.sessionId}
                token={session.desktopToken}
                onUploaded={setUploaded}
              />
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function Centered({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`absolute inset-0 flex items-center justify-center p-6 ${className}`}>
      {children}
    </div>
  );
}
