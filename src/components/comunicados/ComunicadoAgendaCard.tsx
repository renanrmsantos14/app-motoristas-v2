import { AgendaCard } from "../services/AgendaCard";
import { COMUNICADO_TIPO, isComunicadoPending, type ComunicadoDestinatario } from "../../lib/comunicados";

type Props = {
  item: ComunicadoDestinatario;
  onOpen: (id: string) => void;
};

export function ComunicadoAgendaCard({ item, onOpen }: Props) {
  const pending = isComunicadoPending(item);
  const unread = !item.abertoEm && !item.lidoEm && !item.cienteEm;
  const typeLabel = pending
    ? item.tipo === COMUNICADO_TIPO.ciencia ? "ASSINATURA OBRIGATÓRIA" : "INFORMATIVO"
    : item.cienteEm ? "CIÊNCIA ASSINADA" : "CIÊNCIA REGISTRADA";
  const label = unread ? `NOVO · ${typeLabel}` : typeLabel;

  return (
    <div className="agenda-layout-item comunicado-service-item" data-comunicado-unread={unread ? "true" : undefined}>
      <AgendaCard
        item={{
          id: item.id,
          tipo: "SERVICO",
          time: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(item.enviadoEm)).replace(",", ""),
          label,
          description: item.titulo
        }}
        bodyLabel="Comunicado"
        onOpen={() => onOpen(item.id)}
      />
    </div>
  );
}
