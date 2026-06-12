import { useEffect, useRef, useState } from "react";
import { FlowSubmitButton, type FlowSubmitState } from "../components/common/FlowSubmitButton";
import { AppShell } from "../components/layout/AppShell";
import { FormMenu } from "../components/navigation/FormMenu";
import {
  buildCollisionWhatsAppUrl,
  getCollisionPhotoLabel,
  getCollisionTypeLabel,
  getRequiredCollisionPhotos,
  hasCollisionThirdParty,
  isCollisionVideo,
  validateCollisionDraft,
  type CollisionDraft,
  type CollisionPhoto,
  type CollisionPhotoKind,
  type CollisionValidationErrors
} from "../lib/collisions";
import type { MaintenanceRequestVehicleOption } from "../lib/dataverse";

type CollisionScreenProps = {
  draft: CollisionDraft;
  photos: CollisionPhoto[];
  onDraftChange: (draft: CollisionDraft) => void;
  onAddPhoto: (kind: CollisionPhotoKind) => void;
  onPreviewPhoto: (photoId: string) => void;
  onBack: () => void;
  onSubmit: (draft: CollisionDraft) => void;
  submitState: FlowSubmitState;
  vehicles: MaintenanceRequestVehicleOption[];
  vehiclesLoading: boolean;
  currentVehicleId: string;
};

function focusInvalidField(element: HTMLElement | null) {
  element?.focus({ preventScroll: false });
  element?.scrollIntoView({ block: "center", behavior: "smooth" });
}

function formatPhotoCount(count: number) {
  return `${count} ${count === 1 ? "item" : "itens"}`;
}

