import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

import { Card, CardTitle } from '../../../components/ui/card';
import { formatCurrency } from '../../../lib/utils';
import type { BookingListItem } from '../../../lib/supabase-clinic';
import { buildBookingReceiptLookupUrl } from '../booking-receipt';

interface BookingReceiptCardProps {
  booking: BookingListItem;
}

function formatFeeLabel(feeType: BookingListItem['feeType']) {
  if (feeType === 'follow_up') return 'Follow-up Fee';
  if (feeType === 'consultation') return 'Consultation Fee';
  return 'Medical Service Fee';
}

export function BookingReceiptCard({ booking }: BookingReceiptCardProps) {
  const [svgMarkup, setSvgMarkup] = useState('');

  useEffect(() => {
    let active = true;

    void QRCode.toString(buildBookingReceiptLookupUrl(booking.receiptCode), {
      errorCorrectionLevel: 'M',
      margin: 1,
      type: 'svg',
      width: 220,
    }).then((svg: string) => {
      if (active) {
        setSvgMarkup(svg);
      }
    });

    return () => {
      active = false;
    };
  }, [booking.receiptCode]);

  return (
    <Card className="h-full">
      <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Booking Receipt</p>
      <CardTitle className="mt-2">Present this at cashier</CardTitle>
      <p className="mt-2 text-sm text-slate-500">
        Cashier and staff can scan this receipt QR to verify the booking and payment status before the patient proceeds.
      </p>
      <div className="mt-5 flex justify-center rounded-[28px] bg-slate-50 p-5">
        {svgMarkup ? (
          <div
            aria-label={`Receipt QR for ${booking.serviceName}`}
            className="size-[220px]"
            dangerouslySetInnerHTML={{ __html: svgMarkup }}
          />
        ) : (
          <div className="flex size-[220px] items-center justify-center rounded-3xl bg-white text-sm text-slate-400">
            Generating QR...
          </div>
        )}
      </div>
      <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Receipt code</p>
          <p className="mt-1 break-all font-mono font-semibold text-slate-950">{booking.receiptCode}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Charge</p>
          <p className="mt-1 font-semibold text-slate-950">
            {formatFeeLabel(booking.feeType)} - {formatCurrency(booking.feeAmount)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Payment status</p>
          <p className="mt-1 font-semibold text-slate-950">{booking.paymentStatus === 'paid' ? 'Paid' : 'Pending Cashier'}</p>
        </div>
      </div>
    </Card>
  );
}
