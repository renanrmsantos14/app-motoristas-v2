import {
  forwardRef,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from "react";

export type SearchableSelectOption = {
  value: string;
  label: string;
  subtitle?: string;
  searchText?: string;
  disabled?: boolean;
};

type SearchableSelectProps = {
  value: string;
  options: SearchableSelectOption[];
  placeholder: string;
  disabled?: boolean;
  invalid?: boolean;
  ariaLabel?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  maxVisible?: number;
  className?: string;
  renderOption?: (option: SearchableSelectOption) => ReactNode;
  filterOption?: (option: SearchableSelectOption, normalizedQuery: string) => boolean;
  onChange: (value: string) => void;
};

function normalizeSearchableValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export const SearchableSelect = forwardRef<HTMLButtonElement, SearchableSelectProps>(function SearchableSelect({
  value,
  options,
  placeholder,
  disabled = false,
  invalid = false,
  ariaLabel,
  searchPlaceholder = "Pesquisar",
  emptyLabel = "Nenhuma opcao encontrada.",
  maxVisible = 80,
  className = "",
  renderOption,
  filterOption,
  onChange
}, ref) {
  const listboxId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const [openDirection, setOpenDirection] = useState<"down" | "up">("down");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const setTriggerRef = (node: HTMLButtonElement | null) => {
    triggerRef.current = node;
    if (typeof ref === "function") {
      ref(node);
    } else if (ref) {
      ref.current = node;
    }
  };

  const dedupedOptions = useMemo(() => {
    const seen = new Set<string>();
    return options.filter((option) => {
      const key = normalizeSearchableValue(`${option.value} ${option.label}`);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [options]);

  const selectedOption = useMemo(
    () => dedupedOptions.find((option) => option.value === value),
    [dedupedOptions, value]
  );

  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalizeSearchableValue(query);
    const matches = dedupedOptions.filter((option) => {
      if (!normalizedQuery) return true;
      if (filterOption) return filterOption(option, normalizedQuery);
      const text = normalizeSearchableValue(`${option.label} ${option.subtitle ?? ""} ${option.searchText ?? ""}`);
      return text.includes(normalizedQuery);
    });
    return matches.slice(0, maxVisible);
  }, [dedupedOptions, filterOption, maxVisible, query]);

  const updatePanelPosition = () => {
    const trigger = triggerRef.current;
    const container = containerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewportHeight = Math.max(120, window.innerHeight || document.documentElement.clientHeight || 120);
    const preferredHeight = Math.min(282, Math.floor(viewportHeight * 0.46));
    const spaceBelow = Math.max(0, viewportHeight - rect.bottom - 8);
    const spaceAbove = Math.max(0, rect.top - 8);
    const showBelow = spaceBelow >= spaceAbove;
    const availableHeight = Math.max(140, Math.min(preferredHeight, showBelow ? spaceBelow : spaceAbove));
    setOpenDirection(showBelow ? "down" : "up");
    setPanelStyle({
      width: container ? Math.ceil(container.getBoundingClientRect().width) : "100%",
      maxHeight: availableHeight
    });
  };

  const closePanel = () => {
    setIsOpen(false);
    setFocusedIndex(-1);
    setQuery("");
  };

  const openPanel = (focusSearch = true) => {
    if (disabled) return;
    setIsOpen(true);
    setQuery("");
    const selectedIndex = dedupedOptions.findIndex((option) => option.value === value);
    setFocusedIndex(selectedIndex >= 0 ? selectedIndex : 0);
    window.setTimeout(() => {
      updatePanelPosition();
      if (focusSearch) searchRef.current?.focus();
    }, 0);
  };

  const selectOption = (option: SearchableSelectOption) => {
    if (option.disabled) return;
    onChange(option.value);
    closePanel();
    triggerRef.current?.focus();
  };

  const moveFocusedOption = (step: 1 | -1) => {
    if (!filteredOptions.length) return;
    setFocusedIndex((current) => {
      const max = filteredOptions.length - 1;
      if (current < 0) return step > 0 ? 0 : max;
      const next = current + step;
      if (next < 0) return max;
      if (next > max) return 0;
      return next;
    });
  };

  useLayoutEffect(() => {
    if (isOpen) updatePanelPosition();
  }, [isOpen, query, filteredOptions.length]);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) closePanel();
    };
    const handleLayout = () => updatePanelPosition();
    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", handleLayout);
    window.addEventListener("scroll", handleLayout, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", handleLayout);
      window.removeEventListener("scroll", handleLayout, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (!filteredOptions.length) {
      setFocusedIndex(-1);
      return;
    }
    if (focusedIndex < 0 || focusedIndex >= filteredOptions.length) setFocusedIndex(0);
  }, [filteredOptions.length, focusedIndex, isOpen]);

  const displayValue = selectedOption?.label || value || placeholder;

  return (
    <div ref={containerRef} className={`searchable-select ${isOpen ? "is-open" : ""} ${invalid ? "is-invalid" : ""} ${openDirection === "up" ? "is-open-up" : "is-open-down"} ${className}`}>
      <button
        ref={setTriggerRef}
        type="button"
        className={`searchable-select-trigger ${!value ? "is-placeholder" : ""}`}
        aria-label={ariaLabel}
        aria-invalid={invalid}
        aria-expanded={isOpen}
        aria-controls={listboxId}
        disabled={disabled}
        onClick={() => (isOpen ? closePanel() : openPanel())}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
            event.preventDefault();
            openPanel(event.key !== "ArrowDown");
            if (event.key === "ArrowDown") moveFocusedOption(1);
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            openPanel(false);
            moveFocusedOption(-1);
          }
          if (event.key === "Escape") {
            event.preventDefault();
            closePanel();
          }
        }}
      >
        <span className="searchable-select-value">{displayValue}</span>
        {value ? (
          <span
            role="button"
            tabIndex={-1}
            className="searchable-select-clear"
            aria-label="Limpar selecao"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onChange("");
            }}
          >
            x
          </span>
        ) : null}
        <span className="searchable-select-caret" aria-hidden="true" />
      </button>
      {isOpen ? (
        <div ref={panelRef} className="searchable-select-panel" style={panelStyle} role="presentation">
          <input
            ref={searchRef}
            className="searchable-select-search"
            value={query}
            autoComplete="off"
            spellCheck={false}
            placeholder={searchPlaceholder}
            aria-label="Pesquisar opcao"
            onChange={(event) => {
              setQuery(event.target.value);
              setFocusedIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                moveFocusedOption(1);
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                moveFocusedOption(-1);
              }
              if (event.key === "Enter") {
                const option = filteredOptions[focusedIndex] ?? filteredOptions[0];
                if (option) {
                  event.preventDefault();
                  selectOption(option);
                }
              }
              if (event.key === "Escape") {
                event.preventDefault();
                closePanel();
              }
              if (event.key === "Tab") closePanel();
            }}
          />
          <div id={listboxId} className="searchable-select-options" role="listbox">
            {filteredOptions.length ? (
              filteredOptions.map((option, index) => {
                const isSelected = option.value === value;
                const isFocused = index === focusedIndex;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    className={`searchable-select-option ${isSelected || isFocused ? "is-active" : ""}`}
                    aria-selected={isSelected}
                    disabled={option.disabled}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setFocusedIndex(index)}
                    onClick={() => selectOption(option)}
                  >
                    {renderOption ? renderOption(option) : (
                      <>
                        <span>{option.label}</span>
                        {option.subtitle ? <small>{option.subtitle}</small> : null}
                      </>
                    )}
                  </button>
                );
              })
            ) : (
              <div className="searchable-select-empty">{emptyLabel}</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
});
