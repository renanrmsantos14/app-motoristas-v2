import { forwardRef, useEffect, useState, type ComponentPropsWithoutRef, type FocusEvent, type ReactNode } from "react";
import { SearchableSelect, type SearchableSelectProps } from "./SearchableSelect";

type FormFieldProps = {
  label?: ReactNode;
  error?: string;
  hint?: ReactNode;
  className?: string;
  labelClassName?: string;
  required?: boolean;
  children: ReactNode;
};

type FieldComponentProps = {
  label?: ReactNode;
  error?: string;
  hint?: ReactNode;
  fieldClassName?: string;
  labelClassName?: string;
  required?: boolean;
};

export function FieldError({ error, className = "" }: { error?: string; className?: string }) {
  if (!error) return null;
  return <div className={`field-error ${className}`.trim()}>{error}</div>;
}

export function FormField({
  label,
  error,
  hint,
  className = "finalize-input-block",
  labelClassName = "",
  required = false,
  children
}: FormFieldProps) {
  return (
    <div className={`${className} ${error ? "is-invalid" : ""}`.trim()}>
      {label ? (
        <label className={`form-field-label ${labelClassName}`.trim()}>
          <span>{label}</span>
          {required ? <span className="form-field-required" aria-hidden="true">*</span> : null}
        </label>
      ) : null}
      {children}
      {hint ? <div className="field-hint">{hint}</div> : null}
      <FieldError error={error} />
    </div>
  );
}

export const TextInputControl = forwardRef<HTMLInputElement, ComponentPropsWithoutRef<"input">>(function TextInputControl(props, ref) {
  const { type, value, defaultValue, onFocus, onBlur, className = "", ...inputProps } = props;
  const isDateInput = type === "date";
  const hasValue = String(value ?? defaultValue ?? "").trim().length > 0;
  const [renderType, setRenderType] = useState(isDateInput && !hasValue ? "text" : type);

  useEffect(() => {
    if (!isDateInput) return;
    setRenderType(hasValue ? "date" : "text");
  }, [hasValue, isDateInput]);

  const handleFocus = (event: FocusEvent<HTMLInputElement>) => {
    if (isDateInput) setRenderType("date");
    onFocus?.(event);
  };

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    if (isDateInput && !event.currentTarget.value) setRenderType("text");
    onBlur?.(event);
  };

  return <input ref={ref} className={`form-control-input ${className}`.trim()} type={renderType} value={value} defaultValue={defaultValue} onFocus={handleFocus} onBlur={handleBlur} {...inputProps} />;
});

export const TextAreaControl = forwardRef<HTMLTextAreaElement, ComponentPropsWithoutRef<"textarea">>(function TextAreaControl(props, ref) {
  const { className = "", ...textareaProps } = props;
  return <textarea ref={ref} className={`form-control-textarea ${className}`.trim()} {...textareaProps} />;
});

export const CheckboxControl = forwardRef<HTMLInputElement, Omit<ComponentPropsWithoutRef<"input">, "type">>(function CheckboxControl(props, ref) {
  return <input ref={ref} type="checkbox" {...props} />;
});

export const SelectControl = forwardRef<HTMLButtonElement, SearchableSelectProps>(function SelectControl(props, ref) {
  return <SearchableSelect ref={ref} {...props} />;
});

type TextInputFieldProps = FieldComponentProps & ComponentPropsWithoutRef<"input">;
type TextAreaFieldProps = FieldComponentProps & ComponentPropsWithoutRef<"textarea">;
type SelectFieldProps = FieldComponentProps & SearchableSelectProps;
type MoneyInputFieldProps = TextInputFieldProps & {
  prefix?: ReactNode;
  currencyFieldClassName?: string;
  currencyPrefixClassName?: string;
};

function labelToText(label?: ReactNode) {
  return typeof label === "string" ? label.trim() : "";
}

