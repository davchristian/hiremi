import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";
import { isEmbeddingConfigured } from "@/lib/embeddings";
import { toClientProfile } from "@/lib/types";
import { ProfileSettings } from "@/components/profile/ProfileSettings";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?redirect=/profile");

  const profile = await getProfile(user.id);
  return <ProfileSettings initialProfile={profile ? toClientProfile(profile) : null} matchingAvailable={isEmbeddingConfigured()} />;
}
