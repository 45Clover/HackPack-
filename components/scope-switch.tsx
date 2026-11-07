"use client";
import { usePathname, useRouter } from "next/navigation";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Scope } from "@/lib/scope";

// The area switch: [your city | Canada] plus a city picker. State lives in the URL, so links can be shared.
export function ScopeSwitch({ scope, cities }: { scope: Scope; cities: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const go = (kind: string, city: string) => router.push(`${pathname}?${new URLSearchParams({ scope: kind, city })}`);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ToggleGroup aria-label="Area" value={[scope.kind]} onValueChange={(v) => v[0] && go(String(v[0]), scope.city)}>
        <ToggleGroupItem value="city">{scope.city}</ToggleGroupItem>
        <ToggleGroupItem value="canada">All of Canada</ToggleGroupItem>
      </ToggleGroup>
      {cities.length > 1 && (
        <Select value={scope.city} onValueChange={(c) => c && go("city", String(c))}>
          <SelectTrigger aria-label="Change city" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {cities.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
