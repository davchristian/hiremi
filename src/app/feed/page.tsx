import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";
import { listSources } from "@/lib/job-sources";
import { matchListings } from "@/lib/feed";
import { toClientProfile, toClientSource } from "@/lib/types";
import { Feed } from "@/components/Feed";
import { Header } from "@/components/Header";

export default async function FeedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in?redirect=/feed");
  }

  const profile = await getProfile(user.id);
  const [matches, sources] = await Promise.all([
    matchListings(user.id, profile, { limit: 40, hideTracked: true }),
    listSources(user.id),
  ]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-base">
      <Header email={user.email ?? ""} />
      <Feed
        initialMatches={matches}
        initialProfile={profile ? toClientProfile(profile) : null}
        initialSources={sources.map(toClientSource)}
        initialRanked={Boolean(profile?.embedding)}
      />
    </div>
  );
}
