import { useCallback, useEffect, useRef, useState } from "react";
import { ActionBar, ActionButton, type ActionButtonState } from "../components/common/ActionButton";
import { TextAreaField, TextInputField } from "../components/common/FormFields";
import { AppShell } from "../components/layout/AppShell";
import { FormMenu } from "../components/navigation/FormMenu";
import {
  IDEA_DETAILS_MAX_LENGTH,
  IDEA_TITLE_MAX_LENGTH,
  formatIdeaDate,
  getIdeaStatusOption,
  validateIdeaDraft,
  type Idea,
  type IdeaDraft,
  type IdeaDraftErrors
} from "../lib/ideas";

type IdeasScreenProps = {
  onBack: () => void;
  loadIdeas: () => Promise<Idea[]>;
  createIdea: (draft: IdeaDraft) => Promise<Idea>;
  localNotice?: string;
};

const EMPTY_DRAFT: IdeaDraft = { title: "", details: "" };

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function IdeasScreen({ onBack, loadIdeas, createIdea, localNotice }: IdeasScreenProps) {
  const [draft, setDraft] = useState<IdeaDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<IdeaDraftErrors>({});
  const [submitState, setSubmitState] = useState<ActionButtonState>("idle");
  const [submitError, setSubmitError] = useState("");
  const [notice, setNotice] = useState("");
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const titleRef = useRef<HTMLInputElement | null>(null);
  const detailsRef = useRef<HTMLTextAreaElement | null>(null);
  const isSubmitting = submitState !== "idle";

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      setIdeas(await loadIdeas());
    } catch (error) {
      setLoadError(getErrorMessage(error, "Não foi possível carregar suas ideias. Tente novamente."));
    } finally {
      setLoading(false);
    }
  }, [loadIdeas]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const updateDraft = (updates: Partial<IdeaDraft>) => {
    setDraft((current) => ({ ...current, ...updates }));
    setNotice("");
    setSubmitError("");
    const keys = Object.keys(updates) as (keyof IdeaDraft)[];
    if (keys.some((key) => errors[key])) {
      setErrors((current) => {
        const next = { ...current };
        keys.forEach((key) => delete next[key]);
        return next;
      });
    }
  };

  const submit = async () => {
    if (isSubmitting) return;
    const nextErrors = validateIdeaDraft(draft);
    setErrors(nextErrors);
    if (nextErrors.title) return titleRef.current?.focus();
    if (nextErrors.details) return detailsRef.current?.focus();

    setSubmitState("loading");
    setSubmitError("");
    try {
      const created = await createIdea(draft);
      setIdeas((current) => [created, ...current.filter((idea) => idea.id !== created.id)]);
      setDraft(EMPTY_DRAFT);
      setSubmitState("success");
      setNotice("Ideia enviada. A equipe vai avaliar e você acompanha o status aqui.");
      window.setTimeout(() => setSubmitState("idle"), 1200);
    } catch (error) {
      setSubmitState("idle");
      setSubmitError(getErrorMessage(error, "Não foi possível enviar a ideia. Tente novamente."));
    }
  };

  return (
    <AppShell screenLabel="TelaBoasIdeias">
      <FormMenu title="Boas ideias" onBack={isSubmitting ? undefined : onBack} rightIcon="refresh" rightLabel="Atualizar ideias" onRightClick={loading ? undefined : () => void refresh()} />
      <section className="main-panel ideas-main">
        <article className="finalize-card ideas-card">
          <div className="finalize-scroll">
            <div className="finalize-form ideas-form">
              <p className="ideas-intro">Viu algo que pode melhorar no dia a dia? Conte para a equipe.</p>
              {localNotice ? <div className="ideas-feedback ideas-feedback--info" role="status">{localNotice}</div> : null}

              <TextInputField
                ref={titleRef}
                required
                label="Título"
                error={errors.title}
                hint={`${draft.title.trim().length}/${IDEA_TITLE_MAX_LENGTH}`}
                maxLength={IDEA_TITLE_MAX_LENGTH}
                placeholder="Ex.: água gelada nos carros executivos"
                disabled={isSubmitting}
                value={draft.title}
                onChange={(event) => updateDraft({ title: event.target.value })}
              />

              <TextAreaField
                ref={detailsRef}
                label="Como funcionaria? (opcional)"
                error={errors.details}
                maxLength={IDEA_DETAILS_MAX_LENGTH}
                rows={4}
                placeholder="Conte o problema e como sua ideia ajudaria."
                disabled={isSubmitting}
                value={draft.details}
                onChange={(event) => updateDraft({ details: event.target.value })}
              />

              {submitError ? <div className="ideas-feedback ideas-feedback--error" role="alert">{submitError}</div> : null}
              {notice ? <div className="ideas-feedback ideas-feedback--success" role="status">{notice}</div> : null}

              <ActionBar className="finalize-actions ideas-actions">
                <ActionButton className="finalize-primary" variant="primary" idleLabel="ENVIAR IDEIA" loadingLabel="ENVIANDO" successLabel="ENVIADA" state={submitState} onClick={() => void submit()} />
              </ActionBar>

              <section className="ideas-list-section" aria-labelledby="ideas-list-title" aria-busy={loading}>
                <div className="ideas-list-heading">
                  <h2 id="ideas-list-title">Suas ideias</h2>
                  {!loading && !loadError ? <span>{ideas.length}</span> : null}
                </div>

                {loadError ? (
                  <div className="ideas-feedback ideas-feedback--error" role="alert">
                    <span>{loadError}</span>
                    <button type="button" onClick={() => void refresh()}>Tentar novamente</button>
                  </div>
                ) : loading && !ideas.length ? (
                  <div className="ideas-skeleton" role="status" aria-label="Carregando ideias">
                    <span />
                    <span />
                  </div>
                ) : ideas.length ? (
                  <ul className="ideas-list">
                    {ideas.map((idea) => {
                      const status = getIdeaStatusOption(idea.status);
                      return (
                        <li className="idea-item" key={idea.id}>
                          <div className="idea-item-head">
                            <strong>{idea.title}</strong>
                            <span className={`idea-status idea-status--${status?.tone ?? "info"}`}>{status?.label ?? "Sem status"}</span>
                          </div>
                          {idea.details ? <p>{idea.details}</p> : null}
                          {idea.createdAt ? <small>Enviada em {formatIdeaDate(idea.createdAt)}</small> : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="ideas-empty">
                    <strong>Nenhuma ideia enviada ainda</strong>
                    <span>Sua primeira sugestão aparece aqui com o status da avaliação.</span>
                  </div>
                )}
              </section>
            </div>
          </div>
        </article>
      </section>
    </AppShell>
  );
}
