import {
  JOB_STATUS,
  PIPELINE_STAGE,
  CONSTRUCTION_PHASE,
  WARRANTY_PHASE,
  DIVISION,
} from "@/lib/taxonomy";

// Shared between the Jobs board UI and its server actions.
export const GROUP_AXES = {
  pipelineStage: PIPELINE_STAGE,
  constructionPhase: CONSTRUCTION_PHASE,
  warrantyPhase: WARRANTY_PHASE,
  division: DIVISION,
  status: JOB_STATUS,
} as const;
export type GroupAxis = keyof typeof GROUP_AXES;

export const AXIS_LABELS: Record<GroupAxis, string> = {
  pipelineStage: "Sales Pipeline",
  constructionPhase: "Construction Phase",
  warrantyPhase: "Warranty Phase",
  division: "Division",
  status: "Status",
};

export type JobViewDTO = {
  id: string;
  name: string;
  ownerId: string | null;
  groupBy: GroupAxis;
  filters: { status?: string[] } | null;
  sortOrder: number;
};

export type BoardJob = {
  id: string;
  name: string;
  code: string | null;
  clientName: string;
  status: string;
  pipelineStage: string | null;
  constructionPhase: string | null;
  warrantyPhase: string | null;
  division: string | null;
};

export const isAxis = (v: string): v is GroupAxis => v in GROUP_AXES;
