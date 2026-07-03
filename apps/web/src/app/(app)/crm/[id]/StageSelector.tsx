"use client";

import { useTransition } from "react";
import { PIPELINE_STAGE } from "@/lib/taxonomy";
import { setPipelineStage } from "../actions";

export default function StageSelector({
  projectId,
  current,
}: {
  projectId: string;
  current: string | null;
}) {
  const [isPending, start] = useTransition();

  return (
    <select
      defaultValue={current ?? ""}
      disabled={isPending}
      className="input text-xs py-0.5 w-full"
      onChange={(e) => {
        const stage = e.target.value;
        if (stage) start(() => setPipelineStage(projectId, stage));
      }}
    >
      <option value="" disabled>
        — stage —
      </option>
      {PIPELINE_STAGE.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
