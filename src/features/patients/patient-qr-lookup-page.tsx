import { QrCode, Search } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { Button } from '../../components/ui/button';
import { Card, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { getPatientByQrCode } from '../../lib/local-db';
import { extractPatientQrCode } from './patient-qr';

export function PatientQrLookupPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialQuery = searchParams.get('qr') ?? '';
  const [value, setValue] = useState(initialQuery);
  const [error, setError] = useState('');

  const normalizedCode = useMemo(() => extractPatientQrCode(value), [value]);

  useEffect(() => {
    if (!initialQuery) {
      return;
    }

    const patient = getPatientByQrCode(extractPatientQrCode(initialQuery));
    if (patient) {
      void navigate(`/app/patients/${patient.id}?source=qr`, { replace: true });
      return;
    }

    setError('That QR code is not linked to a patient record yet.');
  }, [initialQuery, navigate]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!normalizedCode) {
      setError('Scan a patient QR code or paste the patient code.');
      return;
    }

    const patient = getPatientByQrCode(normalizedCode);
    if (!patient) {
      setError('That QR code is not linked to a patient record yet.');
      return;
    }

    setError('');
    void navigate(`/app/patients/${patient.id}?source=qr`);
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <Card>
        <p className="text-sm uppercase tracking-[0.18em] text-slate-400">QR lookup</p>
        <CardTitle className="mt-2 text-3xl">Scan patient QR for SOAP entry</CardTitle>
        <p className="mt-3 max-w-2xl text-sm text-slate-500">
          Use a camera scanner, handheld QR scanner, or paste a patient QR link/code below to open the chart directly.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">QR link or patient code</span>
            <div className="flex items-center gap-3 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3">
              <QrCode className="size-5 text-slate-400" />
              <Input
                className="border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0"
                onChange={(event) => setValue(event.target.value)}
                placeholder="Paste scanned QR result here"
                value={value}
              />
            </div>
          </label>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          <div className="flex flex-wrap gap-3">
            <Button className="gap-2" type="submit">
              <Search className="size-4" />
              Open patient chart
            </Button>
            <Link
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              to="/app/patients"
            >
              Back to patients
            </Link>
          </div>
        </form>
      </Card>

      <Card className="bg-slate-950 text-white">
        <p className="text-sm uppercase tracking-[0.18em] text-slate-400">How this works</p>
        <CardTitle className="mt-2 text-white">Fast path to the patient chart</CardTitle>
        <div className="mt-5 space-y-4 text-sm text-slate-300">
          <p>Each patient record now has one unique QR code.</p>
          <p>Scanning the code opens this lookup flow and sends staff to the matching patient chart.</p>
          <p>From the chart, the clinical team can add the SOAP note for any appointment that still needs documentation.</p>
        </div>
      </Card>
    </div>
  );
}

