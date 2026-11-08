// What the drawer shows while the guide's queries run: the guide's rough shape (header, demand chart, side card).
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div role="status" aria-label="Loading the learning guide" className="mx-auto w-full max-w-6xl space-y-8 pt-2 pb-16">
      <div className="flex items-center gap-5">
        <Skeleton className="size-16 rounded-[20px]" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-11 w-64" />
        </div>
      </div>
      <Skeleton className="h-6 w-full max-w-2xl" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-96 rounded-[1.75rem] lg:col-span-2" />
        <Skeleton className="h-96 rounded-[1.75rem]" />
      </div>
    </div>
  );
}
