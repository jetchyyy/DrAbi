import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-PH', {
    currency: 'PHP',
    style: 'currency',
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDateLabel(value: string) {
  return format(new Date(value), 'MMM d, yyyy');
}

export function formatDateTimeLabel(value: string) {
  return format(new Date(value), 'MMM d, yyyy h:mm a');
}

export function generateId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

export function generatePatientQrCode() {
  return `ODC-PAT-${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
}

export function generateInventoryQrCode() {
  return `ODC-INV-${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
}

export function generateBookingReceiptCode() {
  return `ODC-BKG-${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
}

export function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}





