import { zodResolver } from '@hookform/resolvers/zod';
import { Coins, Eye, Pencil, Plus, Printer, Receipt, ScanLine, Search, TestTube2, Trash2, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import QRCode from 'qrcode';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';

import { FormField } from '../../components/forms/form-field';
import { Button } from '../../components/ui/button';
import { Card, CardTitle } from '../../components/ui/card';
import { FeedbackModal } from '../../components/ui/feedback-modal';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { isModuleEnabled } from '../../config/modules';
import { useAuth } from '../auth/auth-context';
import { useClinicSettingsData } from '../../hooks/use-clinic-data';
import { LabServiceReceiptCard } from '../laboratory/components/lab-service-receipt-card';
import { buildLabServiceReceiptLookupUrl } from '../laboratory/lab-service-receipt';
import { labRequestService } from '../lab-requests/api/lab-request-service';
import type { LabRequestRecord } from '../lab-requests/types';
import { getDatabase } from '../../lib/local-db';
import { printHtmlDocument } from '../../lib/print';
import { queryKeys } from '../../lib/query-keys';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import {
  createInvoiceLiveOrDemo,
  deleteInvoiceLiveOrDemo,
  listBookingsLiveOrDemo,
  listInvoiceItemsLiveOrDemo,
  listInvoicesLiveOrDemo,
  listPatientsLiveOrDemo,
  updateInvoiceLiveOrDemo,
} from '../../lib/supabase-clinic';
import { formatCurrency } from '../../lib/utils';
import type { Invoice } from '../../types/domain';

const invoiceItemSchema = z.object({
  description: z.string().min(2, 'Description must be at least 2 characters.'),
  category: z.enum(['consultation', 'laboratory', 'medicine', 'other']),
  quantity: z.number().min(1, 'Quantity must be at least 1.'),
  unitPrice: z.number().min(1, 'Unit price must be at least 1.'),
});

const billingSchema = z.object({
  patientId: z.string().min(1, 'Patient is required.'),
  bookingId: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1, 'At least one invoice item is required.'),
});

type BillingFormValues = z.infer<typeof billingSchema>;

const payForServiceSchema = z.object({
  patientId: z.string().min(1, 'Patient is required.'),
  serviceId: z.string().min(1, 'Laboratory service is required.'),
  notes: z.string().optional(),
  urgentFlag: z.boolean(),
});

type PayForServiceFormValues = z.infer<typeof payForServiceSchema>;
const BILLING_PAGE_SIZE = 10;

interface LabServiceOption {
  id: string;
  clinicId: string | null;
  name: string;
  description: string | null;
  category: string;
  serviceFee: number;
}

interface FeedbackModalState {
  open: boolean;
  title: string;
  message: string;
  variant: 'success' | 'error';
}

interface LabReceiptState {
  open: boolean;
  invoice: Invoice | null;
  request: LabRequestRecord | null;
  patientName: string;
}

interface InvoiceViewState {
  open: boolean;
  invoiceId: string | null;
}

function PaymentBadge({ status }: { status: string }) {
  if (status === 'paid') return <span className="bg-emerald-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">Paid</span>;
  if (status === 'partial') return <span className="bg-orange-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-orange-700">Partial</span>;
  return <span className="bg-rose-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-rose-700">Unpaid</span>;
}

