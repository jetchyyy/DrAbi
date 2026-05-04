import { z } from 'zod';
import type { Invoice } from '../../../types/domain';
import type { LabRequestRecord } from '../lab-requests';

export const invoiceItemSchema = z.object({
  description: z.string().min(2, 'Description must be at least 2 characters.'),
  category: z.enum(['consultation', 'laboratory', 'medicine', 'other']),
  quantity: z.number().min(1, 'Quantity must be at least 1.'),
  unitPrice: z.number().min(1, 'Unit price must be at least 1.'),
});

export const billingSchema = z.object({
  patientId: z.string().min(1, 'Patient is required.'),
  bookingId: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1, 'At least one invoice item is required.'),
});

export const payForServiceSchema = z.object({
  patientId: z.string().min(1, 'Patient is required.'),
  serviceId: z.string().min(1, 'Laboratory service is required.'),
  notes: z.string().optional(),
  urgentFlag: z.boolean(),
});

export type BillingFormValues = z.infer<typeof billingSchema>;
export type PayForServiceFormValues = z.infer<typeof payForServiceSchema>;

export const BILLING_PAGE_SIZE = 10;

export interface LabServiceOption {
  id: string;
  clinicId: string | null;
  name: string;
  description: string | null;
  category: string;
  serviceFee: number;
}

export interface FeedbackModalState {
  open: boolean;
  title: string;
  message: string;
  variant: 'success' | 'error';
}

export interface LabReceiptState {
  open: boolean;
  invoice: Invoice | null;
  request: LabRequestRecord | null;
  patientName: string;
}

export interface InvoiceViewState {
  open: boolean;
  invoiceId: string | null;
}