# Prescription Template Changes

**File:** `src/features/patients/prescription-print-document.ts`

---

## Summary

The prescription print template was fully redesigned to match the physical CPRMED printed prescription form. Below is a record of all changes made.

---

## Changes

### Page Size
- Changed from **A5** to **A4 portrait** with `8mm` margins.

### Header Layout
- Replaced single-column layout with a **3-column flex row**:
  - **Left column** (128px): Clinic logo
  - **Center column** (flex: 1): Clinic name, subtitle, address, contact, specialties
  - **Right column** (210px): Clinic hours

### Logo
- Set to `width: 128px; height: 96px; object-fit: contain; border: none` to prevent clipping and remove border.

### Clinic Name
- Hard-coded as `CPRMED` with color-split spans:
  - `CPR` → `#6dbf40` (lime green, matched from `cprmedlogo.jpg`)
  - `MED` → `#1a7fd4` (vivid blue, matched from `cprmedlogo.jpg`)
- Font size: `48px`, weight `900`.

### Print Color Fix
- Added `print-color-adjust: exact; -webkit-print-color-adjust: exact;` globally on `*` selector and on `.name-cpr` / `.name-med` to prevent browser ink-saving desaturation.

### Specialties Text
- Initially rendered as multi-line stacked text inside the logo column with `<br/>` tags.
- Moved into the **center column**, placed directly below the contact number.
- Removed all `<br/>` tags — now one continuous comma-separated string.
- Styles: `font-size: 7.5px; font-weight: 600; text-align: center; white-space: normal`.

### Patient Detail Lines
- Removed underlines from `.line-value` (`border-bottom: none`).
- Increased font size to `15px`.

### Medication Body
- Medication text font size: `15px`.
- Follow-up / next appointment text font size: `13px`.

### Signature / Footer Panel
- Width: `320px`.
- Font size: `13px`.
- Label width: `152px`.

---

## Input Interface

```ts
interface PrescriptionPrintDocumentInput {
  clinicName: string;
  clinicAddress: string;
  clinicContactNumber: string;
  clinicEmail: string;
  doctorName: string;
  doctorSpecialty: string;
  doctorLicenseNumber: string;
  doctorBirNumber: string;
  doctorPtrNumber: string;
  doctorPrcQrData: string;
  patientName: string;
  issuedDate: string;
  medicationName: string;
  dosage: string;
  instruction: string;
  nextAppointment: string;
}
```

---

## Related Files

| File | Role |
|---|---|
| `src/features/patients/prescription-print-document.ts` | Prescription HTML builder |
| `src/features/settings/settings-documents-page.tsx` | Admin Documents page with live preview |
| `src/lib/print.ts` | `printHtmlDocument()` — iframe print trigger |
| `public/cprmedlogo.jpg` | Source of CPR/MED color values |
| `src/config/navigation.ts` | Documents nav item added under Administration |
| `src/routes/router.tsx` | Route `/app/settings/documents` registered |
