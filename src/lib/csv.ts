import type { ClientJob } from "@/lib/types";

const HEADERS = [
  "id",
  "company",
  "role",
  "stage",
  "applied_date",
  "link",
  "notes",
  "created_at",
  "updated_at",
] as const;

function escapeField(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function jobsToCsv(jobs: ClientJob[]): string {
  const rows = jobs.map((job) =>
    [
      job.id,
      job.company,
      job.role,
      job.stage,
      job.appliedDate?.slice(0, 10) ?? "",
      job.link ?? "",
      job.notes,
      job.createdAt,
      job.updatedAt,
    ]
      .map(escapeField)
      .join(","),
  );
  return [HEADERS.join(","), ...rows].join("\n");
}
