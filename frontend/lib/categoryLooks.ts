import { useMemo } from "react";

import { useCategories } from "@/lib/api/queries";
import type { Look } from "@/lib/categoryStyle";

/**
 * The look the person gave each category (ADR D-64), as a lookup by name. It reads the cached
 * category list, so every tile on the page follows a change made on the Categories page. Until the
 * list has loaded, or if it fails, every category simply has its default look.
 */
export function useCategoryLooks(): (category: string) => Look | undefined {
  const { data } = useCategories();
  return useMemo(() => {
    const looks = new Map<string, Look>(
      (data?.categories ?? []).map((c) => [
        c.name.trim().toLowerCase(),
        { icon: c.icon, colour: c.colour },
      ]),
    );
    return (category) => looks.get(category.trim().toLowerCase());
  }, [data]);
}
