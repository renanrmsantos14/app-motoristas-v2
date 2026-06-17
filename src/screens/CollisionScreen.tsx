import { useEffect, useMemo, useRef, useState } from "react";
import { ActionBar, ActionButton, type ActionButtonState } from "../components/common/ActionButton";
import { FieldError, FormField, SelectField, TextAreaField, TextInputControl, TextInputField } from "../components/common/FormFields";
import { PhotoAddButton } from "../components/common/PhotoAddButton";
import { AppShell } from "../components/layout/AppShell";
import { FormMenu } from "../components/navigation/FormMenu";
import {
  buildCollisionWhatsAppMessage,
  buildCollisionWhatsAppUrl,
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
  submitState: ActionButtonState;
  vehicles: MaintenanceRequestVehicleOption[];
  vehiclesLoading: boolean;
  currentVehicleId: string;
  driverName?: string;
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
  currentVehicleId,
  driverName
}: CollisionScreenProps) {
  const isSubmitting = submitState !== "idle";
  const vehicleRef = useRef<HTMLButtonElement | null>(null);
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
  const whatsappUrl = buildCollisionWhatsAppUrl(
    draft.terceiroTelefone,
    buildCollisionWhatsAppMessage({
      thirdPartyName: draft.terceiroNome,
      driverName
    })
  );
  const requiredPhotos = getRequiredCollisionPhotos(hasThirdParty);
  const completedRequiredPhotos = requiredPhotos.filter((requiredPhoto) =>
    photos.some((photo) => photo.kind === requiredPhoto.kind && photo.dataUrl)
  ).length;
  const evidenceGroups = requiredPhotos.map((requiredPhoto) => ({
    ...requiredPhoto,
    photos: photos.filter((photo) => photo.kind === requiredPhoto.kind)
  }));
  const optionalPhotos = photos.filter((photo) => photo.kind === "extra" || photo.kind === "video");
  const vehicleOptions = useMemo(
    () => vehicles.map((vehicle) => ({
      value: vehicle.id,
      label: vehicle.isCurrent ? `${vehicle.label} - atual` : vehicle.label
    })),
    [vehicles]
  );

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
    if (hasThirdParty && nextErrors.terceiroPlaca) return focusInvalidField(thirdPlateRef.current);
    if (hasThirdParty && nextErrors.terceiroVeiculo) return focusInvalidField(thirdVehicleRef.current);
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

              <SelectField
                ref={vehicleRef}
                required
                label="Veículo da Betinhos"
                error={errors.veiculoId}
                value={draft.veiculoId}
                options={vehicleOptions}
                placeholder={vehiclesLoading ? "Carregando veículos" : "Selecione"}
                ariaLabel="Selecionar veículo da Betinhos"
                disabled={isSubmitting || vehiclesLoading}
                onChange={(value) => {
                  updateDraft({ veiculoId: value });
                  clearError("veiculoId");
                }}
              />

              <TextInputField
                label="Data e hora"
                type="datetime-local"
                value={draft.dataHora}
                disabled={isSubmitting}
                onChange={(event) => updateDraft({ dataHora: event.target.value })}
              />

              <TextInputField
                ref={localRef}
                required
                label="Local"
                error={errors.local}
                placeholder="Ex.: Av. Paulista, 1000"
                value={draft.local}
                disabled={isSubmitting}
                onChange={(event) => {
                  updateDraft({ local: event.target.value });
                  clearError("local");
                }}
              />

              <TextAreaField
                ref={descriptionRef}
                required
                label="O que aconteceu?"
                error={errors.descricao}
                placeholder="Conte em detalhes o que aconteceu"
                rows={4}
                value={draft.descricao}
                disabled={isSubmitting}
                onChange={(event) => {
                  updateDraft({ descricao: event.target.value });
                  clearError("descricao");
                }}
              />

              {!isHitByThirdParty ? (
                <FormField label="Houve terceiro?">
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
                          terceiroDocumento: undefined,
                          terceiroSeguradora: undefined,
                          danoTerceiro: undefined,
                          documentoTerceiro: undefined
                        }));
                      }}
                    >
                      Não
                    </button>
                  </div>
                </FormField>
              ) : null}

              {hasThirdParty ? (
                <>
                  <div className="collision-section-title">Terceiro envolvido</div>

                  <TextInputField
                    ref={thirdNameRef}
                    required
                    label="Nome completo"
                    error={errors.terceiroNome}
                    value={draft.terceiroNome}
                    disabled={isSubmitting}
                    onChange={(event) => {
                      updateDraft({ terceiroNome: event.target.value });
                      clearError("terceiroNome");
                    }}
                  />

                  <FormField label="WhatsApp/telefone" error={errors.terceiroTelefone} required>
                    <TextInputControl
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
                    {whatsappUrl ? (
                      <a className="collision-whatsapp" href={whatsappUrl} target="_blank" rel="noreferrer">
                        Abrir WhatsApp
                      </a>
                    ) : null}
                  </FormField>

                  <TextInputField
                    ref={thirdPlateRef}
                    required
                    label="Placa"
                    error={errors.terceiroPlaca}
                    placeholder="Ex.: ABC1D23"
                    value={draft.terceiroPlaca}
                    disabled={isSubmitting}
                    onChange={(event) => {
                      updateDraft({ terceiroPlaca: event.target.value.toUpperCase() });
                      clearError("terceiroPlaca");
                    }}
                  />

                  <TextInputField
                    ref={thirdVehicleRef}
                    required
                    label="Modelo/cor do veículo"
                    error={errors.terceiroVeiculo}
                    placeholder="Ex.: Corolla prata"
                    value={draft.terceiroVeiculo}
                    disabled={isSubmitting}
                    onChange={(event) => {
                      updateDraft({ terceiroVeiculo: event.target.value });
                      clearError("terceiroVeiculo");
                    }}
                  />

                  {!isHitByThirdParty ? (
                    <TextAreaField
                      label="Observação do terceiro"
                      rows={3}
                      value={draft.terceiroObservacao}
                      disabled={isSubmitting}
                      onChange={(event) => updateDraft({ terceiroObservacao: event.target.value })}
                    />
                  ) : null}
                </>
              ) : null}

              <div ref={photosRef} className="finalize-input-block collision-photos-block" tabIndex={-1}>
                <div className="collision-photos-header">
                  <div>
                    <span>Evidências</span>
                    <strong>
                      <span>Fotos obrigatórias</span>
                      <span className="form-field-required" aria-hidden="true">*</span>
                    </strong>
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
                          <PhotoAddButton
                            disabled={isSubmitting}
                            onClick={() => addPhoto(requiredPhoto.kind)}
                            ariaLabel={`Adicionar foto em ${requiredPhoto.label}`}
                            label={isComplete ? "Adicionar" : "Primeira foto"}
                          />
                        </div>
                        <FieldError error={errors[requiredPhoto.kind]} />
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
                    <PhotoAddButton disabled={isSubmitting} onClick={() => addPhoto("extra")} ariaLabel="Adicionar complementar" label="Adicionar" />
                  </div>
                </section>
              </div>
            </div>
          </div>
          <ActionBar className="finalize-actions maintenance-actions">
            <ActionButton className="finalize-primary" variant="primary" idleLabel="ENVIAR" loadingLabel="ENVIANDO" successLabel="ENVIADO" state={submitState} onClick={submit} />
          </ActionBar>
        </article>
      </section>
    </AppShell>
  );
}
