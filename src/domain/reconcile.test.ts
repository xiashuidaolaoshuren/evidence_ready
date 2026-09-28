import { describe, expect, it } from "vitest";
import { KETTLE_FIELDS } from "./fields";
import { reconcileCandidates, type VerifiedCandidate } from "./reconcile";
import type { DossierField, Evidence, RejectedCandidate } from "./types";

function verified(
  fieldKey: string,
  value: unknown,
  citation: Partial<Evidence> & Pick<Evidence, "quote">,
): VerifiedCandidate {
  return {
    fieldKey,
    value,
    citation: {
      documentId: citation.documentId ?? "doc-1",
      page: citation.page ?? 1,
      quote: citation.quote,
      surroundingWindow: citation.surroundingWindow ?? `...${citation.quote}...`,
    },
  };
}

function fieldOf(dossier: DossierField[], key: string): DossierField {
  const field = dossier.find((item) => item.key === key);
  expect(field).toBeDefined();
  return field!;
}

function rejected(
  fieldKey: string,
  value: unknown,
  quote: string,
  rejectionReason = "quote not on page",
): RejectedCandidate {
  return {
    fieldKey,
    value,
    citation: { documentId: "doc-x", page: 9, quote },
    rejectionReason,
  };
}

describe("reconcileCandidates missing", () => {
  it("returns a 15-field dossier with status missing when there are 0 candidates", () => {
    const dossier = reconcileCandidates({
      evidence: [],
      rejected: [],
      fields: KETTLE_FIELDS,
    });

    expect(dossier).toHaveLength(15);
    dossier.forEach((field, index) => {
      const def = KETTLE_FIELDS[index]!;
      expect(field.key).toBe(def.key);
      expect(field.label).toBe(def.label);
      expect(field.group).toBe(def.group);
      expect(field.tier).toBe(def.tier);
      expect(field.valueKind).toBe(def.valueKind);
      expect(field.status).toBe("missing");
      expect(field.originalValue).toBeNull();
      expect(field.normalizedValue).toBeNull();
      expect(field.markers).toEqual([]);
      expect(field.evidence).toEqual([]);
      expect(field.rejectedCandidates).toEqual([]);
      expect(field.resolutionHistory).toEqual([]);
    });
  });
});

describe("reconcileCandidates scalar", () => {
  it("confirms a scalar field with 1 verified candidate and its evidence", () => {
    const candidate = verified("rated-voltage", "230V", {
      quote: "Rated voltage: 230V",
      documentId: "spec-a",
      page: 2,
    });
    const dossier = reconcileCandidates({
      evidence: [candidate],
      rejected: [],
      fields: KETTLE_FIELDS,
    });

    expect(dossier).toHaveLength(15);
    const voltage = fieldOf(dossier, "rated-voltage");
    expect(voltage.status).toBe("confirmed");
    expect(voltage.originalValue).toBe("230V");
    expect(voltage.normalizedValue).toBe("230 V");
    expect(voltage.evidence).toEqual([candidate.citation]);
    expect(voltage.rejectedCandidates).toEqual([]);
    expect(fieldOf(dossier, "product-name").status).toBe("missing");
  });

  it("marks a scalar field conflicting when 2 verified values differ after normalize", () => {
    const first = verified("capacity", "1.5 L", {
      quote: "Capacity 1.5 L",
      documentId: "doc-a",
    });
    const second = verified("capacity", "1.7 L", {
      quote: "Capacity 1.7 L",
      documentId: "doc-b",
      page: 3,
    });
    const dossier = reconcileCandidates({
      evidence: [first, second],
      rejected: [],
      fields: KETTLE_FIELDS,
    });

    const capacity = fieldOf(dossier, "capacity");
    expect(capacity.status).toBe("conflicting");
    expect(capacity.originalValue).toEqual(["1.5 L", "1.7 L"]);
    expect(capacity.normalizedValue).toEqual(["1.5 L", "1.7 L"]);
    expect(capacity.evidence).toEqual([first.citation, second.citation]);
    expect(capacity.conflictCandidates).toEqual([
      {
        value: "1.5 L",
        normalizedValue: "1.5 L",
        citation: first.citation,
        source: "document",
      },
      {
        value: "1.7 L",
        normalizedValue: "1.7 L",
        citation: second.citation,
        source: "document",
      },
    ]);
    expect(capacity.adjudicatedLosers).toEqual([]);
  });

  it("confirms a scalar field when 2 verified values share a normalized form, merging evidence", () => {
    const kilowatt = verified("rated-power", "2.2 kW", {
      quote: "2.2 kW",
      documentId: "doc-a",
    });
    const watt = verified("rated-power", "2200 W", {
      quote: "2200 W",
      documentId: "doc-b",
      page: 4,
    });
    const dossier = reconcileCandidates({
      evidence: [kilowatt, watt],
      rejected: [],
      fields: KETTLE_FIELDS,
    });

    const power = fieldOf(dossier, "rated-power");
    expect(power.status).toBe("confirmed");
    expect(power.originalValue).toBe("2.2 kW");
    expect(power.normalizedValue).toBe("2200 W");
    expect(power.evidence).toEqual([kilowatt.citation, watt.citation]);
  });

  it("confirms a scalar field when values differ only by case, keeping first casing and all evidence", () => {
    const first = verified("manufacturer-or-supplier", "Acme Appliances Ltd.", {
      quote: "Manufacturer: Acme Appliances Ltd.",
      documentId: "ARK-1500_supplier-specification",
      page: 1,
    });
    const second = verified("manufacturer-or-supplier", "ACME APPLIANCES LTD.", {
      quote: "ACME APPLIANCES LTD.",
      documentId: "ARK-1500_supplier-specification",
      page: 1,
    });
    const dossier = reconcileCandidates({
      evidence: [first, second],
      rejected: [],
      fields: KETTLE_FIELDS,
    });

    const manufacturer = fieldOf(dossier, "manufacturer-or-supplier");
    expect(manufacturer.status).toBe("confirmed");
    expect(manufacturer.originalValue).toBe("Acme Appliances Ltd.");
    expect(manufacturer.normalizedValue).toBe("Acme Appliances Ltd.");
    expect(manufacturer.evidence).toEqual([first.citation, second.citation]);
    expect(manufacturer.conflictCandidates).toEqual([]);
  });
});

