import { ListSkeleton } from "@/components/shell/ListSkeleton";

export default function SourcesLoading() {
  return <ListSkeleton title="Sources" rows={8} />;
}
