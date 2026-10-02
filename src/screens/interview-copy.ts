import type { QuestionShape } from "@/domain/planner";

interface InterviewCopy {
  question?: string;
  rationale?: string;
}

const INTERVIEW_COPY: Record<string, Partial<Record<QuestionShape, InterviewCopy>>> =
  {
    capacity: {
      conflict: {
        question: "Which capacity is correct for the ARK-1500?",
        rationale:
          "The specification and the draft manual disagree. The finished manual can state only one capacity, so this conflict must be adjudicated — the model cannot pick a winner.",
      },
    },
    "importer-contact": {
      missing: {
        question:
          "Who is the importer or responsible party for this product?",
        rationale:
          "Neither document names an importer — and a supplier cannot know it, because it is the importing company's own information. Your answer here is authoritative, not a guess.",
      },
    },
    "rated-power": {
      unverified: {
        question:
          "The extraction proposed 2200 W for rated power, but its citation could not be located in the source. Can you confirm or correct it?",
        rationale:
          "Only evidence can confirm a value. An unverified candidate may shape this question, but it can never satisfy readiness on its own.",
      },
    },
    "cleaning-restrictions": {
      missing: {
        question:
          "Are there cleaning or descaling restrictions for the ARK-1500?",
        rationale:
          "The draft manual has no cleaning section. Supporting fields never block readiness, but they enrich the dossier a technical writer receives.",
      },
    },
    "disposal-information": {
      missing: {
        question: "What disposal information should the documentation carry?",
        rationale:
          "Neither document mentions disposal. Supporting fields never block readiness; you can leave this missing.",
      },
    },
  };

export function interviewQuestion(
  fieldKey: string,
  shape: QuestionShape,
  fallback: string,
): string {
  return INTERVIEW_COPY[fieldKey]?.[shape]?.question ?? fallback;
}

export function interviewRationale(
  fieldKey: string,
  shape: QuestionShape,
  fallback: string,
): string {
  return INTERVIEW_COPY[fieldKey]?.[shape]?.rationale ?? fallback;
}
