import { useMemo, useState } from "react";
import type { AgendaItem } from "../types";

export function useAgendaSearch(items: AgendaItem[]) {
  const [query, setQuery] = useState("");

  const filteredAgenda = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;

    return items.filter((item) => {
      if (item.tipo === "HEADER") return false;

      return `${item.searchText ?? ""} ${item.label ?? ""} ${item.time ?? ""} ${item.description ?? ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [items, query]);

  return { query, setQuery, filteredAgenda };
}
