import { useState } from "react";
import { Loader2, Ticket, X } from "lucide-react";
import { toast } from "sonner";

import { validatePromoCode } from "../../lib/supabase-clinic";
import { Button } from "./button";
import { Input } from "./input";

interface CouponJoinModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onValidationSuccess: () => void;
  readonly serviceId: string;
}

export function CouponJoinModal({
  isOpen,
  onClose,
  onValidationSuccess,
  serviceId,
}: CouponJoinModalProps) {
  const [couponCode, setCouponCode] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSkipAndJoin = () => {
    onValidationSuccess();
  };

  const handleApplyAndJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = couponCode.trim();

    // If no code entered, just join without validating
    if (!code) {
      onValidationSuccess();
      return;
    }

    setIsValidating(true);
    setError("");

    try {
      await validatePromoCode(code, serviceId);
      toast.success("Coupon code applied!", {
        description: "You may now join the teleconsultation room.",
      });
      onValidationSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid coupon code.";
      setError(message);
      toast.error("Validation failed", { description: message });
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl animate-scale-in">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>

        {/* Modal Content */}
        <form onSubmit={handleApplyAndJoin} className="p-6">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-orange-600">
              <Ticket className="size-6" />
            </div>
          </div>

          <h3 className="text-center text-lg font-bold text-slate-900">
            Join Teleconsultation
          </h3>
          <p className="mt-2 text-center text-xs text-slate-500 leading-relaxed">
            Have a promo or coupon code? Enter it below to apply a discount.
            Otherwise, you can skip and join directly.
          </p>

          <div className="mt-5 space-y-3.5">
            <div className="space-y-1.5">
              <label htmlFor="coupon-input" className="text-xs font-semibold text-slate-700">
                Promo / Coupon Code <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <Input
                id="coupon-input"
                autoComplete="off"
                placeholder="e.g. FREE100 (leave blank to skip)"
                value={couponCode}
                onChange={(e) => {
                  setCouponCode(e.target.value);
                  setError("");
                }}
                className="h-10 text-sm"
                disabled={isValidating}
              />
              {error ? <p className="text-xs font-medium text-red-650">{error}</p> : null}
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={handleSkipAndJoin}
                className="w-1/2 h-10 rounded-xl"
                disabled={isValidating}
              >
                Skip &amp; Join
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="w-1/2 h-10 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold"
                disabled={isValidating}
              >
                {isValidating ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <Loader2 className="size-4 animate-spin" />
                    Validating...
                  </span>
                ) : couponCode.trim() ? (
                  "Apply & Join"
                ) : (
                  "Join Now"
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
