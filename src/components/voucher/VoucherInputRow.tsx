type VoucherInputRowProps = {
  label: string;
  error?: string;
  children: React.ReactNode;
};

export function VoucherInputRow({ label, error, children }: VoucherInputRowProps) {
  return (
    <div className={`voucher-row ${error ? "is-invalid" : ""}`}>
      <div className="voucher-row-label">{label}</div>
      <div className="voucher-row-control">{children}</div>
      {error ? <div className="field-error">{error}</div> : null}
    </div>
  );
}
