import type { FieldTier, ValueKind } from "./types";

export interface FieldDefinition {
  key: string;
  label: string;
  group: string;
  tier: FieldTier;
  valueKind: ValueKind;
  question: string;
  rationale: string;
}

export const KETTLE_FIELDS: readonly FieldDefinition[] = [
  {
    key: "product-name",
    label: "Product name",
    group: "Identity and Responsibility",
    tier: "essential",
    valueKind: "scalar",
    question:
      "What is the product's name as it appears on the product or its packaging?",
    rationale: "Identifies the product unambiguously in the dossier and the eventual manual.",
  },
  {
    key: "model-identifier",
    label: "Model identifier",
    group: "Identity and Responsibility",
    tier: "essential",
    valueKind: "scalar",
    question: "What model or item identifier does the supplier assign?",
    rationale: "Distinguishes this product from variants in the same line.",
  },
  {
    key: "manufacturer-or-supplier",
    label: "Manufacturer or supplier",
    group: "Identity and Responsibility",
    tier: "essential",
    valueKind: "scalar",
    question: "Who manufactures or supplies the product?",
    rationale: "Names the party responsible for the source documents.",
  },
  {
    key: "importer-contact",
    label: "Importer or responsible-party contact",
    group: "Identity and Responsibility",
    tier: "essential",
    valueKind: "prose",
    question:
      "Who is the importer or responsible party in the market, and how can they be reached?",
    rationale:
      "The importer's own information; the supplier usually does not know it.",
  },
  {
    key: "rated-voltage",
    label: "Rated voltage",
    group: "Electrical and Physical Information",
    tier: "essential",
    valueKind: "scalar",
    question: "What is the rated voltage?",
    rationale: "Electrical safety and operating-condition baseline.",
  },
  {
    key: "rated-frequency",
    label: "Rated frequency",
    group: "Electrical and Physical Information",
    tier: "essential",
    valueKind: "scalar",
    question: "What is the rated frequency?",
    rationale: "Electrical operating-condition baseline.",
  },
  {
    key: "rated-power",
    label: "Rated power",
    group: "Electrical and Physical Information",
    tier: "essential",
    valueKind: "scalar",
    question: "What is the rated power consumption?",
    rationale: "Electrical load and circuit-sizing baseline.",
  },
  {
    key: "capacity",
    label: "Capacity",
    group: "Electrical and Physical Information",
    tier: "essential",
    valueKind: "scalar",
    question: "What is the product's capacity?",
    rationale: "Primary physical specification for a kettle.",
  },
  {
    key: "primary-materials",
    label: "Primary materials",
    group: "Electrical and Physical Information",
    tier: "supporting",
    valueKind: "list",
    question: "What materials is the product primarily made of?",
    rationale: "Supports care, safety, and allergen context.",
  },
  {
    key: "included-components",
    label: "Included components",
    group: "Use, Safety, and Maintenance",
    tier: "supporting",
    valueKind: "list",
    question: "What components are included with the product?",
    rationale: "Confirms what the user receives versus buys separately.",
  },
  {
    key: "intended-use",
    label: "Intended use",
    group: "Use, Safety, and Maintenance",
    tier: "essential",
    valueKind: "prose",
    question: "What is the product's intended use?",
    rationale: "Frames the operating and safety instructions.",
  },
  {
    key: "core-operating-steps",
    label: "Core operating steps",
    group: "Use, Safety, and Maintenance",
    tier: "supporting",
    valueKind: "list",
    question: "What are the core steps to operate the product?",
    rationale: "Backbone of the operating instructions.",
  },
  {
    key: "automatic-shutoff",
    label: "Automatic shut-off or boil-dry protection",
    group: "Use, Safety, and Maintenance",
    tier: "supporting",
    valueKind: "prose",
    question: "Does the product have automatic shut-off or boil-dry protection?",
    rationale:
      "Key safety feature; absence is reported as missing, not as not applicable.",
  },
  {
    key: "cleaning-restrictions",
    label: "Cleaning and descaling restrictions",
    group: "Use, Safety, and Maintenance",
    tier: "supporting",
    valueKind: "prose",
    question: "What cleaning and descaling restrictions apply?",
    rationale: "Maintenance safety and longevity.",
  },
  {
    key: "disposal-information",
    label: "Disposal information",
    group: "Use, Safety, and Maintenance",
    tier: "supporting",
    valueKind: "prose",
    question: "What disposal information is provided?",
    rationale: "End-of-life and regulatory context.",
  },
] as const;

export function essentialKeys(): string[] {
  return KETTLE_FIELDS.filter((field) => field.tier === "essential").map(
    (field) => field.key,
  );
}
