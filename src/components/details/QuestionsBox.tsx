import { buildWhatsAppUrl } from "../../lib/localWorkflow";

const juniorPhone = "+55 (12) 99723-6961";

export function QuestionsBox() {
  const contactJunior = () => {
    window.open(buildWhatsAppUrl(juniorPhone, "Olá Júnior, preciso de ajuda com uma manutenção."), "_blank", "noopener,noreferrer");
  };

  return (
    <div className="questions-row">
      <div className="questions-box">
        <div className="questions-label">Dúvidas?</div>
        <button className="questions-link" onClick={contactJunior}>Contatar o Júnior</button>
      </div>
    </div>
  );
}
