"use client";

import { useCallback, useRef, useState } from "react";
import { checkFile, uploadModel, type ModelUploaded } from "@/lib/api";

interface Props {
  sessionId: string;
  token: string;
  compact?: boolean;
  onUploaded: (model: ModelUploaded) => void;
}

export function UploadZone({ sessionId, token, compact, onUploaded }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      const problem = checkFile(file);
      if (problem) return setError(problem);
      setError(null);
      setProgress(0);
      try {
        onUploaded(await uploadModel(sessionId, token, file, setProgress));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setProgress(null);
      }
    },
    [sessionId, token, onUploaded],
  );

  const busy = progress !== null;
  return (
    <div
      data-testid="upload-zone"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void upload(e.dataTransfer.files[0]);
      }}
      onClick={() => !busy && input.current?.click()}
      className={[
        "cursor-pointer rounded-2xl border-2 border-dashed text-center transition-colors",
        compact ? "px-4 py-3 text-sm" : "px-10 py-16",
        dragging ? "border-sky-400 bg-sky-400/10" : "border-white/20 hover:border-white/40",
      ].join(" ")}
    >
      <input
        ref={input}
        type="file"
        accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
        className="hidden"
        onChange={(e) => {
          void upload(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {busy ? (
        <div className="space-y-2">
          <p>Uploading… {Math.round(progress * 100)}%</p>
          <div className="mx-auto h-1.5 w-48 overflow-hidden rounded bg-white/10">
            <div className="h-full bg-sky-400" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
      ) : (
        <>
          <p className={compact ? "" : "text-lg font-medium"}>
            {compact ? "Drop another model or click" : "Drop a .glb or .gltf file here"}
          </p>
          {!compact && <p className="mt-1 text-sm text-white/50">or click to choose · max 50 MB</p>}
        </>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
