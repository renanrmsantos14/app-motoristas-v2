import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { SearchableSelect, type SearchableSelectProps } from "./SearchableSelect";

type FormFieldProps = {
  label?: ReactNode;
  error?: string;
  hint?: ReactNode;
  className?: string;
  labelClassName?: string;
  children: ReactNode;
};

type FieldComponentProps = {
  label?: ReactNode;
  error?: string;
  hint?: ReactNode;
  fieldClassName?: string;
  labelClassName?: string;
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
  children
}: FormFieldProps) {
  return (
    <div className={`${className} ${error ? "is-invalid" : ""}`.trim()}>
      {label ? <label className={labelClassName}>{label}</label> : null}
      {children}
      {hint ? <div className="field-hint">{hint}</div> : null}
      <FieldError error={error} />
    </div>
  );
}

export const TextInputControl = forwardRef<HTMLInputElement, ComponentPropsWithoutRef<"input">>(function TextInputControl(props, ref) {
  return <input ref={ref} {...props} />;
});

export const TextAreaControl = forwardRef<HTMLTextAreaElement, ComponentPropsWithoutRef<"textarea">>(function TextAreaControl(props, ref) {
  return <textarea ref={ref} {...props} />;
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

export const TextInputField = forwardRef<HTMLInputElement, TextInputFieldProps>(function TextInputField({
  label,
  error,
  hint,
  fieldClassName,
  labelClassName,
  ...inputProps
}, ref) {
  return (
    <FormField label={label} error={error} hint={hint} className={fieldClassName} labelClassName={labelClassName}>
      <TextInputControl ref={ref} aria-invalid={Boolean(error)} {...inputProps} />
    </FormField>
  );
});

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(function TextAreaField({
  label,
  error,
  hint,
  fieldClassName,
  labelClassName,
  ...textareaProps
}, ref) {
  return (
    <FormField label={label} error={error} hint={hint} className={fieldClassName} labelClassName={labelClassName}>
      <TextAreaControl ref={ref} aria-invalid={Boolean(error)} {...textareaProps} />
    </FormField>
  );
});

export const SelectField = forwardRef<HTMLButtonElement, SelectFieldProps>(function SelectField({
  label,
  error,
  hint,
  fieldClassName,
  labelClassName,
  ...selectProps
}, ref) {
  return (
    <FormField label={label} error={error} hint={hint} className={fieldClassName} labelClassName={labelClassName}>
      <SelectControl ref={ref} invalid={Boolean(error)} {...selectProps} />
    </FormField>
  );
});
