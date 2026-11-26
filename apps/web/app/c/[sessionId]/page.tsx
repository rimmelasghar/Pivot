"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Controller } from "@/components/controller/Controller";

function ControllerPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const token = useSearchParams().get("t");

  if (!token) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        This link is incomplete. Scan the QR code on the desktop again.
      </div>
    );
  }
  return <Controller sessionId={sessionId} pairToken={token} />;
}

export default function Page() {
  return (
    <main className="h-dvh select-none overflow-hidden">
      <Suspense>
        <ControllerPage />
      </Suspense>
    </main>
  );
}
