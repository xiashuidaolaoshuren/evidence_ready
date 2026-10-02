import { describe, expect, it } from "vitest";
import { essentialKeys, KETTLE_FIELDS } from "./fields";

const GROUPS = [
  "Identity and Responsibility",
  "Electrical and Physical Information",
  "Use, Safety, and Maintenance",
] as const;

const EXPECTED_FIELDS = [
  {
    key: "product-name",
    label: "Product name",
    group: "Identity and Responsibility",
    tier: "essential",
    valueKind: "scalar",
  },
  {
    key: "model-identifier",
    label: "Model identifier",
    group: "Identity and Responsibility",
    tier: "essential",
    valueKind: "scalar",
  },
  {
    key: "manufacturer-or-supplier",
    label: "Manufacturer or supplier",
    group: "Identity and Responsibility",
    tier: "essential",
    valueKind: "scalar",
  },
  {
    key: "importer-contact",
    label: "Importer or responsible-party contact",
    group: "Identity and Responsibility",
    tier: "essential",
    valueKind: "prose",
  },
  {
    key: "rated-voltage",
    label: "Rated voltage",
    group: "Electrical and Physical Information",
    tier: "essential",
    valueKind: "scalar",
  },
  {
    key: "rated-frequency",
    label: "Rated frequency",
    group: "Electrical and Physical Information",
    tier: "essential",
    valueKind: "scalar",
  },
  {
    key: "rated-power",
    label: "Rated power",
    group: "Electrical and Physical Information",
    tier: "essential",
    valueKind: "scalar",
  },
  {
    key: "capacity",
    label: "Capacity",
    group: "Electrical and Physical Information",
    tier: "essential",
    valueKind: "scalar",
  },
  {
    key: "primary-materials",
    label: "Primary materials",
    group: "Electrical and Physical Information",
    tier: "supporting",
    valueKind: "list",
  },
  {
    key: "included-components",
    label: "Included components",
    group: "Use, Safety, and Maintenance",
    tier: "supporting",
    valueKind: "list",
  },
  {
    key: "intended-use",
    label: "Intended use",
    group: "Use, Safety, and Maintenance",
    tier: "essential",
    valueKind: "prose",
  },
  {
    key: "core-operating-steps",
    label: "Core operating steps",
    group: "Use, Safety, and Maintenance",
    tier: "supporting",
    valueKind: "list",
  },
  {
    key: "automatic-shutoff",
    label: "Automatic shut-off or boil-dry protection",
    group: "Use, Safety, and Maintenance",
    tier: "supporting",
    valueKind: "prose",
  },
  {
    key: "cleaning-restrictions",
    label: "Cleaning and descaling restrictions",
    group: "Use, Safety, and Maintenance",
    tier: "supporting",
    valueKind: "prose",
  },
  {
    key: "disposal-information",
    label: "Disposal information",
    group: "Use, Safety, and Maintenance",
    tier: "supporting",
    valueKind: "prose",
  },
] as const;

describe("KETTLE_FIELDS", () => {
  it("exposes exactly 15 fields in declaration order", () => {
    expect(KETTLE_FIELDS).toHaveLength(15);
    EXPECTED_FIELDS.forEach((expected, index) => {
      const field = KETTLE_FIELDS[index];
      expect(field?.key).toBe(expected.key);
      expect(field?.label).toBe(expected.label);
      expect(field?.group).toBe(expected.group);
      expect(field?.tier).toBe(expected.tier);
      expect(field?.valueKind).toBe(expected.valueKind);
    });
  });

  it("uses unique stable keys", () => {
    const keys = KETTLE_FIELDS.map((field) => field.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("uses the three spec groups only", () => {
    const groups = new Set(KETTLE_FIELDS.map((field) => field.group));
    expect([...groups]).toEqual([...GROUPS]);
  });

  it("provides question and rationale for every field", () => {
    for (const field of KETTLE_FIELDS) {
      expect(field.question.length).toBeGreaterThan(0);
      expect(field.rationale.length).toBeGreaterThan(0);
    }
  });
});

describe("essentialKeys", () => {
  it("returns the 9 essential keys in declaration order", () => {
    expect(essentialKeys()).toEqual([
      "product-name",
      "model-identifier",
      "manufacturer-or-supplier",
      "importer-contact",
      "rated-voltage",
      "rated-frequency",
      "rated-power",
      "capacity",
      "intended-use",
    ]);
  });
});
