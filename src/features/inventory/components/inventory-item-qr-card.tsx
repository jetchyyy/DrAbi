import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

import { Card, CardTitle } from '../../../components/ui/card';
import { buildInventoryItemQrValue } from '../inventory-qr';

interface InventoryItemQrCardProps {
  itemName: string;
  qrCode: string;
}

export function InventoryItemQrCard({ itemName, qrCode }: InventoryItemQrCardProps) {
  const [svgMarkup, setSvgMarkup] = useState('');

  useEffect(() => {
    let active = true;

    void QRCode.toString(buildInventoryItemQrValue(qrCode), {
      errorCorrectionLevel: 'M',
      margin: 1,
      type: 'svg',
      width: 180,
    }).then((svg: string) => {
      if (active) {
        setSvgMarkup(svg);
      }
    });

    return () => {
      active = false;
    };
  }, [qrCode]);

  return (
    <Card className="h-full border-slate-200 bg-slate-50">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Item QR</p>
      <CardTitle className="mt-2 text-base">{itemName}</CardTitle>
      <p className="mt-2 text-sm text-slate-500">
        Print or scan this code when the item is dispensed to a patient.
      </p>
      <div className="mt-4 flex justify-center rounded-[24px] bg-white p-4">
        {svgMarkup ? (
          <div
            aria-label={`QR code for ${itemName}`}
            className="size-[180px]"
            dangerouslySetInnerHTML={{ __html: svgMarkup }}
          />
        ) : (
          <div className="flex size-[180px] items-center justify-center rounded-3xl bg-slate-50 text-sm text-slate-400">
            Generating QR...
          </div>
        )}
      </div>
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Item code</p>
        <p className="mt-1 break-all font-mono text-sm font-semibold text-slate-950">{qrCode}</p>
      </div>
    </Card>
  );
}
