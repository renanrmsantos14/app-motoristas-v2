type VoucherSectionProps = {
  title?: string;
  children: React.ReactNode;
};

export function VoucherSection({ title, children }: VoucherSectionProps) {
  return (
    <section className="voucher-section">
      {title ? <div className="voucher-section-title">{title}</div> : null}
      <div className="voucher-section-body">{children}</div>
    </section>
  );
}
