import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { SystemIcon } from "../icons/SystemIcon";

type SearchBarProps = {
  query: string;
  onQueryChange: (query: string) => void;
};

export function SearchBar({ query, onQueryChange }: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);
  const isActive = isFocused || Boolean(query);

  return (
    <div className="search-row">
      <motion.div
        className={`search-field ${isActive ? "search-field--active" : ""}`}
        layout
        transition={{ type: "spring", bounce: 0.18, duration: 0.38 }}
      >
        <input
          aria-label="Buscar serviço"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onBlur={() => setIsFocused(false)}
          onFocus={() => setIsFocused(true)}
          placeholder="Buscar serviço"
          type="search"
        />
        <AnimatePresence mode="popLayout" initial={false}>
          {query ? (
            <motion.button
              className="search-clear"
              key="clear"
              type="button"
              aria-label="Limpar busca"
              onClick={() => onQueryChange("")}
              initial={{ opacity: 0, scale: 0.72, filter: "blur(4px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.72, filter: "blur(4px)" }}
              transition={{ duration: 0.11 }}
              whileTap={{ scale: 0.9 }}
            >
              <SystemIcon name="dismiss" />
            </motion.button>
          ) : (
            <motion.span
              className="search-icon"
              key="search"
              aria-hidden="true"
              initial={{ opacity: 0, scale: 0.72, filter: "blur(4px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.72, filter: "blur(4px)" }}
              transition={{ duration: 0.11 }}
            >
              <SystemIcon name="search" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