export function buildInvoicePrintDocument(input: {
  clinicName: string;
  invoice: Invoice;
  patientName: string;
  patientContact: string;
  items: Array<{
    description: string;
    category: string;
    quantity: number;
    unitPrice: number;
  }>;
  qrSvgMarkup?: string;
  qrHelperText?: string;
}) {
  const createdAt = new Date(input.invoice.createdAt);
  const paymentStatusLabel = input.invoice.paymentStatus.toUpperCase();
 
  // Build up to 6 item rows; pad with empty rows so the table always looks full
  const MIN_ROWS = 6;
  const items = input.items.slice();
  while (items.length < MIN_ROWS) {
    items.push({ description: '', category: '', quantity: 0, unitPrice: 0 });
  }
 
  const itemRows = items
    .map((item, i) => {
      const amount = item.quantity && item.unitPrice ? item.quantity * item.unitPrice : 0;
      return `
        <tr class="${i % 2 === 0 ? 'row-even' : 'row-odd'}">
          <td class="td-desc">${item.description ? item.description.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : ''}</td>
          <td class="td-center">${item.quantity || ''}</td>
          <td class="td-right">${item.unitPrice ? formatCurrency(item.unitPrice) : ''}</td>
          <td class="td-right td-amount">${amount ? formatCurrency(amount) : ''}</td>
        </tr>`;
    })
    .join('');
 
  const statusClass =
    input.invoice.paymentStatus === 'paid'
      ? 'status-paid'
      : input.invoice.paymentStatus === 'partial'
        ? 'status-partial'
        : 'status-unpaid';
 
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>CPRMed Billing Invoice – ${input.invoice.invoiceNumber}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
 
    body {
      background: #f0f0f0;
      font-family: Arial, Helvetica, sans-serif;
      color: #111;
      padding: 24px;
    }
 
    /* ── Page sheet ── */
    .sheet {
      max-width: 680px;
      margin: 0 auto;
      background: #ffffff;
      padding: 0 0 36px;
      position: relative;
      overflow: hidden;
    }
 
    /* ── Green wave footer strip ── */
    .sheet::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 58px;
      background: #4caf50;
      border-radius: 80% 80% 0 0 / 40px 40px 0 0;
      z-index: 0;
    }
 
    /* ── Header band ── */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 18px 28px 10px;
      border-bottom: 2px solid #e8e8e8;
    }
 
    .logo-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
    }
 
    /* Play-button hex icon */
    .logo-icon {
      width: 36px;
      height: 36px;
      background: #222;
      clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .logo-icon::after {
      content: '';
      display: block;
      width: 0;
      height: 0;
      border-top: 8px solid transparent;
      border-bottom: 8px solid transparent;
      border-left: 13px solid #fff;
      margin-left: 3px;
    }
 
    .brand-text {
      line-height: 1;
    }
    .brand-name {
      font-size: 26px;
      font-weight: 900;
      letter-spacing: -0.5px;
    }
    .brand-cpr { color: #4caf50; }
    .brand-med { color: #2196f3; }
    .brand-tagline {
      font-size: 10px;
      color: #555;
      letter-spacing: 0.04em;
      margin-top: 2px;
    }
 
    /* ECG pulse line */
    .ecg-wrap {
      flex: 1;
      margin: 0 18px;
      overflow: hidden;
      height: 36px;
      display: flex;
      align-items: center;
    }
    .ecg-wrap svg { width: 100%; height: 36px; }
 
    .header-right {
      text-align: right;
      min-width: 110px;
    }
    .invoice-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #777;
    }
    .invoice-number {
      font-size: 13px;
      font-weight: 800;
      color: #111;
      font-family: 'Courier New', monospace;
    }
 
    /* ── Meta row (Date / Billed To / Status) ── */
    .meta-band {
      padding: 12px 28px;
      display: grid;
      grid-template-columns: 1fr 1fr auto;
      gap: 8px 24px;
      background: #fafafa;
      border-bottom: 1px solid #e8e8e8;
      font-size: 12px;
    }
    .meta-label {
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #555;
      font-size: 10px;
    }
    .meta-value {
      font-weight: 700;
      color: #111;
      font-size: 13px;
      margin-top: 2px;
      border-bottom: 1.5px solid #aaa;
      padding-bottom: 2px;
      min-width: 120px;
    }
    .meta-value.patient-name {
      min-width: 240px;
    }
 
    /* Status badge */
    .status-paid   { color: #fff; background: #4caf50; }
    .status-unpaid { color: #fff; background: #f44336; }
    .status-partial{ color: #fff; background: #ff9800; }
    .status-badge {
      display: inline-block;
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      padding: 3px 10px;
      border-radius: 3px;
      margin-top: 4px;
    }
 
    /* ── Invoice table ── */
    .table-wrap {
      padding: 0 28px;
      margin-top: 16px;
    }
 
    table {
      width: 100%;
      border-collapse: collapse;
    }
 
    thead tr {
      background: #2c2c2c;
      color: #fff;
    }
    thead th {
      padding: 9px 10px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }
    thead th:first-child  { text-align: left;   width: 44%; }
    thead th:nth-child(2) { text-align: center; width: 14%; }
    thead th:nth-child(3) { text-align: right;  width: 20%; }
    thead th:nth-child(4) { text-align: right;  width: 22%; }
 
    tbody tr { border-bottom: 1px solid #d9e4f5; }
    .row-even { background: #fff; }
    .row-odd  { background: #f7f9fd; }
 
    .td-desc   { padding: 9px 10px; font-size: 12.5px; min-height: 32px; }
    .td-center { text-align: center; padding: 9px 6px; font-size: 12.5px; }
    .td-right  { text-align: right;  padding: 9px 10px; font-size: 12.5px; }
    .td-amount { font-weight: 700; }
 
    /* ── Totals ── */
    .totals-wrap {
      padding: 10px 28px 0;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 5px;
    }
    .total-row {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 32px;
      width: 280px;
    }
    .total-row + .total-row {
      border-top: 1.5px solid #111;
      padding-top: 5px;
    }
    .total-label {
      font-size: 13px;
      font-weight: 700;
      color: #444;
      min-width: 80px;
    }
    .total-label.grand { font-size: 14px; color: #111; }
    .total-value {
      font-size: 13px;
      font-weight: 800;
      color: #111;
      text-align: right;
      min-width: 100px;
    }
    .total-value.grand { font-size: 15px; }
 
    /* ── QR block ── */
    .qr-section {
      margin: 14px 28px 0;
      border: 1px dashed #b0b0b0;
      padding: 12px 16px 10px;
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .qr-section svg { width: 90px; height: 90px; flex-shrink: 0; }
    .qr-text {
      font-size: 11px;
      color: #555;
      line-height: 1.5;
    }
    .qr-text strong { color: #111; }
 
    /* ── Signature grid ── */
    .sig-grid {
      position: relative;
      z-index: 1;
      margin: 20px 28px 0;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0 40px;
    }
    .sig-block { text-align: center; }
    .sig-line {
      border-top: 1.5px solid #fff;
      margin-bottom: 5px;
    }
    .sig-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #fff;
    }
 
    /* ── Footnote ── */
    .footnote {
      margin: 14px 28px 0;
      font-size: 10px;
      color: #888;
      text-align: center;
    }
 
    @media print {
      body { background: #fff; padding: 0; }
      .sheet { max-width: none; }
    }
  </style>
</head>
<body>
<main class="sheet">
 
  <!-- ═══ HEADER ═══ -->
  <header class="header">
    <div class="logo-wrap">
      <div class="logo-icon"></div>
      <div class="brand-text">
        <div class="brand-name">
          <span class="brand-cpr">CPR</span><span class="brand-med">Med</span>
        </div>
        <div class="brand-tagline">Center for Prime Response</div>
      </div>
    </div>
 
    <!-- ECG pulse SVG -->
    <div class="ecg-wrap">
      <svg viewBox="0 0 260 36" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
        <polyline
          points="0,18 30,18 40,18 45,6 50,30 55,4 60,32 65,18 80,18 110,18 120,18 125,8 130,28 135,4 140,30 145,18 160,18 190,18 200,18 205,8 210,28 215,4 220,30 225,18 260,18"
          fill="none"
          stroke="#4caf50"
          stroke-width="2"
          stroke-linejoin="round"
          stroke-linecap="round"
        />
      </svg>
    </div>
 
    <div class="header-right">
      <div class="invoice-label">Billing Invoice</div>
      <div class="invoice-number">${input.invoice.invoiceNumber}</div>
    </div>
  </header>
 
  <!-- ═══ META BAND ═══ -->
  <div class="meta-band">
    <div>
      <div class="meta-label">Date</div>
      <div class="meta-value">${createdAt.toLocaleDateString('en-PH')}</div>
    </div>
    <div>
      <div class="meta-label">Billed To</div>
      <div class="meta-value patient-name">${input.patientName}</div>
    </div>
    <div>
      <div class="meta-label">Status</div>
      <span class="status-badge ${statusClass}">${paymentStatusLabel}</span>
    </div>
  </div>
 
  <!-- ═══ ITEMS TABLE ═══ -->
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th>Qty.</th>
          <th>Price</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>
  </div>
 
  <!-- ═══ TOTALS ═══ -->
  <div class="totals-wrap">
    <div class="total-row">
      <span class="total-label">Subtotal</span>
      <span class="total-value">${formatCurrency(input.invoice.subtotal)}</span>
    </div>
    <div class="total-row">
      <span class="total-label grand">Total:</span>
      <span class="total-value grand">${formatCurrency(input.invoice.total)}</span>
    </div>
  </div>
 
  ${
    input.qrSvgMarkup
      ? `<!-- ═══ QR ═══ -->
  <div class="qr-section">
    ${input.qrSvgMarkup}
    <div class="qr-text">
      <strong>Payment Verification QR Code</strong><br/>
      ${input.qrHelperText ?? 'Present this QR code to clinic staff for verification.'}
    </div>
  </div>`
      : ''
  }
 
  <p class="footnote">
    This invoice is generated from the CPRMed system and reflects the billing summary and payment status saved in the clinic database.
  </p>
 
  <!-- ═══ SIGNATURE STRIP (sits on green wave) ═══ -->
  <div class="sig-grid">
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-label">Doctor Assigned</div>
    </div>
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-label">Receptionist</div>
    </div>
  </div>
 
</main>
</body>
</html>`;
}

export function BillingPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: clinicSettings } = useClinicSettingsData();
  const { profile } = useAuth();
  const bookingEnabled = isModuleEnabled('booking_appointments', clinicSettings?.enabledModules);
  const laboratoryEnabled = isModuleEnabled('laboratory', clinicSettings?.enabledModules);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isPayServiceModalOpen, setIsPayServiceModalOpen] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [feedbackModal, setFeedbackModal] = useState<FeedbackModalState>({
    open: false,
    title: '',
    message: '',
    variant: 'success',
  });
  const [labReceiptState, setLabReceiptState] = useState<LabReceiptState>({
    open: false,
    invoice: null,
    request: null,
    patientName: '',
  });
  const [invoiceViewState, setInvoiceViewState] = useState<InvoiceViewState>({
    open: false,
    invoiceId: null,
  });
  const deferredSearch = useDeferredValue(search);

  const { data: patients = [] } = useQuery({
    queryKey: queryKeys.patients,
    queryFn: async () => listPatientsLiveOrDemo(),
  });

  const { data: bookings = [] } = useQuery({
    queryKey: queryKeys.bookings,
    queryFn: async () => listBookingsLiveOrDemo(),
  });

  const { data: invoices = [] } = useQuery({
    queryKey: queryKeys.invoices,
    queryFn: async () => listInvoicesLiveOrDemo(),
  });

  const { data: invoiceItems = [] } = useQuery({
    queryKey: queryKeys.invoiceItems,
    queryFn: async () => listInvoiceItemsLiveOrDemo(),
  });

  const { data: labServiceOptions = [] } = useQuery({
    queryKey: ['lab-request-services'],
    queryFn: async () => {
      if (!isSupabaseConfigured || !supabase) {
        return getDatabase().labServices
          .slice()
          .sort((left, right) => left.name.localeCompare(right.name))
          .map((service) => ({
            id: service.id,
            clinicId: null,
            name: service.name,
            description: service.description,
            category: service.category,
            serviceFee: service.price,
          })) satisfies LabServiceOption[];
      }

      const { data, error } = await supabase
        .from('medical_services')
        .select('id, clinic_id, name, description, category, service_fee')
        .eq('department', 'Laboratory')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) {
        throw error;
      }

      return ((data ?? []) as Array<{
        id: string;
        clinic_id: string | null;
        name: string;
        description: string | null;
        category: string;
        service_fee: number;
      }>).map((service) => ({
        id: service.id,
        clinicId: service.clinic_id,
        name: service.name,
        description: service.description,
        category: service.category,
        serviceFee: Number(service.service_fee ?? 0),
      }));
    },
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async (values: BillingFormValues) => {
      const total = values.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      const taggedBooking = bookings.find((booking) => booking.id === values.bookingId) ?? null;
      return createInvoiceLiveOrDemo(
        {
          patientId: values.patientId,
          appointmentId: taggedBooking?.appointmentId ?? null,
          invoiceNumber: `INV-${Date.now()}`,
          paymentStatus: 'unpaid',
          subtotal: total,
          total,
        },
        values.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          category: item.category,
        })),
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoices });
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoiceItems });
    },
  });

  const updateInvoiceMutation = useMutation({
    mutationFn: async ({ invoiceId, values }: { invoiceId: string; values: BillingFormValues }) => {
      const total = values.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      const taggedBooking = bookings.find((booking) => booking.id === values.bookingId) ?? null;
      return updateInvoiceLiveOrDemo(
        invoiceId,
        {
          patientId: values.patientId,
          appointmentId: taggedBooking?.appointmentId ?? null,
          invoiceNumber: invoices.find((invoice) => invoice.id === invoiceId)?.invoiceNumber ?? `INV-${Date.now()}`,
          paymentStatus: 'unpaid',
          subtotal: total,
          total,
        },
        values.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          category: item.category,
        })),
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoices });
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoiceItems });
    },
  });

  const deleteInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: string) => deleteInvoiceLiveOrDemo(invoiceId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoices });
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoiceItems });
    },
  });

  const payForServiceMutation = useMutation({
    mutationFn: async (values: PayForServiceFormValues) => {
      if (!profile?.id) {
        throw new Error('You must be signed in to record a paid lab service.');
      }

      const selectedService = labServiceOptions.find((service) => service.id === values.serviceId) ?? null;
      if (!selectedService) {
        throw new Error('The selected laboratory service could not be found.');
      }

      const amount = Number(selectedService.serviceFee ?? 0);
      if (amount <= 0) {
        throw new Error('The selected laboratory service does not have a valid service fee yet.');
      }

      const patient = patients.find((entry) => entry.id === values.patientId) ?? null;
      let createdInvoice: Invoice | null = null;

      try {
        createdInvoice = await createInvoiceLiveOrDemo(
          {
            patientId: values.patientId,
            appointmentId: null,
            invoiceNumber: `INV-LAB-${Date.now()}`,
            paymentStatus: 'paid',
            subtotal: amount,
            total: amount,
          },
          [
            {
              description: selectedService.name,
              quantity: 1,
              unitPrice: amount,
              category: 'laboratory',
            },
          ],
        );

        let request: LabRequestRecord;
        if (!isSupabaseConfigured || !supabase) {
          const { createLabOrder } = await import('../../lib/local-db');
          const order = createLabOrder({
            patientId: values.patientId,
            appointmentId: null,
            labServiceId: selectedService.id,
            requestedBy: profile.id,
            status: 'requested',
            notes: values.notes?.trim() || '',
            urgentFlag: values.urgentFlag,
            schedDate: null,
            schedTime: null,
          });

          request = {
            id: order.id,
            clinicId: '',
            clinicName: null,
            appointmentId: null,
            patientId: values.patientId,
            patientName: patient ? `${patient.firstName} ${patient.lastName}` : null,
            requestedBy: profile.id,
            requestedByName: profile.fullName,
            serviceId: selectedService.id,
            serviceName: selectedService.name,
            serviceCategory: selectedService.category,
            department: 'Laboratory',
            transactionType: 'cashier_paid_service',
            paymentStatus: 'paid',
            receiptCode: createdInvoice.invoiceNumber,
            status: 'pending',
            sampleStatus: 'pending',
            resultStatus: 'pending',
            patientNotes: values.notes?.trim() || null,
            resultData: null,
            resultNotes: null,
            urgentFlag: values.urgentFlag,
            completedBy: null,
            completedByName: null,
            completedAt: null,
            media: [],
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
          };
        } else {
          const createdRequest = await labRequestService.createRequest({
            clinicId: selectedService.clinicId,
            patientId: values.patientId,
            requestedBy: profile.id,
            appointmentId: null,
            serviceId: selectedService.id,
            serviceCategory: selectedService.category,
            patientNotes: values.notes?.trim() || '',
            urgentFlag: values.urgentFlag,
            transactionType: 'cashier_paid_service',
          });

          if (!createdRequest) {
            throw new Error('The lab request was not returned after payment.');
          }

          request =
            (await labRequestService.markRequestAsPaid(createdRequest.id, createdRequest.receiptCode ?? null)) ??
            createdRequest;
        }

        return {
          invoice: createdInvoice,
          request,
          patientName: patient ? `${patient.firstName} ${patient.lastName}` : 'Patient',
        };
      } catch (error) {
        if (createdInvoice) {
          await deleteInvoiceLiveOrDemo(createdInvoice.id).catch(() => undefined);
        }
        throw error;
      }
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoices });
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoiceItems });
      await queryClient.invalidateQueries({ queryKey: ['lab-queue'] });
      await queryClient.invalidateQueries({ queryKey: ['lab-request', result.request.id] });
      setLabReceiptState({
        open: true,
        invoice: result.invoice,
        request: result.request,
        patientName: result.patientName,
      });
    },
  });

  const form = useForm<BillingFormValues>({
    resolver: zodResolver(billingSchema),
    defaultValues: {
      patientId: patients[0]?.id ?? '',
      bookingId: '',
      items: [
        {
          description: 'General Consultation',
          category: 'consultation',
          quantity: 1,
          unitPrice: 800,
        },
      ],
    },
  });
  const itemsFieldArray = useFieldArray({ control: form.control, name: 'items' });

  const payServiceForm = useForm<PayForServiceFormValues>({
    resolver: zodResolver(payForServiceSchema),
    defaultValues: {
      patientId: patients[0]?.id ?? '',
      serviceId: '',
      notes: '',
      urgentFlag: false,
    },
  });

  const selectedBookingId = form.watch('bookingId');
  const selectedBooking = bookings.find((booking) => booking.id === selectedBookingId) ?? null;
  const selectedLabServiceId = payServiceForm.watch('serviceId');
  const selectedLabService = labServiceOptions.find((service) => service.id === selectedLabServiceId) ?? null;

  const filteredInvoices = useMemo(
    () =>
      invoices.filter((invoice) => {
        const patient = patients.find((item) => item.id === invoice.patientId);
        return `${invoice.invoiceNumber} ${patient?.firstName ?? ''} ${patient?.lastName ?? ''} ${invoice.paymentStatus}`
          .toLowerCase()
          .includes(deferredSearch.toLowerCase());
      }),
    [deferredSearch, invoices, patients],
  );
  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / BILLING_PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * BILLING_PAGE_SIZE;
  const paginatedInvoices = useMemo(
    () => filteredInvoices.slice(pageStart, pageStart + BILLING_PAGE_SIZE),
    [filteredInvoices, pageStart],
  );
  const showingStart = filteredInvoices.length === 0 ? 0 : pageStart + 1;
  const showingEnd =
    filteredInvoices.length === 0
      ? 0
      : Math.min(pageStart + BILLING_PAGE_SIZE, filteredInvoices.length);
  const viewedInvoice = invoices.find((invoice) => invoice.id === invoiceViewState.invoiceId) ?? null;
  const viewedInvoiceItems = invoiceItems.filter((item) => item.invoiceId === invoiceViewState.invoiceId);
  const viewedInvoiceItem = viewedInvoiceItems[0] ?? null;
  const viewedInvoicePatient = patients.find((patient) => patient.id === viewedInvoice?.patientId) ?? null;
  const viewedInvoiceLabItem = viewedInvoiceItems.find((item) => item.category === 'laboratory') ?? viewedInvoiceItem;

  useEffect(() => {
    const invoiceIdFromQuery = (searchParams.get('invoiceId') ?? '').trim();
    if (!invoiceIdFromQuery || invoices.length === 0) {
      return;
    }

    const matchedInvoice = invoices.find((invoice) => invoice.id === invoiceIdFromQuery);
    if (!matchedInvoice) {
      return;
    }

    setInvoiceViewState({
      open: true,
      invoiceId: matchedInvoice.id,
    });

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('invoiceId');
    setSearchParams(nextParams, { replace: true });
  }, [invoices, searchParams, setSearchParams]);

  useEffect(() => {
    if (form.getValues('patientId') || patients.length === 0) {
      return;
    }

    form.setValue('patientId', patients[0]?.id ?? '');
  }, [form, patients]);

  useEffect(() => {
    if (payServiceForm.getValues('patientId') || patients.length === 0) {
      return;
    }

    payServiceForm.setValue('patientId', patients[0]?.id ?? '');
  }, [patients, payServiceForm]);

  useEffect(() => {
    if (payServiceForm.getValues('serviceId') || labServiceOptions.length === 0) {
      return;
    }

    payServiceForm.setValue('serviceId', labServiceOptions[0]?.id ?? '');
  }, [labServiceOptions, payServiceForm]);

  useEffect(() => {
    if (!isInvoiceModalOpen && !isPayServiceModalOpen && !invoiceViewState.open) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsInvoiceModalOpen(false);
        setIsPayServiceModalOpen(false);
        setInvoiceViewState({
          open: false,
          invoiceId: null,
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [invoiceViewState.open, isInvoiceModalOpen, isPayServiceModalOpen]);

  const openCreateModal = () => {
    form.reset({
      patientId: patients[0]?.id ?? '',
      bookingId: '',
      items: [
        {
          description: 'General Consultation',
          category: 'consultation',
          quantity: 1,
          unitPrice: 800,
        },
      ],
    });
    setEditingInvoiceId(null);
    setIsInvoiceModalOpen(true);
  };

  const openPayForServiceModal = () => {
    payServiceForm.reset({
      patientId: patients[0]?.id ?? '',
      serviceId: labServiceOptions[0]?.id ?? '',
      notes: '',
      urgentFlag: false,
    });
    setIsPayServiceModalOpen(true);
  };

  const openEditModal = (invoiceId: string) => {
    const invoice = invoices.find((entry) => entry.id === invoiceId);
    const items = invoiceItems.filter((entry) => entry.invoiceId === invoiceId);
    if (!invoice || items.length === 0) {
      return;
    }

    form.reset({
      patientId: invoice.patientId,
      bookingId: '',
      items: items.map((item) => ({
        description: item.description,
        category: item.category,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
    });
    setEditingInvoiceId(invoiceId);
    setIsInvoiceModalOpen(true);
  };

  const openViewModal = (invoiceId: string) => {
    setInvoiceViewState({
      open: true,
      invoiceId,
    });
  };

  const closeInvoiceModal = () => {
    setEditingInvoiceId(null);
    setIsInvoiceModalOpen(false);
  };

  const closePayForServiceModal = () => {
    setIsPayServiceModalOpen(false);
  };

  const closeInvoiceViewModal = () => {
    setInvoiceViewState({
      open: false,
      invoiceId: null,
    });
  };

  const closeFeedbackModal = () => {
    setFeedbackModal((currentState) => ({
      ...currentState,
      open: false,
    }));
  };

  const closeLabReceiptModal = () => {
    setLabReceiptState({
      open: false,
      invoice: null,
      request: null,
      patientName: '',
    });
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (editingInvoiceId) {
        await updateInvoiceMutation.mutateAsync({ invoiceId: editingInvoiceId, values });
        setFeedbackModal({
          open: true,
          title: 'Invoice updated',
          message: 'The invoice details were updated successfully.',
          variant: 'success',
        });
      } else {
        await createInvoiceMutation.mutateAsync(values);
        setFeedbackModal({
          open: true,
          title: 'Invoice created',
          message: 'The invoice has been added successfully.',
          variant: 'success',
        });
      }

      closeInvoiceModal();
    } catch (error) {
      setFeedbackModal({
        open: true,
        title: editingInvoiceId ? 'Unable to update invoice' : 'Unable to create invoice',
        message: error instanceof Error ? error.message : 'Something went wrong while saving the invoice.',
        variant: 'error',
      });
    }
  });

  const handleDeleteInvoice = async (invoiceId: string) => {
    const isConfirmed = window.confirm('Delete this invoice from billing records?');
    if (!isConfirmed) {
      return;
    }

    try {
      await deleteInvoiceMutation.mutateAsync(invoiceId);
      setFeedbackModal({
        open: true,
        title: 'Invoice deleted',
        message: 'The invoice was removed successfully.',
        variant: 'success',
      });
    } catch (error) {
      setFeedbackModal({
        open: true,
        title: 'Unable to delete invoice',
        message: error instanceof Error ? error.message : 'Something went wrong while deleting the invoice.',
        variant: 'error',
      });
    }
  };

  const onSubmitPaidService = payServiceForm.handleSubmit(async (values) => {
    try {
      await payForServiceMutation.mutateAsync(values);
      setFeedbackModal({
        open: true,
        title: 'Lab service paid',
        message: 'Payment was recorded, the lab request was created, and the receipt is ready to print.',
        variant: 'success',
      });
      closePayForServiceModal();
    } catch (error) {
      setFeedbackModal({
        open: true,
        title: 'Unable to pay for service',
        message: error instanceof Error ? error.message : 'Something went wrong while recording the paid laboratory service.',
        variant: 'error',
      });
    }
  });

  const handleOpenInvoiceOutput = async () => {
    if (!viewedInvoice) {
      toast.error('No invoice is selected for printing.');
      return;
    }

    let relatedRequest: LabRequestRecord | null = null;

    if (viewedInvoice.paymentStatus === 'paid' && viewedInvoiceLabItem?.category === 'laboratory') {
      try {
        if (!isSupabaseConfigured || !supabase) {
          const database = getDatabase();
          const matchedService = database.labServices.find((service) => service.name === viewedInvoiceLabItem.description) ?? null;
          const matchingOrders = database.labOrders
            .filter((order) => order.patientId === viewedInvoice.patientId)
            .filter((order) => (matchedService ? order.labServiceId === matchedService.id : true))
            .sort(
              (left, right) =>
                Math.abs(new Date(left.createdAt).getTime() - new Date(viewedInvoice.createdAt).getTime()) -
                Math.abs(new Date(right.createdAt).getTime() - new Date(viewedInvoice.createdAt).getTime()),
            );

          const order = matchingOrders[0] ?? null;
          if (order) {
            const service = database.labServices.find((entry) => entry.id === order.labServiceId) ?? null;
            relatedRequest = {
              id: order.id,
              clinicId: '',
              clinicName: null,
              appointmentId: order.appointmentId ?? null,
              patientId: order.patientId,
              patientName: viewedInvoicePatient ? `${viewedInvoicePatient.firstName} ${viewedInvoicePatient.lastName}` : null,
              requestedBy: order.requestedBy,
              requestedByName: null,
              serviceId: order.labServiceId,
              serviceName: service?.name ?? viewedInvoiceLabItem.description,
              serviceCategory: service?.category ?? 'laboratory',
              department: 'Laboratory',
              transactionType: 'cashier_paid_service',
              status: order.status === 'released' ? 'completed' : 'pending',
              sampleStatus: order.status === 'processing' || order.status === 'ready' || order.status === 'released' ? 'processing' : 'pending',
              resultStatus: order.status === 'released' ? 'completed' : 'pending',
              patientNotes: order.notes || null,
              resultData: null,
              resultNotes: null,
              urgentFlag: Boolean(order.urgentFlag),
              completedBy: null,
              completedByName: null,
              completedAt: null,
              media: [],
              createdAt: order.createdAt,
              updatedAt: order.updatedAt,
            };
          }
        } else {
          const patientRequests = await labRequestService.getPatientRequests(viewedInvoice.patientId);
          const matchingRequests = patientRequests
            .filter((request) => request.department === 'Laboratory')
            .filter((request) => request.transactionType === 'cashier_paid_service')
            .filter((request) => {
              if (request.serviceName) {
                return request.serviceName === viewedInvoiceLabItem.description;
              }

              return request.serviceCategory.toLowerCase() === viewedInvoiceLabItem.category.toLowerCase();
            })
            .sort(
              (left, right) =>
                Math.abs(new Date(left.createdAt).getTime() - new Date(viewedInvoice.createdAt).getTime()) -
                Math.abs(new Date(right.createdAt).getTime() - new Date(viewedInvoice.createdAt).getTime()),
            );

          relatedRequest = matchingRequests[0] ?? null;
        }
      } catch {
        relatedRequest = null;
      }
    }

    let qrSvgMarkup = '';
    if (relatedRequest) {
      qrSvgMarkup = await QRCode.toString(buildLabServiceReceiptLookupUrl(relatedRequest.id), {
        errorCorrectionLevel: 'M',
        margin: 1,
        type: 'svg',
        width: 220,
      });
    }

    await printHtmlDocument(
      buildInvoicePrintDocument({
        clinicName: clinicSettings?.clinicName ?? 'Clinic',
        invoice: viewedInvoice,
        patientName: viewedInvoicePatient
          ? `${viewedInvoicePatient.firstName} ${viewedInvoicePatient.lastName}`
          : 'Unknown patient',
        patientContact: viewedInvoicePatient?.email || viewedInvoicePatient?.mobileNumber || '',
        items: viewedInvoiceItems,
        qrSvgMarkup,
        qrHelperText: relatedRequest
          ? 'Clinic or laboratory staff can scan this QR code to open the linked request and proceed with the test.'
          : undefined,
      }),
    );
  };

  const handlePrintViewedInvoice = () => {
    void handleOpenInvoiceOutput().catch(() => {
      toast.error('The invoice could not be sent to the print dialog.');
    });
  };

  const handleSaveViewedInvoiceAsPdf = () => {
    toast.message('When the print dialog opens, choose "Save as PDF" as the destination.');
    void handleOpenInvoiceOutput().catch(() => {
      toast.error('The invoice could not be prepared for PDF saving.');
    });
  };

  return (
    <>
      <div className="space-y-6">
        <div className="border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="shrink-0 bg-emerald-600 p-2.5 text-white">
                <Coins className="size-5" />
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-emerald-600">Billing</p>
                <h1 className="text-xl font-extrabold tracking-tight text-slate-950">Billing and Receipts</h1>
                <p className="mt-1 text-sm text-slate-500">Manage invoices in a table view and create new ones from a modal form.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {bookingEnabled ? (
                <Link className="inline-flex items-center justify-center border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50" to="/app/bookings/scan">
                  <Receipt className="mr-2 size-4" />
                  Scan booking receipt
                </Link>
              ) : null}
              {laboratoryEnabled ? (
                <Link className="inline-flex items-center justify-center border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50" to="/app/laboratory/scan">
                  <ScanLine className="mr-2 size-4" />
                  Scan lab receipt
                </Link>
              ) : null}
              <Button className="rounded-none border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-extrabold uppercase tracking-widest text-violet-800 hover:bg-violet-100" onClick={openPayForServiceModal}>
                <TestTube2 className="mr-2 size-4" />
                Pay for service
              </Button>
              <Button className="rounded-none bg-emerald-600 px-4 py-2.5 text-sm font-extrabold uppercase tracking-widest hover:bg-emerald-700" onClick={openCreateModal}>
                <Plus className="mr-2 size-4" />
                New invoice
              </Button>
              <div className="flex w-full max-w-sm items-center gap-2 border border-slate-200 bg-slate-50 px-4 py-2.5">
                <Search className="size-4 shrink-0 text-slate-400" />
                <input
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search invoice, patient, or payment status"
                  value={search}
                />
              </div>
            </div>
          </div>
          <div className="border-t border-slate-100 bg-slate-50 px-6 py-2">
            <span className="text-xs font-bold text-slate-500">{filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? 's' : ''} found</span>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="rounded-none border-violet-200 bg-violet-50/50">
            <p className="text-xs font-extrabold uppercase tracking-widest text-violet-700">Lab Service Payment</p>
            <CardTitle className="mt-2">Cashier shortcut for laboratory services</CardTitle>
            <p className="mt-2 text-sm text-slate-600">
              Use <span className="font-semibold text-slate-900">Pay for service</span> to fetch the live laboratory service fee, mark the invoice as paid, create the lab request, and print a QR receipt for staff scanning.
            </p>
            <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
              <div className="rounded-2xl border border-violet-200 bg-white px-4 py-3">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Live source</p>
                <p className="mt-1 font-semibold text-slate-950">Laboratory services and fees come from the lab catalog.</p>
              </div>
              <div className="rounded-2xl border border-violet-200 bg-white px-4 py-3">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Receipt flow</p>
                <p className="mt-1 font-semibold text-slate-950">The printed QR opens the exact paid lab request for intake or processing.</p>
              </div>
            </div>
          </Card>

          {labReceiptState.open && labReceiptState.invoice && labReceiptState.request ? (
            <div className="space-y-3">
              <LabServiceReceiptCard
                invoice={labReceiptState.invoice}
                patientName={labReceiptState.patientName}
                request={labReceiptState.request}
              />
              <Button className="w-full rounded-none" onClick={closeLabReceiptModal} type="button" variant="secondary">
                Close receipt preview
              </Button>
            </div>
          ) : (
            <Card className="rounded-none border-dashed border-slate-300 bg-slate-50">
              <p className="text-xs font-extrabold uppercase tracking-widest text-slate-400">Receipt Preview</p>
              <CardTitle className="mt-2">Paid laboratory receipts will appear here</CardTitle>
              <p className="mt-2 text-sm text-slate-500">
                After a cashier records a lab-service payment, the printable QR receipt will open in this panel.
              </p>
            </Card>
          )}
        </div>

        <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Invoice</th>
                  <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Patient</th>
                  <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Status</th>
                  <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Total</th>
                  <th className="px-6 py-3 text-right text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td className="px-6 py-12 text-center text-sm text-slate-400" colSpan={5}>
                      No invoices created yet.
                    </td>
                  </tr>
                ) : (
                  paginatedInvoices.map((invoice) => {
                    const patient = patients.find((item) => item.id === invoice.patientId);

                    return (
                      <tr className="transition-colors hover:bg-slate-50" key={invoice.id}>
                        <td className="px-6 py-4 align-top">
                          <div className="space-y-1">
                            <p className="font-bold text-slate-950">{invoice.invoiceNumber}</p>
                            <p className="text-xs text-slate-500">Invoice ID {invoice.id}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 align-top text-sm text-slate-600">
                          {patient?.firstName} {patient?.lastName}
                        </td>
                        <td className="px-6 py-4 align-top">
                          <PaymentBadge status={invoice.paymentStatus} />
                        </td>
                        <td className="px-6 py-4 align-top text-sm font-bold text-slate-950">{formatCurrency(invoice.total)}</td>
                        <td className="px-6 py-4 align-top">
                          <div className="flex min-w-max items-center justify-end gap-3 whitespace-nowrap text-xs font-extrabold uppercase tracking-widest">
                            <button className="inline-flex items-center gap-1 text-emerald-700 hover:underline" onClick={() => openViewModal(invoice.id)} type="button">
                              <Eye className="size-3.5" />
                              View
                            </button>
                            <button className="inline-flex items-center gap-1 text-slate-600 hover:underline" onClick={() => openEditModal(invoice.id)} type="button">
                              <Pencil className="size-3.5" />
                              Edit
                            </button>
                            <button className="inline-flex items-center gap-1 text-rose-600 hover:underline" onClick={() => void handleDeleteInvoice(invoice.id)} type="button">
                              <Trash2 className="size-3.5" />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {filteredInvoices.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-3">
              <p className="text-xs font-semibold text-slate-500">
                Showing {showingStart}-{showingEnd} of {filteredInvoices.length} invoices
              </p>
              <div className="flex items-center gap-2">
                <Button
                  className="rounded-none px-3 py-1 text-xs font-bold uppercase tracking-wide"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  type="button"
                  variant="secondary"
                >
                  Previous
                </Button>
                <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  Page {safeCurrentPage} of {totalPages}
                </span>
                <Button
                  className="rounded-none px-3 py-1 text-xs font-bold uppercase tracking-wide"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  type="button"
                  variant="secondary"
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {isInvoiceModalOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4 sm:p-6"
          onClick={closeInvoiceModal}
          role="dialog"
        >
          <div
            className="my-auto flex w-full max-w-2xl flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl max-h-[85vh] sm:max-h-[80vh]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 bg-emerald-600 px-4 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-xs font-extrabold uppercase tracking-widest text-emerald-100">Invoice Form</p>
                <p className="mt-0.5 text-sm font-bold text-white">{editingInvoiceId ? 'Edit Invoice' : 'Create Invoice'}</p>
                <p className="mt-2 max-w-2xl text-sm text-emerald-50">Create or update billing entries from this modal form.</p>
              </div>
              <button
                aria-label="Close invoice modal"
                className="inline-flex shrink-0 items-center justify-center border border-emerald-300/40 bg-white/10 p-2 text-white transition hover:bg-white/20"
                onClick={closeInvoiceModal}
                type="button"
              >
                <X className="size-4" />
              </button>
            </div>

            <form className="flex min-h-0 flex-1 flex-col" onSubmit={onSubmit}>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="space-y-4 px-4 py-5 sm:px-6">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Patient</p>
                  <FormField error={form.formState.errors.patientId?.message} label="Select patient">
                    <Select {...form.register('patientId')}>
                      {patients.map((patient) => (
                        <option key={patient.id} value={patient.id}>
                          {patient.firstName} {patient.lastName}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label="Tag from booking">
                    <Select
                      {...form.register('bookingId')}
                      onChange={(event) => {
                        const booking = bookings.find((item) => item.id === event.target.value) ?? null;
                        form.setValue('bookingId', event.target.value);
                        if (!booking) {
                          form.setValue('items', [
                            {
                              description: 'General Consultation',
                              category: 'consultation',
                              quantity: 1,
                              unitPrice: 800,
                            },
                          ]);
                          return;
                        }

                        form.setValue('patientId', booking.patientId);
                        form.setValue('items', [
                          {
                            description: booking.feeType === 'follow_up' ? 'Follow-up Consultation' : 'Consultation Fee',
                            category: 'consultation',
                            quantity: 1,
                            unitPrice: booking.feeAmount,
                          },
                        ]);
                      }}
                    >
                      <option value="">Manual entry</option>
                      {bookings.map((booking) => {
                        const patient = patients.find((item) => item.id === booking.patientId);
                        return (
                          <option key={booking.id} value={booking.id}>
                            {patient?.firstName} {patient?.lastName} - {booking.feeType === 'follow_up' ? 'Follow-up' : 'Consultation'}
                          </option>
                        );
                      })}
                    </Select>
                  </FormField>
                  {selectedBooking ? <p className="text-xs text-slate-500">Tagged booking amount: {formatCurrency(selectedBooking.feeAmount)}</p> : null}
                </div>

                <div className="space-y-4 border-t border-slate-100 px-4 py-5 sm:px-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Line items</p>
                      <p className="text-sm text-slate-500">Add one or more billing entries to match the printed invoice layout.</p>
                    </div>
                    <Button
                      className="rounded-none border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-slate-700 hover:bg-slate-100"
                      onClick={() =>
                        itemsFieldArray.append({
                          description: 'New service',
                          category: 'other',
                          quantity: 1,
                          unitPrice: 0,
                        })
                      }
                      type="button"
                      variant="secondary"
                    >
                      Add line item
                    </Button>
                  </div>

                  {itemsFieldArray.fields.map((field, index) => (
                    <div key={field.id} className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-900">Item {index + 1}</p>
                        {itemsFieldArray.fields.length > 1 ? (
                          <button
                            className="text-xs font-semibold uppercase tracking-widest text-rose-600 hover:text-rose-700"
                            onClick={() => itemsFieldArray.remove(index)}
                            type="button"
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                      <div className="grid gap-4 md:grid-cols-4">
                        <FormField
                          error={form.formState.errors.items?.[index]?.description?.message}
                          label="Description"
                        >
                          <Input {...form.register(`items.${index}.description` as const)} />
                        </FormField>
                        <FormField error={form.formState.errors.items?.[index]?.category?.message} label="Category">
                          <Select {...form.register(`items.${index}.category` as const)}>
                            <option value="consultation">Consultation</option>
                            <option value="laboratory">Laboratory</option>
                            <option value="medicine">Medicine</option>
                            <option value="other">Other</option>
                          </Select>
                        </FormField>
                        <FormField error={form.formState.errors.items?.[index]?.quantity?.message} label="Qty">
                          <Input type="number" {...form.register(`items.${index}.quantity` as const, { valueAsNumber: true })} />
                        </FormField>
                        <FormField error={form.formState.errors.items?.[index]?.unitPrice?.message} label="Unit price">
                          <Input type="number" {...form.register(`items.${index}.unitPrice` as const, { valueAsNumber: true })} />
                        </FormField>
                      </div>
                      <p className="text-sm font-semibold text-slate-700">
                        Amount: {formatCurrency((form.getValues(`items.${index}.quantity`) ?? 0) * (form.getValues(`items.${index}.unitPrice`) ?? 0))}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
                <Button className="w-full rounded-none sm:w-auto" onClick={closeInvoiceModal} type="button" variant="secondary">
                  Cancel
                </Button>
                <Button
                  className="w-full rounded-none bg-emerald-600 px-5 py-3 text-sm font-extrabold uppercase tracking-widest hover:bg-emerald-700 sm:w-auto"
                  disabled={createInvoiceMutation.isPending || updateInvoiceMutation.isPending}
                  type="submit"
                >
                  {createInvoiceMutation.isPending || updateInvoiceMutation.isPending
                    ? 'Saving...'
                    : editingInvoiceId
                      ? 'Save Invoice'
                      : 'Create Invoice'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isPayServiceModalOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4 sm:p-6"
          onClick={closePayForServiceModal}
          role="dialog"
        >
          <div
            className="my-auto flex w-full max-w-2xl flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl max-h-[85vh] sm:max-h-[80vh]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 bg-violet-700 px-4 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-xs font-extrabold uppercase tracking-widest text-violet-200">Paid Lab Service</p>
                <p className="mt-0.5 text-sm font-bold text-white">Pay for service</p>
                <p className="mt-2 max-w-2xl text-sm text-violet-50">Choose a patient and laboratory service. The system will use the live service fee, create the paid invoice, generate the lab request, and prepare a QR receipt.</p>
              </div>
              <button
                aria-label="Close paid service modal"
                className="inline-flex shrink-0 items-center justify-center border border-violet-300/40 bg-white/10 p-2 text-white transition hover:bg-white/20"
                onClick={closePayForServiceModal}
                type="button"
              >
                <X className="size-4" />
              </button>
            </div>

            <form className="flex min-h-0 flex-1 flex-col" onSubmit={onSubmitPaidService}>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="space-y-4 px-4 py-5 sm:px-6">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Patient</p>
                  <FormField error={payServiceForm.formState.errors.patientId?.message} label="Select patient">
                    <Select {...payServiceForm.register('patientId')}>
                      {patients.map((patient) => (
                        <option key={patient.id} value={patient.id}>
                          {patient.firstName} {patient.lastName}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </div>

                <div className="space-y-4 border-t border-slate-100 px-4 py-5 sm:px-6">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Laboratory Service</p>
                  <FormField error={payServiceForm.formState.errors.serviceId?.message} label="Lab service">
                    <Select {...payServiceForm.register('serviceId')} disabled={labServiceOptions.length === 0}>
                      <option value="">Select a laboratory service</option>
                      {labServiceOptions.map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.name} - {formatCurrency(service.serviceFee)}
                        </option>
                      ))}
                    </Select>
                  </FormField>

                  {selectedLabService ? (
                    <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-4 text-sm text-slate-700">
                      <p className="font-semibold text-slate-950">{selectedLabService.name}</p>
                      <p className="mt-1">{selectedLabService.description ?? 'No service description available.'}</p>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div>
                          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Category</p>
                          <p className="mt-1 font-semibold text-slate-950">{selectedLabService.category}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Declared fee</p>
                          <p className="mt-1 font-semibold text-violet-800">{formatCurrency(selectedLabService.serviceFee)}</p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <FormField error={payServiceForm.formState.errors.notes?.message} label="Lab notes">
                    <Textarea
                      placeholder="Optional intake or cashier notes for the laboratory team"
                      rows={3}
                      {...payServiceForm.register('notes')}
                    />
                  </FormField>

                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input className="accent-violet-700" type="checkbox" {...payServiceForm.register('urgentFlag')} />
                    Mark as urgent
                  </label>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
                <Button className="w-full rounded-none sm:w-auto" onClick={closePayForServiceModal} type="button" variant="secondary">
                  Cancel
                </Button>
                <Button
                  className="w-full rounded-none bg-violet-700 px-5 py-3 text-sm font-extrabold uppercase tracking-widest hover:bg-violet-800 sm:w-auto"
                  disabled={payForServiceMutation.isPending || labServiceOptions.length === 0}
                  type="submit"
                >
                  {payForServiceMutation.isPending ? 'Processing payment...' : 'Pay and print receipt'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {invoiceViewState.open && viewedInvoice ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4 sm:p-6"
          onClick={closeInvoiceViewModal}
          role="dialog"
        >
          <div
            className="my-auto flex w-full max-w-2xl flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 bg-slate-900 px-4 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-xs font-extrabold uppercase tracking-widest text-slate-300">Invoice Details</p>
                <p className="mt-0.5 text-sm font-bold text-white">{viewedInvoice.invoiceNumber}</p>
                <p className="mt-2 max-w-2xl text-sm text-slate-300">Review the invoice record, linked patient, line item, and totals from billing.</p>
              </div>
              <button
                aria-label="Close invoice details modal"
                className="inline-flex shrink-0 items-center justify-center border border-slate-500/40 bg-white/10 p-2 text-white transition hover:bg-white/20"
                onClick={closeInvoiceViewModal}
                type="button"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-5 px-4 py-5 sm:px-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Patient</p>
                  <p className="mt-2 text-base font-bold text-slate-950">
                    {viewedInvoicePatient ? `${viewedInvoicePatient.firstName} ${viewedInvoicePatient.lastName}` : 'Unknown patient'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">{viewedInvoicePatient?.email || viewedInvoicePatient?.mobileNumber || 'No contact info recorded'}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Payment Status</p>
                  <div className="mt-2">
                    <PaymentBadge status={viewedInvoice.paymentStatus} />
                  </div>
                  <p className="mt-3 text-sm text-slate-500">Created {new Date(viewedInvoice.createdAt).toLocaleString('en-PH')}</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Invoice Id</p>
                  <p className="mt-2 break-all font-mono text-sm font-semibold text-slate-950">{viewedInvoice.id}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Appointment Id</p>
                  <p className="mt-2 break-all font-mono text-sm font-semibold text-slate-950">{viewedInvoice.appointmentId || 'Not linked'}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Line Item</p>
                {viewedInvoiceItem ? (
                  <div className="mt-3 grid gap-4 md:grid-cols-4">
                    <div className="md:col-span-2">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Description</p>
                      <p className="mt-1 font-semibold text-slate-950">{viewedInvoiceItem.description}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Category</p>
                      <p className="mt-1 font-semibold text-slate-950">{viewedInvoiceItem.category}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Quantity</p>
                      <p className="mt-1 font-semibold text-slate-950">{viewedInvoiceItem.quantity}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Unit Price</p>
                      <p className="mt-1 font-semibold text-slate-950">{formatCurrency(viewedInvoiceItem.unitPrice)}</p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">No invoice item was found for this record.</p>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">Subtotal</p>
                  <p className="mt-2 text-lg font-extrabold text-emerald-950">{formatCurrency(viewedInvoice.subtotal)}</p>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">Total</p>
                  <p className="mt-2 text-lg font-extrabold text-emerald-950">{formatCurrency(viewedInvoice.total)}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
              <Button className="gap-2 rounded-none sm:w-auto" onClick={handleSaveViewedInvoiceAsPdf} type="button" variant="secondary">
                <Receipt className="size-4" />
                Save as PDF
              </Button>
              <Button className="gap-2 rounded-none sm:w-auto" onClick={handlePrintViewedInvoice} type="button">
                <Printer className="size-4" />
                Print receipt
              </Button>
              <Button className="rounded-none" onClick={closeInvoiceViewModal} type="button" variant="secondary">
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <FeedbackModal
        autoCloseMs={3000}
        message={feedbackModal.message}
        onClose={closeFeedbackModal}
        open={feedbackModal.open}
        title={feedbackModal.title}
        variant={feedbackModal.variant}
      />
    </>
  );
}
