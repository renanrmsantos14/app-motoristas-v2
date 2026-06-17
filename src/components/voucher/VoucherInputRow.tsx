type VoucherInputRowProps = {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
};

export function VoucherInputRow({ label, error, required = false, children }: VoucherInputRowProps) {
  return (
    <div className={`voucher-row ${error ? "is-invalid" : ""}`}>
      <div className="voucher-row-label">
        <span>{label}</span>
        {required ? <span className="form-field-required" aria-hidden="true">*</span> : null}
      </div>
      <div className="voucher-row-control">{children}</div>
      {error ? <div className="field-error">{error}</div> : null}
    </div>
  );
}
