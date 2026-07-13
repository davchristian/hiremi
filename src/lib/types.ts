import type { Job } from "@/db/schema";
import type { Stage } from "@/lib/stage";

export type ClientJob = {
  id: string;
  company: string;
  role: string;
  stage: Stage;
  appliedDate: string | null;
  link: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export function toClientJob(job: Job): ClientJob {
  return {
    id: job.id,
    company: job.company,
    role: job.role,
    stage: job.stage,
    appliedDate: job.appliedDate ? job.appliedDate.toISOString() : null,
    link: job.link,
    notes: job.notes ?? "",
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}