function compactLabel(label?: ReactNode) {
  return labelToText(label)
    .replace(/\s*\(.+?\)\s*/g, " ")
    .replace(/\s*[:/]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function getInputPlaceholder(label?: ReactNode, type?: string, inputMode?: string) {
  const normalizedLabel = compactLabel(label);

  if (type === "date") return "Selecionar data";
  if (type === "email") return "Digite e-mail";
  if (type === "tel" || inputMode === "tel") return "Digite telefone";
  if (type === "search") return "Buscar";
  if (type === "number" || inputMode === "numeric" || inputMode === "decimal") return "Digite valor";
  if (!normalizedLabel) return "Digite aqui";
  return `Digite ${normalizedLabel}`;
}

function getTextareaPlaceholder(label?: ReactNode) {
  const normalizedLabel = compactLabel(label);
  if (!normalizedLabel) return "Digite aqui";
  return `Digite ${normalizedLabel}`;
}

function getSelectPlaceholder(label?: ReactNode) {
  const normalizedLabel = compactLabel(label);
  if (!normalizedLabel) return "Selecionar";
  return `Selecionar ${normalizedLabel}`;
}

export const TextInputField = forwardRef<HTMLInputElement, TextInputFieldProps>(function TextInputField({
  label,
  error,
  hint,
  fieldClassName,
  labelClassName,
  required,
  placeholder,
  ...inputProps
}, ref) {
  const resolvedPlaceholder = placeholder ?? getInputPlaceholder(label, inputProps.type, inputProps.inputMode);

  return (
    <FormField label={label} error={error} hint={hint} className={fieldClassName} labelClassName={labelClassName} required={Boolean(required ?? inputProps.required)}>
      <TextInputControl ref={ref} aria-invalid={Boolean(error)} placeholder={resolvedPlaceholder} {...inputProps} />
    </FormField>
  );
});

export const MoneyInputField = forwardRef<HTMLInputElement, MoneyInputFieldProps>(function MoneyInputField({
  label,
  error,
  hint,
  fieldClassName,
  labelClassName,
  required,
  prefix = "R$",
  currencyFieldClassName = "",
  currencyPrefixClassName = "",
  placeholder = "",
  ...inputProps
}, ref) {
  return (
    <FormField label={label} error={error} hint={hint} className={fieldClassName} labelClassName={labelClassName} required={Boolean(required ?? inputProps.required)}>
      <div className={`money-input-field form-control-shell ${currencyFieldClassName}`.trim()}>
        <span className={`money-input-prefix form-control-value ${currencyPrefixClassName}`.trim()} aria-hidden="true">{prefix}</span>
        <TextInputControl ref={ref} aria-invalid={Boolean(error)} placeholder={placeholder} {...inputProps} />
      </div>
    </FormField>
  );
});

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(function TextAreaField({
  label,
  error,
  hint,
  fieldClassName,
  labelClassName,
  required,
  placeholder,
  ...textareaProps
}, ref) {
  const resolvedPlaceholder = placeholder ?? getTextareaPlaceholder(label);

  return (
    <FormField label={label} error={error} hint={hint} className={fieldClassName} labelClassName={labelClassName} required={Boolean(required ?? textareaProps.required)}>
      <TextAreaControl ref={ref} aria-invalid={Boolean(error)} placeholder={resolvedPlaceholder} {...textareaProps} />
    </FormField>
  );
});

export const SelectField = forwardRef<HTMLButtonElement, SelectFieldProps>(function SelectField({
  label,
  error,
  hint,
  fieldClassName,
  labelClassName,
  required,
  placeholder,
  ...selectProps
}, ref) {
  const resolvedPlaceholder = placeholder ?? getSelectPlaceholder(label);

  return (
    <FormField label={label} error={error} hint={hint} className={fieldClassName} labelClassName={labelClassName} required={Boolean(required)}>
      <SelectControl ref={ref} invalid={Boolean(error)} placeholder={resolvedPlaceholder} {...selectProps} />
    </FormField>
  );
});
