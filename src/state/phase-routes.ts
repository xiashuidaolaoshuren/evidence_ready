import type { AppAction, AppPhase } from "@/state/app-state";

export type HistoryMove =
  | { kind: "stay" }
  | { kind: "replace"; href: string }
  | { kind: "dispatch"; action: AppAction };

export function routeForPhase(phase: AppPhase): string {
  switch (phase) {
    case "intake":
      return "/";
    case "extracting":
    case "extracted":
      return "/extract";
    case "insufficient":
      return "/insufficient";
    case "interview":
      return "/interview";
    case "report":
      return "/report";
  }
}

export function historyMove(phase: AppPhase, pathname: string): HistoryMove {
  if (pathname === routeForPhase(phase)) {
    return { kind: "stay" };
  }
  if (phase === "report" && pathname === "/interview") {
    return { kind: "dispatch", action: { type: "open-interview" } };
  }
  if (phase === "interview" && pathname === "/report") {
    return { kind: "dispatch", action: { type: "finish" } };
  }
  return { kind: "replace", href: routeForPhase(phase) };
}
