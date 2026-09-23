import { formatNaira, type CouponPreview } from "../types/errand";

type Props = {
  preview: CouponPreview;
  compact?: boolean;
};

export function CouponPriceBreakdown({ preview, compact = false }: Props) {
  const code = preview.code.trim();
  return (
    <div className={`coupon-breakdown${compact ? " compact" : ""}`}>
      <div className="coupon-breakdown-row">
        <span>Listed price</span>
        <strong>{formatNaira(preview.listed_amount)}</strong>
      </div>
      <div className="coupon-breakdown-row save">
        <span>{code ? `Coupon ${code}` : "Discount"}</span>
        <strong>−{formatNaira(preview.discount_amount)}</strong>
      </div>
      <div className="coupon-breakdown-row pay">
        <span>You pay</span>
        <strong>{formatNaira(preview.payable_amount)}</strong>
      </div>
    </div>
  );
}