export function CollisionScreen({
  draft,
  photos,
  onDraftChange,
  onAddPhoto,
  onPreviewPhoto,
  onBack,
  onSubmit,
  submitState,
  vehicles,
  vehiclesLoading,
  currentVehicleId
}: CollisionScreenProps) {
  const isSubmitting = submitState !== "idle";
  const vehicleRef = useRef<HTMLSelectElement | null>(null);
  const localRef = useRef<HTMLInputElement | null>(null);
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);
  const thirdNameRef = useRef<HTMLInputElement | null>(null);
  const thirdPhoneRef = useRef<HTMLInputElement | null>(null);
  const thirdPlateRef = useRef<HTMLInputElement | null>(null);
  const thirdVehicleRef = useRef<HTMLInputElement | null>(null);
  const photosRef = useRef<HTMLDivElement | null>(null);
  const [errors, setErrors] = useState<CollisionValidationErrors>({});
  const isHitByThirdParty = draft.tipoOcorrencia === "bateram_em_mim";
  const hasThirdParty = hasCollisionThirdParty(draft);
  const whatsappUrl = buildCollisionWhatsAppUrl(draft.terceiroTelefone);
  const requiredPhotos = getRequiredCollisionPhotos(hasThirdParty);
  const completedRequiredPhotos = requiredPhotos.filter((requiredPhoto) =>
    photos.some((photo) => photo.kind === requiredPhoto.kind && photo.dataUrl)
  ).length;
  const evidenceGroups = requiredPhotos.map((requiredPhoto) => ({
    ...requiredPhoto,
    photos: photos.filter((photo) => photo.kind === requiredPhoto.kind)
  }));
  const optionalPhotos = photos.filter((photo) => photo.kind === "extra" || photo.kind === "video");

  useEffect(() => {
    if (currentVehicleId && !draft.veiculoId) onDraftChange({ ...draft, veiculoId: currentVehicleId });
  }, [currentVehicleId, draft, onDraftChange]);

  const updateDraft = (updates: Partial<CollisionDraft>) => onDraftChange({ ...draft, ...updates });
  const clearError = (key: keyof CollisionValidationErrors) => {
    if (!errors[key]) return;
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const submit = () => {
    if (isSubmitting) return;
    const nextErrors = validateCollisionDraft(draft, photos);
    setErrors(nextErrors);
    if (nextErrors.veiculoId) return focusInvalidField(vehicleRef.current);
    if (nextErrors.local) return focusInvalidField(localRef.current);
    if (nextErrors.descricao) return focusInvalidField(descriptionRef.current);
    if (hasThirdParty && nextErrors.terceiroNome) return focusInvalidField(thirdNameRef.current);
    if (hasThirdParty && nextErrors.terceiroTelefone) return focusInvalidField(thirdPhoneRef.current);
    if (requiredPhotos.some((photo) => nextErrors[photo.kind])) return focusInvalidField(photosRef.current);
    onSubmit(draft);
  };

  const addPhoto = (kind: CollisionPhotoKind) => {
    clearError(kind);
    onAddPhoto(kind);
  };

  const errorCount = Object.values(errors).filter(Boolean).length;

  return (
    <AppShell screenLabel="TelaColisoes">
      <FormMenu title="Registrar colisão" onBack={isSubmitting ? undefined : onBack} />
      <section className="main-panel maintenance-request-main">
        <article className="finalize-card maintenance-request-card collision-card">
          <div className="finalize-scroll">
            <div className="finalize-form maintenance maintenance-request-form collision-form">
              <div className="collision-summary">
                <span>Tipo</span>
                <strong>{getCollisionTypeLabel(draft.tipoOcorrencia)}</strong>
              </div>
              {errorCount ? <div className="form-error-summary">Revise {errorCount} campo(s) destacado(s).</div> : null}

              <div className={`finalize-input-block ${errors.veiculoId ? "is-invalid" : ""}`}>
                <label>Veículo Betinhos</label>
                <select
                  ref={vehicleRef}
                  aria-invalid={Boolean(errors.veiculoId)}
                  value={draft.veiculoId}
                  disabled={isSubmitting || vehiclesLoading}
                  onChange={(event) => {
                    updateDraft({ veiculoId: event.target.value });
                    clearError("veiculoId");
                  }}
                >
                  <option value="">{vehiclesLoading ? "Carregando veículos" : "Selecione"}</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>{vehicle.isCurrent ? `${vehicle.label} - atual` : vehicle.label}</option>
                  ))}
                </select>
                {errors.veiculoId ? <div className="field-error">{errors.veiculoId}</div> : null}
              </div>

              <div className="finalize-input-block">
                <label>Data e hora</label>
                <input
                  type="datetime-local"
                  value={draft.dataHora}
                  disabled={isSubmitting}
                  onChange={(event) => updateDraft({ dataHora: event.target.value })}
                />
              </div>

              <div className={`finalize-input-block ${errors.local ? "is-invalid" : ""}`}>
                <label>Local</label>
                <input
                  ref={localRef}
                  aria-invalid={Boolean(errors.local)}
                  placeholder="Ex.: Av. Paulista, 1000"
                  value={draft.local}
                  disabled={isSubmitting}
                  onChange={(event) => {
                    updateDraft({ local: event.target.value });
                    clearError("local");
                  }}
                />
                {errors.local ? <div className="field-error">{errors.local}</div> : null}
              </div>

              <div className={`finalize-input-block ${errors.descricao ? "is-invalid" : ""}`}>
                <label>O que aconteceu?</label>
                <textarea
                  ref={descriptionRef}
                  aria-invalid={Boolean(errors.descricao)}
                  placeholder="Conte em poucas palavras o que aconteceu"
                  rows={4}
                  value={draft.descricao}
                  disabled={isSubmitting}
                  onChange={(event) => {
                    updateDraft({ descricao: event.target.value });
                    clearError("descricao");
                  }}
                />
                {errors.descricao ? <div className="field-error">{errors.descricao}</div> : null}
              </div>

              {!isHitByThirdParty ? (
                <div className="finalize-input-block">
                  <label>Houve terceiro?</label>
                  <div className="collision-toggle-row" role="group" aria-label="Houve terceiro?">
                    <button
                      type="button"
                      className={`collision-toggle ${draft.houveTerceiro ? "is-active" : ""}`}
                      disabled={isSubmitting}
                      onClick={() => updateDraft({ houveTerceiro: true })}
                    >
                      Sim
                    </button>
                    <button
                      type="button"
                      className={`collision-toggle ${!draft.houveTerceiro ? "is-active" : ""}`}
                      disabled={isSubmitting}
                      onClick={() => {
                        updateDraft({
                          houveTerceiro: false,
                          terceiroNome: "",
                          terceiroTelefone: "",
                          terceiroPlaca: "",
                          terceiroVeiculo: "",
                          terceiroDocumento: "",
                          terceiroSeguradora: "",
                          terceiroObservacao: ""
                        });
                        setErrors((current) => ({
                          ...current,
                          terceiroNome: undefined,
                          terceiroTelefone: undefined,
                          terceiroPlaca: undefined,
                          terceiroVeiculo: undefined,
                          danoTerceiro: undefined,
                          documentoTerceiro: undefined
                        }));
                      }}
                    >
                      Não
                    </button>
                  </div>
                </div>
              ) : null}

              {hasThirdParty ? (
                <>
                  <div className="collision-section-title">Terceiro envolvido</div>
                  <div className={`finalize-input-block ${errors.terceiroNome ? "is-invalid" : ""}`}>
                    <label>Nome completo</label>
                    <input
                      ref={thirdNameRef}
                      aria-invalid={Boolean(errors.terceiroNome)}
                      value={draft.terceiroNome}
                      disabled={isSubmitting}
                      onChange={(event) => {
                        updateDraft({ terceiroNome: event.target.value });
                        clearError("terceiroNome");
                      }}
                    />
                    {errors.terceiroNome ? <div className="field-error">{errors.terceiroNome}</div> : null}
                  </div>

                  <div className={`finalize-input-block ${errors.terceiroTelefone ? "is-invalid" : ""}`}>
                    <label>WhatsApp/telefone</label>
                    <input
                      ref={thirdPhoneRef}
                      aria-invalid={Boolean(errors.terceiroTelefone)}
                      inputMode="tel"
                      placeholder="Ex.: (11) 99999-8888"
                      value={draft.terceiroTelefone}
                      disabled={isSubmitting}
                      onChange={(event) => {
                        updateDraft({ terceiroTelefone: event.target.value });
                        clearError("terceiroTelefone");
                      }}
                    />
                    {errors.terceiroTelefone ? <div className="field-error">{errors.terceiroTelefone}</div> : null}
                    {whatsappUrl ? (
                      <a className="collision-whatsapp" href={whatsappUrl} target="_blank" rel="noreferrer">
                        Abrir WhatsApp
                      </a>
                    ) : null}
                  </div>

                  {!isHitByThirdParty ? <div className={`finalize-input-block ${errors.terceiroPlaca ? "is-invalid" : ""}`}>
                    <label>Placa</label>
                    <input
                      ref={thirdPlateRef}
                      aria-invalid={Boolean(errors.terceiroPlaca)}
                      placeholder="Ex.: ABC1D23"
                      value={draft.terceiroPlaca}
                      disabled={isSubmitting}
                      onChange={(event) => {
                        updateDraft({ terceiroPlaca: event.target.value.toUpperCase() });
                        clearError("terceiroPlaca");
                      }}
                    />
                    {errors.terceiroPlaca ? <div className="field-error">{errors.terceiroPlaca}</div> : null}
                  </div> : null}

                  {!isHitByThirdParty ? <div className={`finalize-input-block ${errors.terceiroVeiculo ? "is-invalid" : ""}`}>
                    <label>Modelo/cor do veículo</label>
                    <input
                      ref={thirdVehicleRef}
                      aria-invalid={Boolean(errors.terceiroVeiculo)}
                      placeholder="Ex.: Corolla prata"
                      value={draft.terceiroVeiculo}
                      disabled={isSubmitting}
                      onChange={(event) => {
                        updateDraft({ terceiroVeiculo: event.target.value });
                        clearError("terceiroVeiculo");
                      }}
                    />
                    {errors.terceiroVeiculo ? <div className="field-error">{errors.terceiroVeiculo}</div> : null}
                  </div> : null}

                  {!isHitByThirdParty ? <div className="finalize-input-block">
                    <label>CPF/CNH/RG</label>
                    <input value={draft.terceiroDocumento} disabled={isSubmitting} onChange={(event) => updateDraft({ terceiroDocumento: event.target.value })} />
                  </div> : null}
                  {!isHitByThirdParty ? <div className="finalize-input-block">
                    <label>Seguradora</label>
                    <input value={draft.terceiroSeguradora} disabled={isSubmitting} onChange={(event) => updateDraft({ terceiroSeguradora: event.target.value })} />
                  </div> : null}
                  {!isHitByThirdParty ? <div className="finalize-input-block">
                    <label>Observação do terceiro</label>
                    <textarea rows={3} value={draft.terceiroObservacao} disabled={isSubmitting} onChange={(event) => updateDraft({ terceiroObservacao: event.target.value })} />
                  </div> : null}
                </>
              ) : null}

              <div ref={photosRef} className="finalize-input-block collision-photos-block" tabIndex={-1}>
                <div className="collision-photos-header">
                  <div>
                    <span>Evidências</span>
                    <strong>Fotos obrigatórias</strong>
                  </div>
                  <small>{completedRequiredPhotos}/{requiredPhotos.length}</small>
                </div>
                <div className="collision-evidence-list">
                  {evidenceGroups.map((requiredPhoto) => {
                    const isComplete = requiredPhoto.photos.length > 0;
                    return (
                      <section
                        key={requiredPhoto.kind}
                        className={`collision-evidence-group ${errors[requiredPhoto.kind] ? "is-invalid" : ""} ${isComplete ? "is-complete" : ""}`}
                      >
                        <div className="collision-evidence-group-head">
                          <div>
                            <strong>{requiredPhoto.label}</strong>
                          </div>
                          <small>{formatPhotoCount(requiredPhoto.photos.length)}</small>
                        </div>
                        <div className="collision-evidence-strip">
                          {requiredPhoto.photos.map((photo, index) => (
                            <button
                              type="button"
                              className="collision-evidence-thumb"
                              key={photo.id}
                              disabled={isSubmitting}
                              onClick={() => onPreviewPhoto(photo.id)}
                              aria-label={`Ver ${requiredPhoto.label} ${index + 1}`}
                            >
                              {isCollisionVideo(photo) ? (
                                <>
                                  {photo.posterUrl ? (
                                    <img src={photo.posterUrl} alt={`Vídeo ${requiredPhoto.label} ${index + 1}`} />
                                  ) : (
                                    <video src={photo.previewUrl || photo.dataUrl} muted playsInline preload="metadata" />
                                  )}
                                  <span className="media-video-badge">{photo.durationLabel || "Vídeo"}</span>
                                </>
                              ) : (
                                <img src={photo.dataUrl} alt={`${requiredPhoto.label} ${index + 1}`} />
                              )}
                              <small>{index + 1}</small>
                            </button>
                          ))}
                          <button
                            type="button"
                            className="collision-evidence-add"
                            disabled={isSubmitting}
                            onClick={() => addPhoto(requiredPhoto.kind)}
                            aria-label={`Adicionar foto em ${requiredPhoto.label}`}
                          >
                            <span>+</span>
                            <strong>{isComplete ? "Adicionar" : "Primeira foto"}</strong>
                          </button>
                        </div>
                        {errors[requiredPhoto.kind] ? <div className="field-error">{errors[requiredPhoto.kind]}</div> : null}
                      </section>
                    );
                  })}
                </div>
                <section className="collision-evidence-group collision-evidence-group--optional">
                  <div className="collision-evidence-group-head">
                    <div>
                      <strong>Complementares</strong>
                    </div>
                    <small>{optionalPhotos.length} itens</small>
                  </div>
                  <div className="collision-evidence-strip">
                    {optionalPhotos.map((photo, index) => (
                      <button
                        type="button"
                        className={`collision-evidence-thumb ${isCollisionVideo(photo) ? "collision-video-thumb" : ""}`}
                        key={photo.id}
                        disabled={isSubmitting}
                        onClick={() => onPreviewPhoto(photo.id)}
                        aria-label={`Ver complementar ${index + 1}`}
                      >
                        {isCollisionVideo(photo) ? (
                          <>
                            {photo.posterUrl ? (
                              <img src={photo.posterUrl} alt={`Vídeo complementar ${index + 1}`} />
                            ) : (
                              <video src={photo.previewUrl || photo.dataUrl} muted playsInline preload="metadata" />
                            )}
                            <span className="media-video-badge">{photo.durationLabel || "Vídeo"}</span>
                          </>
                        ) : (
                          <img src={photo.dataUrl} alt={`Foto complementar ${index + 1}`} />
                        )}
                        <small>{index + 1}</small>
                      </button>
                    ))}
                    <button type="button" className="collision-evidence-add" disabled={isSubmitting} onClick={() => addPhoto("extra")} aria-label="Adicionar complementar">
                      <span>+</span>
                      <strong>Adicionar</strong>
                    </button>
                  </div>
                </section>
                <div className="field-hint collision-photo-hint">{photos.length} arquivo(s) no total</div>
              </div>
            </div>
          </div>
          <div className="finalize-actions maintenance-actions">
            <FlowSubmitButton className="finalize-primary" idleLabel="ENVIAR" loadingLabel="ENVIANDO" successLabel="ENVIADO" state={submitState} onClick={submit} />
          </div>
        </article>
      </section>
    </AppShell>
  );
}
