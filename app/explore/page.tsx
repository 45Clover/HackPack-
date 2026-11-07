import { PublicMap } from "@/components/public-map";

export default async function Explore({ searchParams }: PageProps<"/explore">) {
  return <PublicMap searchParams={await searchParams} />;
}
