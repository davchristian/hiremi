import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";
import { listSources } from "@/lib/job-sources";
import { matchListings } from "@/lib/feed";
import { Discover } from "@/components/discover/Discover";

export const metadata: Metadata = { title: "Discover" };

export default async function DiscoverPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?redirect=/feed");

  const profile = await getProfile(user.id);
  const [matches, sources] = await Promise.all([
    matchListings(user.id, profile, { limit: 100, sort: "priority" }),
    listSources(user.id),
  ]);

  return (
    <Discover
      initialMatches={matches}
      ranked={Boolean(profile?.embedding)}
      hasProfile={Boolean(profile)}
      sourceCount={sources.filter((source) => source.enabled).length}
    />
  );
}
