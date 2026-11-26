import type { ErrorCode } from "@pivot/protocol";

export interface ErrorScreen {
  title: string;
  body: string;
  /** What the user can do about it. */
  action: "rescan" | "reload" | "none";
}

const SCREENS: Record<ErrorCode | "no_sensor" | "motion_denied", ErrorScreen> = {
  session_expired: {
    title: "Session expired",
    body: "This pairing link is no longer valid. Reload Pivot on the computer and scan the new QR code.",
    action: "rescan",
  },
  already_paired: {
    title: "Already paired",
    body: "Another phone is controlling this model. Disconnect it first, or open Pivot again on the computer for a new code.",
    action: "rescan",
  },
  bad_token: {
    title: "Invalid link",
    body: "This link is incomplete or was changed. Scan the QR code on the computer again.",
    action: "rescan",
  },
  bad_role: {
    title: "Invalid link",
    body: "Scan the QR code on the computer again.",
    action: "rescan",
  },
  invalid_message: {
    title: "Something went wrong",
    body: "The connection sent unexpected data. Reload the page.",
    action: "reload",
  },
  rate_limited: {
    title: "Too many messages",
    body: "Reload the page to reconnect.",
    action: "reload",
  },
  no_sensor: {
    title: "No motion sensor",
    body: "This device has no motion sensor, so it cannot rotate the model. Try another phone.",
    action: "none",
  },
  motion_denied: {
    title: "Motion access denied",
    body: "Allow motion and orientation access for this site (Safari: aA menu › Website Settings), then reload.",
    action: "reload",
  },
};

export function errorScreen(code: keyof typeof SCREENS | null | undefined): ErrorScreen | null {
  return code ? (SCREENS[code] ?? null) : null;
}

/** Human status line for the phone and desktop status pills. */
export function statusText(status: string, peer: boolean, rtt: number | null): string {
  if (status === "connecting") return "Connecting…";
  if (status === "reconnecting") return "Reconnecting…";
  if (status === "failed" || status === "closed") return "Disconnected";
  if (!peer) return "Waiting for the computer…";
  return rtt === null ? "Connected" : `Connected · ${rtt} ms`;
}
