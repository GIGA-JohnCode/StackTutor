import type { ProficiencyLevel } from "../types/domain";

export type PrerequisiteOutput = {
  prerequisites: Array<{
    name: string;
    proficiency: ProficiencyLevel;
    context: string;
  }>;
};

export type DecomposeOutput = {
  steps: Array<{
    name: string;
    objective: string;
  }>;
};

export const PREREQUISITE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["prerequisites"],
  properties: {
    prerequisites: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "proficiency", "context"],
        properties: {
          name: { type: "string" },
          proficiency: {
            type: "string",
            enum: ["beginner", "intermediate", "advanced", "expert"],
          },
          context: { type: "string" },
        },
      },
    },
  },
} as const;

export const DECOMPOSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["steps"],
  properties: {
    steps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "objective"],
        properties: {
          name: { type: "string" },
          objective: { type: "string" },
        },
      },
    },
  },
} as const;