describe("reconcileCandidates list", () => {
  it("confirms a list field as the union of items with evidence retained", () => {
    const first = verified("primary-materials", ["stainless steel", "plastic"], {
      quote: "stainless steel body",
      documentId: "doc-a",
    });
    const second = verified("primary-materials", ["  plastic  ", "glass"], {
      quote: "plastic and glass",
      documentId: "doc-b",
      page: 2,
    });
    const dossier = reconcileCandidates({
      evidence: [first, second],
      rejected: [],
      fields: KETTLE_FIELDS,
    });

    const materials = fieldOf(dossier, "primary-materials");
    expect(materials.status).toBe("confirmed");
    expect(materials.normalizedValue).toEqual([
      "stainless steel",
      "plastic",
      "glass",
    ]);
    expect(materials.evidence).toEqual([first.citation, second.citation]);
  });
});

describe("reconcileCandidates prose", () => {
  it("confirms a prose field from the first verified source and keeps other evidence as alternates", () => {
    const first = verified("intended-use", "  Boil   water  ", {
      quote: "intended to boil water",
      documentId: "doc-a",
    });
    const second = verified("intended-use", "Heats water for tea", {
      quote: "for tea",
      documentId: "doc-b",
      page: 5,
    });
    const dossier = reconcileCandidates({
      evidence: [first, second],
      rejected: [],
      fields: KETTLE_FIELDS,
    });

    const intended = fieldOf(dossier, "intended-use");
    expect(intended.status).toBe("confirmed");
    expect(intended.originalValue).toBe("  Boil   water  ");
    expect(intended.normalizedValue).toBe("Boil water");
    expect(intended.evidence).toEqual([first.citation, second.citation]);
  });
});

describe("reconcileCandidates unverified", () => {
  it("marks a field unverified when only rejected candidates exist and retains them", () => {
    const only = rejected("product-name", "  Speedy Boil  ", "Speedy Boil");
    const dossier = reconcileCandidates({
      evidence: [],
      rejected: [only],
      fields: KETTLE_FIELDS,
    });

    const name = fieldOf(dossier, "product-name");
    expect(name.status).toBe("unverified");
    expect(name.originalValue).toBe("  Speedy Boil  ");
    expect(name.normalizedValue).toBe("Speedy Boil");
    expect(name.evidence).toEqual([]);
    expect(name.rejectedCandidates).toEqual([only]);
  });

  it("retains rejected candidates when a field also has verified evidence", () => {
    const confirmed = verified("rated-power", "1850 W", {
      quote: "Rated power: 1850 W",
      documentId: "doc-a",
    });
    const dropped = rejected("rated-power", "2200 W", "2200 W");
    const dossier = reconcileCandidates({
      evidence: [confirmed],
      rejected: [dropped],
      fields: KETTLE_FIELDS,
    });

    const power = fieldOf(dossier, "rated-power");
    expect(power.status).toBe("confirmed");
    expect(power.originalValue).toBe("1850 W");
    expect(power.rejectedCandidates).toEqual([dropped]);
  });
});
