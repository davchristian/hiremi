import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { Pipeline } from "@/components/pipeline/Pipeline";
import { Sources } from "@/components/sources/Sources";
import { ProfileSettings } from "@/components/profile/ProfileSettings";
import { PreviewDiscover } from "@/app/preview/PreviewDiscover";
import { readTheme } from "@/lib/theme-server";
import { PREVIEW_JOBS, PREVIEW_OVERVIEW, PREVIEW_PROFILE, PREVIEW_SOURCES } from "@/app/preview/fixtures";

const SCREENS: Record<string, { path: string; render: () => React.ReactNode | Promise<React.ReactNode> }> = {
  discover: { path: "/feed", render: () => <PreviewDiscover /> },
  pipeline: { path: "/board", render: () => <Pipeline initialJobs={PREVIEW_JOBS} /> },
  "pipeline-empty": { path: "/board", render: () => <Pipeline initialJobs={[]} /> },
  sources: { path: "/sources", render: () => <Sources initialSources={PREVIEW_SOURCES} overview={PREVIEW_OVERVIEW} /> },
  profile: {
    path: "/profile",
    render: async () => <ProfileSettings initialProfile={PREVIEW_PROFILE} matchingAvailable={false} initialTheme={await readTheme()} />,
  },
};

export default async function PreviewPage({ params }: { params: Promise<{ screen: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { screen } = await params;
  const entry = SCREENS[screen];
  if (!entry) notFound();

  return (
    <AppShell email="preview@example.com" activePath={entry.path}>
      {await entry.render()}
    </AppShell>
  );
}
