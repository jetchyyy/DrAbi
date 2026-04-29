import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

import { Card, CardTitle } from '../../../components/ui/card';
import { buildPatientQrLookupUrl } from '../patient-qr';

interface PatientQrCardProps {
  patientName: string;
  qrCode: string;
}

export function PatientQrCard({ patientName, qrCode }: PatientQrCardProps) {
  const [svgMarkup, setSvgMarkup] = useState('');

  useEffect(() => {
    let active = true;

    void QRCode.toString(buildPatientQrLookupUrl(qrCode), {
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
  }, [qrCode]);

  return (
    <Card>
      <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Patient QR</p>
      <CardTitle className="mt-2">Scan to open chart</CardTitle>
      <p className="mt-2 text-sm text-slate-500">
        Staff can scan this QR to jump straight to {patientName}&apos;s chart and continue SOAP documentation.
      </p>
      <div className="mt-4 flex justify-center rounded-[24px] bg-slate-50 p-4">
        {svgMarkup ? (
          <div
            aria-label={`QR code for ${patientName}`}
            className="size-[180px] sm:size-[200px]"
            dangerouslySetInnerHTML={{ __html: svgMarkup }}
          />
        ) : (
          <div className="flex size-[180px] items-center justify-center rounded-3xl bg-white text-sm text-slate-400 sm:size-[200px]">
            Generating QR...
          </div>
        )}
      </div>
      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Patient code</p>
        <p className="mt-1 break-all font-mono text-sm font-semibold text-slate-950">{qrCode}</p>
      </div>
    </Card>
  );
}


