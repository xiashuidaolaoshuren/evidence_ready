import { describe, expect, it } from "vitest";
import { appReducer, initialAppState } from "@/app-state";
import type { DossierField } from "@/domain/types";
import { historyMove, routeForPhase } from "./phase-routes";

function emptyField(key: string): DossierField {
  return {
    key,
    label: key,
    group: "Identity and Responsibility",
    tier: "essential",
    valueKind: "scalar",
    status: "missing",
    originalValue: null,
    normalizedValue: null,
    markers: [],
    evidence: [],
    rejectedCandidates: [],
    conflictCandidates: [],
    adjudicatedLosers: [],
    resolutionHistory: [],
  };
}

describe("routeForPhase", () => {
  it("maps each phase to its route", () => {
    expect(routeForPhase("intake")).toBe("/");
    expect(routeForPhase("extracting")).toBe("/extract");
    expect(routeForPhase("extracted")).toBe("/extract");
    expect(routeForPhase("insufficient")).toBe("/insufficient");
    expect(routeForPhase("interview")).toBe("/interview");
    expect(routeForPhase("report")).toBe("/report");
  });
});

describe("historyMove replace", () => {
  it("replaces the URL when the pathname does not match the phase route", () => {
    expect(historyMove("interview", "/extract")).toEqual({
      kind: "replace",
      href: "/interview",
    });
    expect(historyMove("intake", "/report")).toEqual({
      kind: "replace",
      href: "/",
    });
  });
});

describe("historyMove stay", () => {
  it("returns stay when the pathname matches the phase route", () => {
    expect(historyMove("interview", "/interview")).toEqual({ kind: "stay" });
    expect(historyMove("extracted", "/extract")).toEqual({ kind: "stay" });
    expect(historyMove("intake", "/")).toEqual({ kind: "stay" });
  });
});

describe("historyMove dispatch", () => {
  it("dispatches open-interview when report phase sees /interview", () => {
    expect(historyMove("report", "/interview")).toEqual({
      kind: "dispatch",
      action: { type: "open-interview" },
    });
  });

  it("dispatches finish when interview phase sees /report", () => {
    expect(historyMove("interview", "/report")).toEqual({
      kind: "dispatch",
      action: { type: "finish" },
    });
  });

  it("keeps applied answers and an existing completionReason after finish", () => {
    const interviewing = {
      ...initialAppState,
      phase: "interview" as const,
      dossier: [
        {
          ...emptyField("capacity"),
          status: "user-provided" as const,
          originalValue: "1.7 L",
          normalizedValue: "1.7 L",
          markers: ["user-provided"],
        },
      ],
      interview: {
        ...initialAppState.interview,
        phase: "interview" as const,
        completionReason: "essentials-clear",
        answeredFieldKeys: ["capacity"],
      },
    };

    const move = historyMove("interview", "/report");
    expect(move.kind).toBe("dispatch");
    if (move.kind !== "dispatch") {
      throw new Error("expected dispatch");
    }

    const next = appReducer(interviewing, move.action);
    expect(next.dossier[0]?.status).toBe("user-provided");
    expect(next.interview.completionReason).toBe("essentials-clear");
  });
});
