import { ListSkeleton } from "@/components/shell/ListSkeleton";

export default function ProfileLoading() {
  return <ListSkeleton title="Profile" rows={5} />;
}
