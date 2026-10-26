import type { Job, JobSource, JobStageEvent, Profile } from "@/db/schema";
import type { JobSourceKind } from "@/lib/source-meta";
import type { Stage } from "@/lib/stage";

export type ClientJob = {
  id: string;
  company: string;
  role: string;
  stage: Stage;
  appliedDate: string | null;
  followUpDate: string | null;
  link: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type ClientProfile = {
  targetRoles: string[];
  skills: string[];
  experienceLevel: Profile["experienceLevel"];
  locationPreference: string;
  workMode: Profile["workMode"];
  blurb: string;
  singaporePassConfirmed: boolean;
  hasEmbedding: boolean;
};

export type ClientSource = {
  id: string;
  kind: JobSourceKind;
  slug: string;
  label: string;
  isDefault: boolean;
  lastFetchedAt: string | null;
  lastError: string | null;
};

const PENDING_ID_PREFIX = "pending-";

export function pendingJobId(): string {
  return `${PENDING_ID_PREFIX}${Math.random().toString(36).slice(2)}`;
}

export function isPendingJob(job: Pick<ClientJob, "id">): boolean {
  return job.id.startsWith(PENDING_ID_PREFIX);
}

export function toClientProfile(profile: Profile): ClientProfile {
  return {
    targetRoles: profile.targetRoles,
    skills: profile.skills,
    experienceLevel: profile.experienceLevel,
    locationPreference: profile.locationPreference ?? "",
    workMode: profile.workMode,
    blurb: profile.blurb ?? "",
    singaporePassConfirmed: profile.singaporePassConfirmed,
    hasEmbedding: Boolean(profile.embedding),
  };
}

export function toClientSource(source: JobSource): ClientSource {
  return {
    id: source.id,
    kind: source.kind,
    slug: source.slug,
    label: source.label,
    isDefault: source.userId === null,
    lastFetchedAt: source.lastFetchedAt ? source.lastFetchedAt.toISOString() : null,
    lastError: source.lastError,
  };
}

export function toClientJob(job: Job): ClientJob {
  return {
    id: job.id,
    company: job.company,
    role: job.role,
    stage: job.stage,
    appliedDate: job.appliedDate ? job.appliedDate.toISOString() : null,
    followUpDate: job.followUpDate ? job.followUpDate.toISOString() : null,
    link: job.link,
    notes: job.notes ?? "",
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

export type ClientStageEvent = {
  id: string;
  fromStage: Stage | null;
  toStage: Stage;
  createdAt: string;
};

export function toClientStageEvent(event: JobStageEvent): ClientStageEvent {
  return {
    id: event.id,
    fromStage: event.fromStage,
    toStage: event.toStage,
    createdAt: event.createdAt.toISOString(),
  };
}
