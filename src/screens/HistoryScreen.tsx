import { useAgendaSearch } from "../hooks/useAgendaSearch";
import type { AgendaItem, DetailData } from "../types";
import { AgendaCard } from "../components/services/AgendaCard";
import { AppShell } from "../components/layout/AppShell";
import { ServicesMenu } from "../components/navigation/ServicesMenu";
import { SearchBar } from "../components/services/SearchBar";

type HistoryScreenProps = {
  items: AgendaItem[];
  onHome: () => void;
  onRefresh: () => void;
  onOpenDetails: (detail: DetailData) => void;
};

export function HistoryScreen({ items, onHome, onRefresh, onOpenDetails }: HistoryScreenProps) {
  const { query, setQuery, filteredAgenda } = useAgendaSearch(items);

  return (
    <AppShell screenLabel="TelaHistórico">
      <ServicesMenu title="HISTÓRICO de Serviços" onHome={onHome} onRefresh={() => { setQuery(""); onRefresh(); }} />
      <section className="main-panel services-main history-main">
        <SearchBar query={query} onQueryChange={setQuery} />
        <div className="agenda-list">
          {filteredAgenda.length > 0 ? (
            filteredAgenda.map((item: AgendaItem, index) => (
              <AgendaCard
                key={item.id}
                item={item}
                index={index}
                onOpen={(agendaItem) => agendaItem.detail && onOpenDetails(agendaItem.detail)}
              />
            ))
          ) : (
            <div className="history-empty">Nenhum serviço disponível no seu histórico.</div>
          )}
        </div>
      </section>
    </AppShell>
  );
}
