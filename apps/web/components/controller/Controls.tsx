"use client";

import type { Mode } from "@pivot/protocol";

interface Props {
  mode: Mode;
  onRecenter: () => void;
  onModeChange: (mode: Mode) => void;
}

export function Controls({ mode, onRecenter, onModeChange }: Props) {
  const tilt = mode === "tilt";
  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <button
        data-testid="recenter"
        onClick={onRecenter}
        className="rounded-2xl bg-sky-500 py-6 text-xl font-semibold text-white active:bg-sky-600"
      >
        Recenter
      </button>
      <label className="flex items-center justify-between rounded-2xl bg-white/5 px-5 py-4">
        <span>
          <span className="block font-medium">Tilt only</span>
          <span className="block text-xs text-white/50">Ignore turning left and right</span>
        </span>
        <input
          data-testid="tilt-only"
          type="checkbox"
          role="switch"
          checked={tilt}
          onChange={(e) => onModeChange(e.target.checked ? "tilt" : "full")}
          className="h-6 w-6 accent-sky-500"
        />
      </label>
    </div>
  );
}
