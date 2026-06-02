import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

import { FormField } from "../../components/forms/form-field";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { useAuth } from "../auth/auth-context";
import {
  useDoctorDirectory,
  useServicesCatalog,
  useSpecialtiesCatalog,
} from "../../hooks/use-clinic-data";
import { useCreateAppointment } from "../appointments/hooks/use-appointments";
import { useAppointments } from "../appointments/hooks/use-appointments";
import {
  useBookings,
  useCreateInvoice,
} from "../billing/api/billing-mutations";
import { useCreatePatient } from "../patients/hooks/use-patients";
import { usePatients } from "../patients/hooks/use-patients";
import { useUpdatePatient } from "../patients/hooks/use-patients";
import { useUpdateAppointment } from "../appointments/hooks/use-appointments";
import { useCompanies } from "../companies/api/companies-hooks";
import {
  formatCurrency,
  getPhilippineDateKey,
  getPhilippineTimeKey,
} from "../../lib/utils";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { printHtmlDocument } from "../../lib/print";
import { openQueuePrint } from "../appointments/components/appointments-que";
import { buildBillingReceiptPrintDocument } from "../billing/lib/billing-receipt-print-document";
import type { Appointment, Patient } from "../../types/domain";

const walkInWizardSchema = z.object({
  patient: z.object({
    firstName: z.string().min(2, "First name is required."),
    lastName: z.string().min(2, "Last name is required."),
    sex: z.enum(["male", "female", "other"]),
    birthDate: z.string().min(1, "Birth date is required."),
    age: z.string().optional(),
    mobileNumber: z
      .string()
      .regex(/^\d{11}$/, "Mobile number must be exactly 11 digits."),
    email: z.string().email("Enter a valid email address."),
    address: z.string().min(4, "Address is required."),
    bloodType: z.string().min(1, "Blood type is required."),
    allergies: z.string().min(1, "Allergies are required."),
    medicalHistory: z.string().min(1, "Medical history is required."),
    emergencyContactName: z.string().min(2, "Emergency contact is required."),
    emergencyContactPhone: z
      .string()
      .regex(/^\d{11}$/, "Emergency contact phone must be exactly 11 digits."),
    temperature: z.string().optional(),
    bloodPressure: z.string().optional(),
    heartRate: z.string().optional(),
    o2Sat: z.string().optional(),
    respiratoryRate: z.string().optional(),
    weight: z.string().optional(),
    height: z.string().optional(),
  }),
  appointment: z.object({
    doctorId: z.string().min(1, "Doctor is required."),
    specialtyId: z.string().optional(),
    serviceId: z.string().min(1, "Service is required."),
    status: z.enum(["scheduled", "confirmed", "in_progress", "completed"]),
    source: z.enum(["internal", "portal"]),
    visitType: z.enum(["in_person", "teleconsultation"]),
    scheduledAt: z.string().min(1, "Schedule is required."),
    reason: z.string().min(4, "Reason is required."),
    notes: z.string().min(2, "Notes are required."),
  }),
  billing: z
    .object({
      patientId: z.string().min(1, "Patient is required."),
      bookingId: z.string().optional(),
      appointmentId: z.string().optional(),
      companyId: z.string().optional().nullable(),
      paymentType: z.enum(["cash", "gcash", "card"]),
      referenceNumber: z.string().optional(),
      paymentStatus: z.enum(["unpaid", "paid"]),
      items: z
        .array(
          z.object({
            description: z.string().min(2, "Description is required."),
            category: z.enum([
              "consultation",
              "laboratory",
              "medicine",
              "other",
            ]),
            quantity: z.number().min(1, "Quantity is required."),
            unitPrice: z.number().min(1, "Unit price is required."),
          }),
        )
        .min(1, "At least one line item is required."),
    })
    .superRefine((value, context) => {
      if (
        value.paymentStatus === "paid" &&
        (value.paymentType === "gcash" || value.paymentType === "card") &&
        !value.referenceNumber?.trim()
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["referenceNumber"],
          message: "Reference number is required for GCash and Card payments.",
        });
      }
    }),
});

type WalkInWizardFormValues = z.infer<typeof walkInWizardSchema>;

type BillingReceiptPrintState = {
  invoiceNumber: string;
  customerName: string;
  doctorAssignedName: string;
  receptionistName: string;
  paymentMethod: string;
  paymentReference: string | null;
  issuedAt: string;
  subtotal: number;
  total: number;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
};

type WalkInWizardStage = "patient" | "appointment" | "billing" | "complete";

function getDefaultWalkInScheduledAtValue() {
  return `${getPhilippineDateKey()}T${getPhilippineTimeKey().slice(0, 5)}`;
}

function getAgeLabelFromBirthDate(birthDate: string) {
  if (!birthDate) {
    return "";
  }

  const birthDateValue = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birthDateValue.getTime())) {
    return "";
  }

  const now = new Date();
  if (birthDateValue > now) {
    return "";
  }

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const birthDayStart = new Date(
    birthDateValue.getFullYear(),
    birthDateValue.getMonth(),
    birthDateValue.getDate(),
  );
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const dayDifference = Math.max(
    Math.floor(
      (todayStart.getTime() - birthDayStart.getTime()) / millisecondsPerDay,
    ),
    0,
  );

  let years = now.getFullYear() - birthDateValue.getFullYear();
  const birthdayThisYear = new Date(
    now.getFullYear(),
    birthDateValue.getMonth(),
    birthDateValue.getDate(),
  );
  if (now < birthdayThisYear) {
    years -= 1;
  }

  if (years >= 1) {
    return String(years);
  }

  let months =
    (now.getFullYear() - birthDateValue.getFullYear()) * 12 +
    (now.getMonth() - birthDateValue.getMonth());
  if (now.getDate() < birthDateValue.getDate()) {
    months -= 1;
  }

  const normalizedMonths = Math.max(months, 0);
  if (normalizedMonths >= 1) {
    return `${normalizedMonths} month${normalizedMonths === 1 ? "" : "s"} old`;
  }

  const weeks = Math.floor(dayDifference / 7);
  if (weeks >= 1) {
    return `${weeks} week${weeks === 1 ? "" : "s"} old`;
  }

  return `${dayDifference} day${dayDifference === 1 ? "" : "s"} old`;
}

function getEmailNamePart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

const birthMonthOptions = [
  { value: "01", label: "Jan" },
  { value: "02", label: "Feb" },
  { value: "03", label: "Mar" },
  { value: "04", label: "Apr" },
  { value: "05", label: "May" },
  { value: "06", label: "Jun" },
  { value: "07", label: "Jul" },
  { value: "08", label: "Aug" },
  { value: "09", label: "Sep" },
  { value: "10", label: "Oct" },
  { value: "11", label: "Nov" },
  { value: "12", label: "Dec" },
] as const;

function padToTwoDigits(value: number) {
  return String(value).padStart(2, "0");
}

type VitalAlertLevel = "normal" | "warning" | "critical";

type VitalAlert = {
  key: string;
  label: string;
  level: VitalAlertLevel;
  status: string;
  message: string;
};

type PatientVitalsValues = Pick<
  WalkInWizardFormValues["patient"],
  | "temperature"
  | "bloodPressure"
  | "heartRate"
  | "o2Sat"
  | "respiratoryRate"
  | "weight"
  | "height"
>;

function parseNumericInput(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBloodPressureInput(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const match = normalized.match(/^(\d{2,3})\+?\s*\/\s*(\d{2,3})\+?$/);
  if (!match) {
    return null;
  }

  const systolic = Number(match[1]);
  const diastolic = Number(match[2]);
  if (!Number.isFinite(systolic) || !Number.isFinite(diastolic)) {
    return null;
  }

  return { systolic, diastolic };
}

function getVitalAlerts(vitals: PatientVitalsValues) {
  const alerts: VitalAlert[] = [];

  const temperature = vitals.temperature?.trim() ?? "";
  if (temperature) {
    const value = parseNumericInput(temperature);
    if (value == null) {
      alerts.push({
        key: "temperature",
        label: "Temperature",
        level: "warning",
        status: "Invalid format",
        message: "Enter a numeric value in Celsius, for example 36.8.",
      });
    } else if (value < 35) {
      alerts.push({
        key: "temperature",
        label: "Temperature",
        level: "critical",
        status: "Severe hypothermia",
        message: `${value.toFixed(1)} C is critically low.`,
      });
    } else if (value < 36) {
      alerts.push({
        key: "temperature",
        label: "Temperature",
        level: "warning",
        status: "Low temperature",
        message: `${value.toFixed(1)} C is below normal range.`,
      });
    } else if (value <= 37.5) {
      alerts.push({
        key: "temperature",
        label: "Temperature",
        level: "normal",
        status: "Normal",
        message: `${value.toFixed(1)} C is within normal range.`,
      });
    } else if (value < 38.5) {
      alerts.push({
        key: "temperature",
        label: "Temperature",
        level: "warning",
        status: "Fever",
        message: `${value.toFixed(1)} C indicates elevated temperature.`,
      });
    } else {
      alerts.push({
        key: "temperature",
        label: "Temperature",
        level: "critical",
        status: "High fever",
        message: `${value.toFixed(1)} C requires urgent attention.`,
      });
    }
  }

  const bloodPressure = vitals.bloodPressure?.trim() ?? "";
  if (bloodPressure) {
    const parsed = parseBloodPressureInput(bloodPressure);
    if (!parsed) {
      alerts.push({
        key: "bloodPressure",
        label: "Blood pressure",
        level: "warning",
        status: "Invalid format",
        message: "Use systolic/diastolic format, for example 120/80.",
      });
    } else if (parsed.systolic >= 180 || parsed.diastolic >= 120) {
      alerts.push({
        key: "bloodPressure",
        label: "Blood pressure",
        level: "critical",
        status: "Hypertensive Crisis",
        message: `${parsed.systolic}/${parsed.diastolic} is critically high.`,
      });
    } else if (parsed.systolic >= 140 || parsed.diastolic >= 90) {
      alerts.push({
        key: "bloodPressure",
        label: "Blood pressure",
        level: "warning",
        status: "Hypertension Stage 2",
        message: `${parsed.systolic}/${parsed.diastolic} is above safe range.`,
      });
    } else if (parsed.systolic >= 130 || parsed.diastolic >= 80) {
      alerts.push({
        key: "bloodPressure",
        label: "Blood pressure",
        level: "warning",
        status: "Hypertension Stage 1",
        message: `${parsed.systolic}/${parsed.diastolic} is mildly elevated.`,
      });
    } else if (parsed.systolic < 90 || parsed.diastolic < 60) {
      alerts.push({
        key: "bloodPressure",
        label: "Blood pressure",
        level: "warning",
        status: "Hypotension",
        message: `${parsed.systolic}/${parsed.diastolic} is below normal range.`,
      });
    } else {
      alerts.push({
        key: "bloodPressure",
        label: "Blood pressure",
        level: "normal",
        status: "Normal",
        message: `${parsed.systolic}/${parsed.diastolic} is within normal range.`,
      });
    }
  }

  const heartRate = vitals.heartRate?.trim() ?? "";
  if (heartRate) {
    const value = parseNumericInput(heartRate);
    if (value == null) {
      alerts.push({
        key: "heartRate",
        label: "Heart rate",
        level: "warning",
        status: "Invalid format",
        message: "Enter beats per minute as a number.",
      });
    } else if (value < 40) {
      alerts.push({
        key: "heartRate",
        label: "Heart rate",
        level: "critical",
        status: "Severe bradycardia",
        message: `${Math.round(value)} bpm is critically low.`,
      });
    } else if (value < 60) {
      alerts.push({
        key: "heartRate",
        label: "Heart rate",
        level: "warning",
        status: "Bradycardia",
        message: `${Math.round(value)} bpm is below normal resting range.`,
      });
    } else if (value <= 100) {
      alerts.push({
        key: "heartRate",
        label: "Heart rate",
        level: "normal",
        status: "Normal",
        message: `${Math.round(value)} bpm is within normal range.`,
      });
    } else if (value <= 120) {
      alerts.push({
        key: "heartRate",
        label: "Heart rate",
        level: "warning",
        status: "Tachycardia",
        message: `${Math.round(value)} bpm is elevated.`,
      });
    } else {
      alerts.push({
        key: "heartRate",
        label: "Heart rate",
        level: "critical",
        status: "Severe tachycardia",
        message: `${Math.round(value)} bpm requires urgent review.`,
      });
    }
  }

  const o2Sat = vitals.o2Sat?.trim() ?? "";
  if (o2Sat) {
    const value = parseNumericInput(o2Sat);
    if (value == null) {
      alerts.push({
        key: "o2Sat",
        label: "O2 saturation",
        level: "warning",
        status: "Invalid format",
        message: "Enter oxygen saturation as a percentage number.",
      });
    } else if (value < 90) {
      alerts.push({
        key: "o2Sat",
        label: "O2 saturation",
        level: "critical",
        status: "Severe hypoxemia",
        message: `${Math.round(value)}% is dangerously low.`,
      });
    } else if (value < 95) {
      alerts.push({
        key: "o2Sat",
        label: "O2 saturation",
        level: "warning",
        status: "Low oxygen saturation",
        message: `${Math.round(value)}% is below normal range.`,
      });
    } else {
      alerts.push({
        key: "o2Sat",
        label: "O2 saturation",
        level: "normal",
        status: "Normal",
        message: `${Math.round(value)}% is within normal range.`,
      });
    }
  }

  const respiratoryRate = vitals.respiratoryRate?.trim() ?? "";
  if (respiratoryRate) {
    const value = parseNumericInput(respiratoryRate);
    if (value == null) {
      alerts.push({
        key: "respiratoryRate",
        label: "Respiratory rate",
        level: "warning",
        status: "Invalid format",
        message: "Enter breaths per minute as a number.",
      });
    } else if (value < 8) {
      alerts.push({
        key: "respiratoryRate",
        label: "Respiratory rate",
        level: "critical",
        status: "Severe bradypnea",
        message: `${Math.round(value)} breaths/min is critically low.`,
      });
    } else if (value < 12) {
      alerts.push({
        key: "respiratoryRate",
        label: "Respiratory rate",
        level: "warning",
        status: "Bradypnea",
        message: `${Math.round(value)} breaths/min is below normal range.`,
      });
    } else if (value <= 20) {
      alerts.push({
        key: "respiratoryRate",
        label: "Respiratory rate",
        level: "normal",
        status: "Normal",
        message: `${Math.round(value)} breaths/min is within normal range.`,
      });
    } else if (value <= 24) {
      alerts.push({
        key: "respiratoryRate",
        label: "Respiratory rate",
        level: "warning",
        status: "Tachypnea",
        message: `${Math.round(value)} breaths/min is elevated.`,
      });
    } else {
      alerts.push({
        key: "respiratoryRate",
        label: "Respiratory rate",
        level: "critical",
        status: "Severe tachypnea",
        message: `${Math.round(value)} breaths/min requires urgent review.`,
      });
    }
  }

  const weight = vitals.weight?.trim() ?? "";
  const height = vitals.height?.trim() ?? "";
  if (weight && height) {
    const weightValue = parseNumericInput(weight);
    const heightValue = parseNumericInput(height);
    if (
      weightValue == null ||
      heightValue == null ||
      weightValue <= 0 ||
      heightValue <= 0
    ) {
      alerts.push({
        key: "bmi",
        label: "Weight and height",
        level: "warning",
        status: "Invalid format",
        message: "Enter positive numeric values for weight and height.",
      });
    } else {
      const heightMeters = heightValue / 100;
      const bmi = weightValue / (heightMeters * heightMeters);
      const roundedBmi = Math.round(bmi * 10) / 10;

      if (bmi < 18.5) {
        alerts.push({
          key: "bmi",
          label: "BMI",
          level: "warning",
          status: "Underweight",
          message: `BMI ${roundedBmi} suggests underweight range.`,
        });
      } else if (bmi < 25) {
        alerts.push({
          key: "bmi",
          label: "BMI",
          level: "normal",
          status: "Normal",
          message: `BMI ${roundedBmi} is within normal range.`,
        });
      } else if (bmi < 30) {
        alerts.push({
          key: "bmi",
          label: "BMI",
          level: "warning",
          status: "Overweight",
          message: `BMI ${roundedBmi} is above normal range.`,
        });
      } else if (bmi < 40) {
        alerts.push({
          key: "bmi",
          label: "BMI",
          level: "warning",
          status: "Obesity",
          message: `BMI ${roundedBmi} indicates obesity.`,
        });
      } else {
        alerts.push({
          key: "bmi",
          label: "BMI",
          level: "critical",
          status: "Severe obesity",
          message: `BMI ${roundedBmi} is in high-risk range.`,
        });
      }
    }
  }

  return alerts;
}

function getVitalAlertPriority(level: VitalAlertLevel) {
  if (level === "critical") {
    return 3;
  }
  if (level === "warning") {
    return 2;
  }
  return 1;
}

function sanitizeMobileNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

export function WalkInWizardModal({
  open,
  onClose,
  initialStage = "patient",
}: {
  open: boolean;
  onClose: () => void;
  initialStage?: WalkInWizardStage;
}) {
  const { profile } = useAuth();
  const { data: appointments = [] } = useAppointments();
  const { data: doctors = [] } = useDoctorDirectory();
  const { data: specialties = [] } = useSpecialtiesCatalog();
  const { data: services = [] } = useServicesCatalog();
  const { data: bookings = [] } = useBookings();
  const { data: patients = [] } = usePatients();
  const { data: companies = [] } = useCompanies();
  const createPatient = useCreatePatient();
  const updatePatient = useUpdatePatient();
  const createAppointment = useCreateAppointment();
  const createInvoice = useCreateInvoice();
  const updateAppointment = useUpdateAppointment();
  const [stage, setStage] = useState<WalkInWizardStage>(initialStage);
  const [existingPatientSearch, setExistingPatientSearch] = useState("");
  const [isExistingPatientDropdownOpen, setIsExistingPatientDropdownOpen] =
    useState(false);
  const [selectedExistingPatientId, setSelectedExistingPatientId] = useState<
    string | null
  >(null);
  const [invoicePatientSearch, setInvoicePatientSearch] = useState("");
  const [isInvoicePatientDropdownOpen, setIsInvoicePatientDropdownOpen] =
    useState(false);
  const [companySearch, setCompanySearch] = useState("");
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);

  const filteredCompanies = useMemo(() => {
    const query = companySearch.trim().toLowerCase();
    if (!query) return companies;
    return companies.filter(
      (company) =>
        company.companyName.toLowerCase().includes(query) ||
        company.companyCode.toLowerCase().includes(query),
    );
  }, [companies, companySearch]);
  const [createdPatient, setCreatedPatient] = useState<{
    id: string;
    firstName: string;
    lastName: string;
  } | null>(null);
  const [createdAppointment, setCreatedAppointment] =
    useState<Appointment | null>(null);
  const [billingReceiptPrintState, setBillingReceiptPrintState] =
    useState<BillingReceiptPrintState | null>(null);
  const lastAutoGeneratedEmailRef = useRef("");
  const [selectedBirthYear, setSelectedBirthYear] = useState("");
  const [selectedBirthMonth, setSelectedBirthMonth] = useState("");
  const [selectedBirthDay, setSelectedBirthDay] = useState("");

  const defaultDoctor = doctors[0];
  const defaultService = services[0];
  const defaultSpecialtyId =
    defaultDoctor?.specialtyId ?? specialties[0]?.id ?? "";

  const form = useForm<WalkInWizardFormValues>({
    resolver: zodResolver(walkInWizardSchema),
    defaultValues: {
      patient: {
        firstName: "",
        lastName: "",
        sex: "female",
        birthDate: "",
        age: "",
        mobileNumber: "",
        email: "",
        address: "",
        bloodType: "",
        allergies: "None reported",
        medicalHistory: "No significant medical history yet",
        emergencyContactName: "",
        emergencyContactPhone: "",
        temperature: "",
        bloodPressure: "",
        heartRate: "",
        o2Sat: "",
        respiratoryRate: "",
        weight: "",
        height: "",
      },
      appointment: {
        doctorId: defaultDoctor?.id ?? "",
        specialtyId: defaultSpecialtyId,
        serviceId: defaultService?.id ?? "",
        status: "confirmed",
        source: "internal",
        visitType: "in_person",
        scheduledAt: getDefaultWalkInScheduledAtValue(),
        reason: "Walk-in consultation",
        notes: "Front desk walk-in flow",
      },
      billing: {
        patientId: "",
        bookingId: "",
        appointmentId: "",
        companyId: "",
        paymentType: "cash",
        referenceNumber: "",
        paymentStatus: "paid",
        items: [
          {
            description: "General Consultation",
            category: "consultation",
            quantity: 1,
            unitPrice:
              defaultService?.price ?? defaultDoctor?.consultationFee ?? 800,
          },
        ],
      },
    },
  });
  const billingItems = useFieldArray({
    control: form.control,
    name: "billing.items",
  });

  const selectedDoctorId = form.watch("appointment.doctorId");
  const selectedServiceId = form.watch("appointment.serviceId");
  const selectedPatientFirstName = form.watch("patient.firstName");
  const selectedPatientLastName = form.watch("patient.lastName");
  const selectedPatientEmail = form.watch("patient.email");
  const selectedPatientBirthDate = form.watch("patient.birthDate");
  const selectedPatientTemperature = form.watch("patient.temperature");
  const selectedPatientBloodPressure = form.watch("patient.bloodPressure");
  const selectedPatientHeartRate = form.watch("patient.heartRate");
  const selectedPatientO2Sat = form.watch("patient.o2Sat");
  const selectedPatientRespiratoryRate = form.watch("patient.respiratoryRate");
  const selectedPatientWeight = form.watch("patient.weight");
  const selectedPatientHeight = form.watch("patient.height");
  const selectedBillingPaymentStatus = form.watch("billing.paymentStatus");
  const selectedBillingPatientId = form.watch("billing.patientId");
  const selectedBillingCompanyId = form.watch("billing.companyId");
  const billingLineItems = form.watch("billing.items");
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();
  const currentMonthPadded = padToTwoDigits(currentMonth);
  const birthYearOptions = useMemo(
    () =>
      Array.from({ length: 121 }, (_, index) => String(currentYear - index)),
    [currentYear],
  );
  const maxBirthMonth =
    selectedBirthYear === String(currentYear) ? currentMonth : 12;
  const availableBirthMonthOptions = useMemo(
    () =>
      birthMonthOptions.filter((month) => Number(month.value) <= maxBirthMonth),
    [maxBirthMonth],
  );
  const daysInSelectedBirthMonth =
    selectedBirthYear && selectedBirthMonth
      ? new Date(
          Number(selectedBirthYear),
          Number(selectedBirthMonth),
          0,
        ).getDate()
      : 31;
  const maxBirthDay =
    selectedBirthYear === String(currentYear) &&
    selectedBirthMonth === currentMonthPadded
      ? Math.min(daysInSelectedBirthMonth, currentDay)
      : daysInSelectedBirthMonth;
  const birthDayOptions = useMemo(
    () =>
      Array.from({ length: maxBirthDay }, (_, index) =>
        padToTwoDigits(index + 1),
      ),
    [maxBirthDay],
  );
  const vitalAlerts = useMemo(
    () =>
      getVitalAlerts({
        temperature: selectedPatientTemperature,
        bloodPressure: selectedPatientBloodPressure,
        heartRate: selectedPatientHeartRate,
        o2Sat: selectedPatientO2Sat,
        respiratoryRate: selectedPatientRespiratoryRate,
        weight: selectedPatientWeight,
        height: selectedPatientHeight,
      }),
    [
      selectedPatientTemperature,
      selectedPatientBloodPressure,
      selectedPatientHeartRate,
      selectedPatientO2Sat,
      selectedPatientRespiratoryRate,
      selectedPatientWeight,
      selectedPatientHeight,
    ],
  );
  const vitalAlertsByKey = useMemo(() => {
    const alertMap = new Map<string, VitalAlert>();
    for (const alert of vitalAlerts) {
      const existing = alertMap.get(alert.key);
      if (
        !existing ||
        getVitalAlertPriority(alert.level) >
          getVitalAlertPriority(existing.level)
      ) {
        alertMap.set(alert.key, alert);
      }
    }
    return alertMap;
  }, [vitalAlerts]);
  const selectedService =
    services.find((service) => service.id === selectedServiceId) ?? null;
  const selectedDoctor =
    doctors.find((doctor) => doctor.id === selectedDoctorId) ?? null;
  const filteredInvoicePatients = useMemo(() => {
    const query = invoicePatientSearch.trim().toLowerCase();

    if (!query) {
      return patients;
    }

    return patients.filter((patient) =>
      `${patient.firstName} ${patient.lastName} ${patient.email} ${patient.mobileNumber}`
        .toLowerCase()
        .includes(query),
    );
  }, [invoicePatientSearch, patients]);
  const selectedExistingPatient = useMemo(
    () =>
      selectedExistingPatientId
        ? (patients.find(
            (patient) => patient.id === selectedExistingPatientId,
          ) ?? null)
        : null,
    [patients, selectedExistingPatientId],
  );
  const isUsingExistingPatient = Boolean(selectedExistingPatient);
  const filteredExistingPatients = useMemo(() => {
    const query = existingPatientSearch.trim().toLowerCase();

    if (!query) {
      return patients;
    }

    return patients.filter((patient) =>
      `${patient.firstName} ${patient.lastName} ${patient.mobileNumber} ${patient.email}`
        .toLowerCase()
        .includes(query),
    );
  }, [existingPatientSearch, patients]);

  const applyExistingPatientToForm = (patient: Patient) => {
    lastAutoGeneratedEmailRef.current = "";
    form.setValue("patient.firstName", patient.firstName, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue("patient.lastName", patient.lastName, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue("patient.sex", patient.sex, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue("patient.birthDate", patient.birthDate, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue("patient.age", getAgeLabelFromBirthDate(patient.birthDate), {
      shouldDirty: true,
      shouldValidate: false,
    });
    form.setValue("patient.mobileNumber", patient.mobileNumber, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue("patient.email", patient.email, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue("patient.address", patient.address, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue("patient.bloodType", patient.bloodType, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue("patient.allergies", patient.allergies, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue("patient.medicalHistory", patient.medicalHistory, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue(
      "patient.emergencyContactName",
      patient.emergencyContactName,
      { shouldDirty: true, shouldValidate: true },
    );
    form.setValue(
      "patient.emergencyContactPhone",
      patient.emergencyContactPhone,
      { shouldDirty: true, shouldValidate: true },
    );
    form.setValue("patient.temperature", patient.temperature ?? "", {
      shouldDirty: true,
      shouldValidate: false,
    });
    form.setValue("patient.bloodPressure", patient.bloodPressure ?? "", {
      shouldDirty: true,
      shouldValidate: false,
    });
    form.setValue("patient.heartRate", patient.heartRate ?? "", {
      shouldDirty: true,
      shouldValidate: false,
    });
    form.setValue("patient.o2Sat", patient.o2Sat ?? "", {
      shouldDirty: true,
      shouldValidate: false,
    });
    form.setValue("patient.respiratoryRate", patient.respiratoryRate ?? "", {
      shouldDirty: true,
      shouldValidate: false,
    });
    form.setValue("patient.weight", patient.weight ?? "", {
      shouldDirty: true,
      shouldValidate: false,
    });
    form.setValue("patient.height", patient.height ?? "", {
      shouldDirty: true,
      shouldValidate: false,
    });
  };

  const handleBirthDatePartChange = (
    part: "year" | "month" | "day",
    value: string,
  ) => {
    const inputYear = part === "year" ? value : selectedBirthYear;
    const inputMonth = part === "month" ? value : selectedBirthMonth;
    const inputDay = part === "day" ? value : selectedBirthDay;

    setSelectedBirthYear(inputYear);
    setSelectedBirthMonth(inputMonth);
    setSelectedBirthDay(inputDay);

    if (!inputYear || !inputMonth || !inputDay) {
      form.setValue("patient.birthDate", "", {
        shouldDirty: true,
        shouldValidate: false,
      });
      return;
    }

    const normalizedMonthNumber = Math.min(
      Number(inputMonth),
      inputYear === String(currentYear) ? currentMonth : 12,
    );
    const normalizedMonth = padToTwoDigits(normalizedMonthNumber);
    const monthDayLimit = new Date(
      Number(inputYear),
      normalizedMonthNumber,
      0,
    ).getDate();
    const dateDayLimit =
      inputYear === String(currentYear) &&
      normalizedMonth === currentMonthPadded
        ? Math.min(monthDayLimit, currentDay)
        : monthDayLimit;
    const normalizedDay = padToTwoDigits(
      Math.min(Number(inputDay), dateDayLimit),
    );

    setSelectedBirthMonth(normalizedMonth);
    setSelectedBirthDay(normalizedDay);
    form.setValue(
      "patient.birthDate",
      `${inputYear}-${normalizedMonth}-${normalizedDay}`,
      {
        shouldDirty: true,
        shouldValidate: true,
      },
    );
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    const nextSpecialtyId =
      selectedService?.specialtyId ?? selectedDoctor?.specialtyId ?? "";
    if (
      nextSpecialtyId &&
      form.getValues("appointment.specialtyId") !== nextSpecialtyId
    ) {
      form.setValue("appointment.specialtyId", nextSpecialtyId, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      });
    }
  }, [form, open, selectedDoctor?.specialtyId, selectedService?.specialtyId]);

  useEffect(() => {
    if (!open || isUsingExistingPatient) {
      return;
    }

    const firstNamePart = getEmailNamePart(selectedPatientFirstName ?? "");
    const lastNamePart = getEmailNamePart(selectedPatientLastName ?? "");
    const currentEmail = (selectedPatientEmail ?? "").trim().toLowerCase();
    const previousAutoEmail = lastAutoGeneratedEmailRef.current;

    if (!firstNamePart || !lastNamePart) {
      if (currentEmail && currentEmail === previousAutoEmail) {
        form.setValue("patient.email", "", {
          shouldDirty: false,
          shouldValidate: true,
          shouldTouch: false,
        });
      }
      lastAutoGeneratedEmailRef.current = "";
      return;
    }

    const nextAutoEmail = `${firstNamePart}.${lastNamePart}@gmail.com`;
    if (!currentEmail || currentEmail === previousAutoEmail) {
      if (currentEmail !== nextAutoEmail) {
        form.setValue("patient.email", nextAutoEmail, {
          shouldDirty: false,
          shouldValidate: true,
          shouldTouch: false,
        });
      }
    }

    lastAutoGeneratedEmailRef.current = nextAutoEmail;
  }, [
    form,
    isUsingExistingPatient,
    open,
    selectedPatientEmail,
    selectedPatientFirstName,
    selectedPatientLastName,
  ]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!selectedPatientBirthDate) {
      setSelectedBirthYear("");
      setSelectedBirthMonth("");
      setSelectedBirthDay("");
      return;
    }

    const [year = "", month = "", day = ""] =
      selectedPatientBirthDate.split("-");
    setSelectedBirthYear(year);
    setSelectedBirthMonth(month);
    setSelectedBirthDay(day);
  }, [open, selectedPatientBirthDate]);

  useEffect(() => {
    if (!open) {
      return;
    }

    form.setValue(
      "patient.age",
      getAgeLabelFromBirthDate(selectedPatientBirthDate),
      {
        shouldDirty: false,
        shouldValidate: false,
        shouldTouch: false,
      },
    );
  }, [form, open, selectedPatientBirthDate]);

  useEffect(() => {
    if (!open) {
      return;
    }

    lastAutoGeneratedEmailRef.current = "";
    form.reset({
      patient: {
        firstName: "",
        lastName: "",
        sex: "female",
        birthDate: "",
        age: "",
        mobileNumber: "",
        email: "",
        address: "",
        bloodType: "",
        allergies: "None reported",
        medicalHistory: "No significant medical history yet",
        emergencyContactName: "",
        emergencyContactPhone: "",
        temperature: "",
        bloodPressure: "",
        heartRate: "",
        o2Sat: "",
        respiratoryRate: "",
        weight: "",
        height: "",
      },
      appointment: {
        doctorId: defaultDoctor?.id ?? "",
        specialtyId: defaultSpecialtyId,
        serviceId: defaultService?.id ?? "",
        status: "confirmed",
        source: "internal",
        visitType: "in_person",
        scheduledAt: getDefaultWalkInScheduledAtValue(),
        reason: "Walk-in consultation",
        notes: "Front desk walk-in flow",
      },
      billing: {
        patientId: "",
        bookingId: "",
        appointmentId: "",
        companyId: "",
        paymentType: "cash",
        referenceNumber: "",
        paymentStatus: "paid",
        items: [
          {
            description: defaultService?.name ?? "General Consultation",
            category: "consultation",
            quantity: 1,
            unitPrice:
              defaultService?.price ?? defaultDoctor?.consultationFee ?? 800,
          },
        ],
      },
    });
    setStage(initialStage);
    setExistingPatientSearch("");
    setIsExistingPatientDropdownOpen(false);
    setSelectedExistingPatientId(null);
    setCreatedPatient(null);
    setCreatedAppointment(null);
    setBillingReceiptPrintState(null);
    setCompanySearch("");
    setIsCompanyDropdownOpen(false);
  }, [
    defaultDoctor?.id,
    defaultDoctor?.specialtyId,
    defaultService?.id,
    defaultService?.specialtyId,
    form,
    initialStage,
    open,
  ]);

  if (!open) {
    return null;
  }

  const stepIndex =
    stage === "patient"
      ? 0
      : stage === "appointment"
        ? 1
        : stage === "billing"
          ? 2
          : 3;
  const stepLabels = ["Add patient", "Queue patient", "Billing", "Ready"];

  const closeModal = () => {
    if (
      createPatient.isPending ||
      createAppointment.isPending ||
      createInvoice.isPending ||
      updateAppointment.isPending
    ) {
      return;
    }

    onClose();
  };

  const handlePatientStep = async () => {
    if (selectedExistingPatientId) {
      const existingPatient = patients.find(
        (patient) => patient.id === selectedExistingPatientId,
      );

      if (!existingPatient) {
        toast.error("Selected existing patient record is no longer available.");
        return;
      }

      const values = form.getValues("patient");
      const hasUpdatedVitals = Boolean(
        values.temperature ||
        values.bloodPressure ||
        values.heartRate ||
        values.o2Sat ||
        values.respiratoryRate ||
        values.weight ||
        values.height,
      );

      await updatePatient.mutateAsync({
        patientId: existingPatient.id,
        payload: {
          userId: existingPatient.userId ?? null,
          qrCode: existingPatient.qrCode,
          intakeSource: existingPatient.intakeSource,
          visitStatus: existingPatient.visitStatus,
          lastClinicVisitAt: existingPatient.lastClinicVisitAt ?? null,
          firstName: existingPatient.firstName,
          lastName: existingPatient.lastName,
          sex: existingPatient.sex,
          birthDate: existingPatient.birthDate,
          mobileNumber: existingPatient.mobileNumber,
          email: existingPatient.email,
          address: existingPatient.address,
          bloodType: existingPatient.bloodType,
          allergies: existingPatient.allergies,
          medicalHistory: existingPatient.medicalHistory,
          emergencyContactName: existingPatient.emergencyContactName,
          emergencyContactPhone: existingPatient.emergencyContactPhone,
          temperature: values.temperature,
          bloodPressure: values.bloodPressure,
          heartRate: values.heartRate,
          o2Sat: values.o2Sat,
          respiratoryRate: values.respiratoryRate,
          weight: values.weight,
          height: values.height,
          vitalsRecordedAt: hasUpdatedVitals
            ? new Date().toISOString()
            : (existingPatient.vitalsRecordedAt ?? null),
        },
      });

      setCreatedPatient({
        id: existingPatient.id,
        firstName: existingPatient.firstName,
        lastName: existingPatient.lastName,
      });
      form.setValue("billing.patientId", existingPatient.id, {
        shouldDirty: true,
        shouldValidate: true,
      });
      setInvoicePatientSearch(
        `${existingPatient.firstName} ${existingPatient.lastName}`,
      );
      setStage("appointment");
      toast.success(
        "Existing patient selected. Vitals updated for this visit.",
      );
      return;
    }

    const isValid = await form.trigger("patient");
    if (!isValid) {
      return;
    }

    const values = form.getValues("patient");
    const vitalsRecordedAt =
      values.temperature ||
      values.bloodPressure ||
      values.heartRate ||
      values.o2Sat ||
      values.respiratoryRate ||
      values.weight ||
      values.height
        ? new Date().toISOString()
        : null;

    const patient = await createPatient.mutateAsync({
      userId: null,
      qrCode: "",
      intakeSource: "staff_walk_in",
      visitStatus: "visited_clinic",
      lastClinicVisitAt: new Date().toISOString(),
      firstName: values.firstName,
      lastName: values.lastName,
      sex: values.sex,
      birthDate: values.birthDate,
      mobileNumber: values.mobileNumber,
      email: values.email,
      address: values.address,
      bloodType: values.bloodType,
      allergies: values.allergies,
      medicalHistory: values.medicalHistory,
      emergencyContactName: values.emergencyContactName,
      emergencyContactPhone: values.emergencyContactPhone,
      temperature: values.temperature,
      bloodPressure: values.bloodPressure,
      heartRate: values.heartRate,
      o2Sat: values.o2Sat,
      respiratoryRate: values.respiratoryRate,
      weight: values.weight,
      height: values.height,
      vitalsRecordedAt,
    });

    setCreatedPatient({
      id: patient.id,
      firstName: patient.firstName,
      lastName: patient.lastName,
    });
    form.setValue("billing.patientId", patient.id, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setInvoicePatientSearch(`${patient.firstName} ${patient.lastName}`);
    setStage("appointment");
    toast.success(
      `Patient added. Unique ID: ${patient.uniqueLoginId ?? "Not generated"}. Continue to appointment setup.`,
    );
  };

  const handleAppointmentStep = async () => {
    if (!createdPatient) {
      toast.error("Please complete patient intake first.");
      return;
    }

    const isValid = await form.trigger("appointment");
    if (!isValid) {
      return;
    }

    const values = form.getValues("appointment");
    const billingValues = form.getValues("billing");
    const isTeleconsult = values.visitType === "teleconsultation";

    const resolvedSpecialtyId =
      values.specialtyId ||
      selectedService?.specialtyId ||
      selectedDoctor?.specialtyId ||
      defaultSpecialtyId ||
      specialties[0]?.id ||
      "";

    // --- Receipt code generation ---
    const selectedCompany = billingValues.companyId
      ? companies.find((c) => c.id === billingValues.companyId)
      : null;
    const companyCodePart = selectedCompany?.companyCode?.trim().toUpperCase() || "GEN";
    const now = new Date();
    const yearPart = now.getFullYear();
    const monthPart = String(now.getMonth() + 1).padStart(2, "0");

    let receiptSeq = 1;
    try {
      if (isSupabaseConfigured && supabase) {
        const { data: rcData } = await supabase
          .from("appointments")
          .select("receipt_code")
          .not("receipt_code", "is", null);
        const rcRows = (rcData ?? []) as Array<{ receipt_code: string | null }>;
        if (rcRows.length > 0) {
          const highest = rcRows.reduce((max, row) => {
            const m = String(row.receipt_code ?? "").match(/(\d+)$/);
            const val = m ? Number(m[1]) : 0;
            return Math.max(max, Number.isFinite(val) ? val : 0);
          }, 0);
          receiptSeq = highest + 1;
        }
      } else {
        const stored = Number(localStorage.getItem("appt_receipt_seq") || "0");
        receiptSeq = stored + 1;
        localStorage.setItem("appt_receipt_seq", String(receiptSeq));
      }
    } catch {
      const stored = Number(localStorage.getItem("appt_receipt_seq") || "0");
      receiptSeq = stored + 1;
      localStorage.setItem("appt_receipt_seq", String(receiptSeq));
    }
    const receiptCode = `${companyCodePart}-${yearPart}-${monthPart}-${String(receiptSeq).padStart(6, "0")}`;

    // --- Queue number generation (only for in-person) ---
    let queueNumber = "ODC-QUE-000001";
    if (!isTeleconsult) {
      try {
        if (isSupabaseConfigured && supabase) {
          const { data, error } = await supabase
            .from("appointments")
            .select("queue_number")
            .not("queue_number", "is", null)
            .order("created_at", { ascending: false })
            .limit(1);
          const latest = (data ?? []) as Array<{
            queue_number: string | null;
          }>;
          if (!error && latest && latest.length > 0 && latest[0].queue_number) {
            const m = String(latest[0].queue_number).match(/(\d+)$/);
            const next = m ? Number(m[1]) + 1 : 1;
            queueNumber = `ODC-QUE-${String(next).padStart(6, "0")}`;
          }
        } else {
          const stored = Number(localStorage.getItem("odc_queue_seq") || "0");
          const next = stored + 1;
          localStorage.setItem("odc_queue_seq", String(next));
          queueNumber = `ODC-QUE-${String(next).padStart(6, "0")}`;
        }
      } catch {
        const stored = Number(localStorage.getItem("odc_queue_seq") || "0");
        const next = stored + 1;
        localStorage.setItem("odc_queue_seq", String(next));
        queueNumber = `ODC-QUE-${String(next).padStart(6, "0")}`;
      }
    }

    const scheduledAtUtc = new Date().toISOString();
    const scheduledDate = new Date(scheduledAtUtc);
    const minutes = scheduledDate.getMinutes();
    const estimatedEndDate = new Date(scheduledDate);

    if (minutes < 15) {
      estimatedEndDate.setMinutes(30, 0, 0);
    } else if (minutes >= 30) {
      estimatedEndDate.setHours(estimatedEndDate.getHours() + 1);
      estimatedEndDate.setMinutes(0, 0, 0);
    } else {
      estimatedEndDate.setMinutes(30, 0, 0);
    }

    const estimatedEnd = estimatedEndDate.toISOString();

    const appointment = await createAppointment.mutateAsync({
      patientId: createdPatient.id,
      doctorId: values.doctorId,
      specialtyId: resolvedSpecialtyId,
      serviceId: values.serviceId,
      scheduledAt: scheduledAtUtc,
      status: values.status,
      source: values.source,
      visitType: values.visitType,
      reason: values.reason,
      notes: values.notes,
      teleconsultationPlatform: undefined,
      teleconsultationUrl: undefined,
      teleconsultationAccessInstructions: undefined,
      queue_number: isTeleconsult ? null : queueNumber,
      estimated_end: estimatedEnd,
      receipt_code: receiptCode,
    } as never);

    setCreatedAppointment(appointment);
    form.setValue("billing.appointmentId", appointment.id, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue("billing.patientId", createdPatient.id, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue("billing.bookingId", "", {
      shouldDirty: false,
      shouldValidate: false,
    });
    setInvoicePatientSearch(
      `${createdPatient.firstName} ${createdPatient.lastName}`,
    );
    setStage("billing");
    toast.success("Appointment created. Continue to billing.");
  };

  const handleBillingStep = async () => {
    if (!createdPatient || !createdAppointment) {
      toast.error("Please complete the earlier steps first.");
      return;
    }

    const isValid = await form.trigger("billing");
    if (!isValid) {
      return;
    }

    const values = form.getValues("billing");
    const createdInvoice = await createInvoice.mutateAsync({
      values: {
        patientId: values.patientId,
        bookingId: values.bookingId ?? "",
        appointmentId: values.appointmentId ?? createdAppointment.id,
        companyId: values.companyId || null,
        items: values.items,
        paymentStatus: values.paymentStatus,
        paymentType: values.paymentType,
        referenceNumber: values.referenceNumber,
      },
      bookings,
      profile,
    });

    const doctorAssignedName =
      doctors.find((doctor) => doctor.id === createdAppointment.doctorId)
        ?.fullName ?? "N/A";
    setBillingReceiptPrintState({
      invoiceNumber: createdInvoice.invoiceNumber,
      customerName: `${createdPatient.firstName} ${createdPatient.lastName}`,
      doctorAssignedName,
      receptionistName: profile?.fullName ?? "N/A",
      paymentMethod:
        values.paymentStatus === "paid"
          ? (values.paymentType ?? "cash")
          : createdInvoice.paymentStatus,
      paymentReference:
        values.paymentStatus === "paid" && values.paymentType !== "cash"
          ? values.referenceNumber?.trim() || null
          : null,
      issuedAt: createdInvoice.createdAt,
      subtotal: createdInvoice.subtotal,
      total: createdInvoice.total,
      items: values.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.quantity * item.unitPrice,
      })),
    });

    // --- Generate receipt_code at billing time (company is now known) ---
    const billingCompany = values.companyId
      ? companies.find((c) => c.id === values.companyId)
      : null;
    const rcCompanyCode = billingCompany?.companyCode?.trim().toUpperCase() || "GEN";
    const rcNow = new Date();
    const rcYear = rcNow.getFullYear();
    const rcMonth = String(rcNow.getMonth() + 1).padStart(2, "0");

    let rcSeq = 1;
    try {
      if (isSupabaseConfigured && supabase) {
        const { data: rcData } = await supabase
          .from("appointments")
          .select("receipt_code")
          .like("receipt_code", `${rcCompanyCode}-%`);
        const rcRows = (rcData ?? []) as Array<{ receipt_code: string | null }>;
        if (rcRows.length > 0) {
          const highest = rcRows.reduce((max, row) => {
            const m = String(row.receipt_code ?? "").match(/(\d+)$/);
            const val = m ? Number(m[1]) : 0;
            return Math.max(max, Number.isFinite(val) ? val : 0);
          }, 0);
          rcSeq = highest + 1;
        }
      } else {
        const lsKey = `appt_receipt_seq_${rcCompanyCode}`;
        const stored = Number(localStorage.getItem(lsKey) || "0");
        rcSeq = stored + 1;
        localStorage.setItem(lsKey, String(rcSeq));
      }
    } catch {
      const lsKey = `appt_receipt_seq_${rcCompanyCode}`;
      const stored = Number(localStorage.getItem(lsKey) || "0");
      rcSeq = stored + 1;
      localStorage.setItem(lsKey, String(rcSeq));
    }
    const finalReceiptCode = `${rcCompanyCode}-${rcYear}-${rcMonth}-${String(rcSeq).padStart(6, "0")}`;

    await updateAppointment.mutateAsync({
      appointmentId: createdAppointment.id,
      payload: {
        patientId: createdAppointment.patientId,
        doctorId: createdAppointment.doctorId,
        specialtyId: createdAppointment.specialtyId,
        serviceId: createdAppointment.serviceId,
        scheduledAt: createdAppointment.scheduledAt,
        queue_number: createdAppointment.queue_number ?? null,
        estimated_end: createdAppointment.estimated_end ?? null,
        receipt_code: finalReceiptCode,
        status: "in_progress",
        source: createdAppointment.source,
        visitType: createdAppointment.visitType,
        reason: createdAppointment.reason,
        notes: createdAppointment.notes,
        teleconsultationPlatform:
          createdAppointment.teleconsultationPlatform ?? undefined,
        teleconsultationUrl:
          createdAppointment.teleconsultationUrl ?? undefined,
        teleconsultationAccessInstructions:
          createdAppointment.teleconsultationAccessInstructions ?? undefined,
        companyId: values.companyId || null,
      } as never,
    });

    if (createdAppointment.visitType !== "teleconsultation") {
      openQueuePrint({
        queueNumber: createdAppointment.queue_number ?? "ODC-QUE-000001",
        scheduledAt: createdAppointment.scheduledAt,
        estimatedEnd:
          createdAppointment.estimated_end ?? createdAppointment.scheduledAt,
        patientName: createdPatient
          ? `${createdPatient.firstName} ${createdPatient.lastName}`
          : undefined,
      });
    }

    setStage("complete");
    toast.success("Billing completed. The patient is ready for consultation.");
  };

  const handleReprintQueueNumber = () => {
    if (!createdAppointment || !createdPatient) {
      toast.error("Queue details are not available yet.");
      return;
    }

    openQueuePrint({
      queueNumber: createdAppointment.queue_number ?? "ODC-QUE-000001",
      scheduledAt: createdAppointment.scheduledAt,
      estimatedEnd:
        createdAppointment.estimated_end ?? createdAppointment.scheduledAt,
      patientName: `${createdPatient.firstName} ${createdPatient.lastName}`,
    });
  };

  const handlePrintBillingReceipt = async () => {
    if (!billingReceiptPrintState) {
      toast.error("Billing receipt details are not available yet.");
      return;
    }

    try {
      await printHtmlDocument(
        buildBillingReceiptPrintDocument(billingReceiptPrintState),
      );
    } catch {
      toast.error("The billing receipt could not be sent to the print dialog.");
    }
  };

  const handleSaveBillingReceiptAsPdf = () => {
    toast.message(
      'When the print dialog opens, choose "Save as PDF" as the destination.',
    );
    void handlePrintBillingReceipt();
  };

  const isBusy =
    createPatient.isPending ||
    updatePatient.isPending ||
    createAppointment.isPending ||
    createInvoice.isPending ||
    updateAppointment.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Front Desk Walk-In Flow
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
              One modal, one patient, full handoff
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Add the patient, set the appointment, bill immediately, and send
              them ready for consultation without leaving this page.
            </p>
          </div>
          <button
            className="border border-slate-200 bg-white px-3 py-2 text-xs font-bold uppercase tracking-widest text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isBusy}
            onClick={closeModal}
            type="button"
          >
            Close
          </button>
        </div>

        <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
          <div className="grid grid-cols-4 gap-2">
            {stepLabels.map((label, index) => {
              const active = index <= stepIndex;

              return (
                <div className="min-w-0" key={label}>
                  <div
                    className={`h-2 w-full ${active ? "bg-[var(--color-primary)]" : "bg-slate-200"}`}
                  />
                  <p
                    className={`mt-2 text-center text-[10px] font-extrabold uppercase tracking-[0.14em] ${
                      active ? "text-[var(--color-primary)]" : "text-slate-400"
                    }`}
                  >
                    {label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {stage === "patient" ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                  Existing patient search
                </p>
                <div className="relative mt-3">
                  <Input
                    onBlur={() => {
                      window.setTimeout(
                        () => setIsExistingPatientDropdownOpen(false),
                        120,
                      );
                    }}
                    onFocus={() => setIsExistingPatientDropdownOpen(true)}
                    onChange={(event) => {
                      const value = event.target.value;
                      setExistingPatientSearch(value);
                      setIsExistingPatientDropdownOpen(true);
                      setSelectedExistingPatientId(null);
                    }}
                    placeholder="Search existing patient by name, mobile, or email"
                    value={existingPatientSearch}
                  />
                  {isExistingPatientDropdownOpen ? (
                    <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto border border-slate-200 bg-white shadow-lg">
                      {filteredExistingPatients.length > 0 ? (
                        filteredExistingPatients.slice(0, 20).map((patient) => (
                          <button
                            className={`block w-full px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${selectedExistingPatientId === patient.id ? "bg-green-50 text-green-800" : "text-slate-700"}`}
                            key={patient.id}
                            onMouseDown={() => {
                              setSelectedExistingPatientId(patient.id);
                              setExistingPatientSearch(
                                `${patient.firstName} ${patient.lastName}`,
                              );
                              setIsExistingPatientDropdownOpen(false);
                              applyExistingPatientToForm(patient);
                            }}
                            type="button"
                          >
                            {patient.firstName} {patient.lastName}
                          </button>
                        ))
                      ) : (
                        <p className="px-3 py-2 text-xs text-slate-500">
                          No matching patient found.
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
                {selectedExistingPatientId ? (
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-xs font-semibold text-slate-700">
                      Using existing patient record.
                    </p>
                    <button
                      className="text-xs font-bold uppercase tracking-widest text-[var(--color-primary)] hover:underline"
                      onClick={() => {
                        setSelectedExistingPatientId(null);
                        setExistingPatientSearch("");
                        form.resetField("patient");
                      }}
                      type="button"
                    >
                      Clear
                    </button>
                  </div>
                ) : null}
                {selectedExistingPatient ? (
                  <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-600">
                      Existing record warning
                    </p>
                    <p className="text-xs text-slate-600">
                      Demographics and profile details are locked to protect the
                      existing record. Only vitals will be updated in this
                      workflow.
                    </p>
                    <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                      <p>
                        <span className="font-semibold">Patient:</span>{" "}
                        {selectedExistingPatient.firstName}{" "}
                        {selectedExistingPatient.lastName}
                      </p>
                      <p>
                        <span className="font-semibold">Mobile:</span>{" "}
                        {selectedExistingPatient.mobileNumber}
                      </p>
                      <p>
                        <span className="font-semibold">Email:</span>{" "}
                        {selectedExistingPatient.email}
                      </p>
                      <p>
                        <span className="font-semibold">Address:</span>{" "}
                        {selectedExistingPatient.address}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <FormField
                  error={form.formState.errors.patient?.firstName?.message}
                  label="First name"
                >
                  <Input
                    disabled={isUsingExistingPatient}
                    placeholder="Enter first name"
                    {...form.register("patient.firstName")}
                  />
                </FormField>
                <FormField
                  error={form.formState.errors.patient?.lastName?.message}
                  label="Last name"
                >
                  <Input
                    disabled={isUsingExistingPatient}
                    placeholder="Enter last name"
                    {...form.register("patient.lastName")}
                  />
                </FormField>
                <FormField label="Sex">
                  <select
                    className="w-full border border-slate-200 bg-white px-3 py-2.5 text-sm"
                    disabled={isUsingExistingPatient}
                    {...form.register("patient.sex")}
                  >
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                  </select>
                </FormField>
                <FormField
                  error={form.formState.errors.patient?.birthDate?.message}
                  label="Birth date"
                >
                  <div className="space-y-2">
                    <Input
                      type="hidden"
                      {...form.register("patient.birthDate")}
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <Select
                        aria-label="Birth month"
                        disabled={isUsingExistingPatient}
                        onChange={(event) =>
                          handleBirthDatePartChange("month", event.target.value)
                        }
                        value={selectedBirthMonth}
                      >
                        <option value="">Month</option>
                        {availableBirthMonthOptions.map((month) => (
                          <option key={month.value} value={month.value}>
                            {month.label}
                          </option>
                        ))}
                      </Select>
                      <Select
                        aria-label="Birth day"
                        disabled={
                          isUsingExistingPatient ||
                          !selectedBirthYear ||
                          !selectedBirthMonth
                        }
                        onChange={(event) =>
                          handleBirthDatePartChange("day", event.target.value)
                        }
                        value={selectedBirthDay}
                      >
                        <option value="">Day</option>
                        {birthDayOptions.map((day) => (
                          <option key={day} value={day}>
                            {day}
                          </option>
                        ))}
                      </Select>
                      <Select
                        aria-label="Birth year"
                        disabled={isUsingExistingPatient}
                        onChange={(event) =>
                          handleBirthDatePartChange("year", event.target.value)
                        }
                        value={selectedBirthYear}
                      >
                        <option value="">Year</option>
                        {birthYearOptions.map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Choose Month, Day, and Year. Future dates are disabled.
                    </p>
                  </div>
                </FormField>
                <FormField label="Age">
                  <Input
                    placeholder="Auto from birth date (editable)"
                    {...form.register("patient.age")}
                  />
                </FormField>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  error={form.formState.errors.patient?.mobileNumber?.message}
                  label="Mobile number"
                >
                  <Input
                    disabled={isUsingExistingPatient}
                    inputMode="numeric"
                    maxLength={11}
                    pattern="[0-9]*"
                    placeholder="09XXXXXXXXX"
                    {...form.register("patient.mobileNumber", {
                      setValueAs: (value) =>
                        sanitizeMobileNumber(String(value ?? "")),
                      onChange: (event) => {
                        const sanitized = sanitizeMobileNumber(
                          event.target.value,
                        );
                        if (sanitized !== event.target.value) {
                          event.target.value = sanitized;
                        }
                      },
                    })}
                  />
                </FormField>
                <FormField
                  error={form.formState.errors.patient?.email?.message}
                  label="Email"
                >
                  <Input
                    disabled={isUsingExistingPatient}
                    placeholder="Auto from first and last name"
                    {...form.register("patient.email")}
                  />
                </FormField>
              </div>
              <FormField
                error={form.formState.errors.patient?.address?.message}
                label="Address"
              >
                <Input
                  disabled={isUsingExistingPatient}
                  placeholder="House no., street, barangay, city"
                  {...form.register("patient.address")}
                />
              </FormField>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  error={form.formState.errors.patient?.bloodType?.message}
                  label="Blood type"
                >
                  <Select
                    disabled={isUsingExistingPatient}
                    {...form.register("patient.bloodType")}
                  >
                    <option value="">Select blood type</option>
                    <option value="N/A">N/A</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </Select>
                </FormField>
                <FormField
                  error={form.formState.errors.patient?.allergies?.message}
                  label="Allergies"
                >
                  <Input
                    disabled={isUsingExistingPatient}
                    placeholder="None reported"
                    {...form.register("patient.allergies")}
                  />
                </FormField>
              </div>
              <FormField
                error={form.formState.errors.patient?.medicalHistory?.message}
                label="Medical history"
              >
                <Textarea
                  disabled={isUsingExistingPatient}
                  placeholder="Medical history details"
                  {...form.register("patient.medicalHistory")}
                />
              </FormField>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  error={
                    form.formState.errors.patient?.emergencyContactName?.message
                  }
                  label="Emergency contact name"
                >
                  <Input
                    disabled={isUsingExistingPatient}
                    placeholder="Enter contact person"
                    {...form.register("patient.emergencyContactName")}
                  />
                </FormField>
                <FormField
                  error={
                    form.formState.errors.patient?.emergencyContactPhone
                      ?.message
                  }
                  label="Emergency contact phone"
                >
                  <Input
                    disabled={isUsingExistingPatient}
                    inputMode="numeric"
                    maxLength={11}
                    pattern="[0-9]*"
                    placeholder="09XXXXXXXXX"
                    {...form.register("patient.emergencyContactPhone", {
                      setValueAs: (value) =>
                        sanitizeMobileNumber(String(value ?? "")),
                      onChange: (event) => {
                        const sanitized = sanitizeMobileNumber(
                          event.target.value,
                        );
                        if (sanitized !== event.target.value) {
                          event.target.value = sanitized;
                        }
                      },
                    })}
                  />
                </FormField>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-extrabold uppercase tracking-widest text-slate-500">
                  Optional vitals
                </p>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <FormField
                    error={form.formState.errors.patient?.temperature?.message}
                    label="Temperature"
                  >
                    <div className="space-y-1.5">
                      <Input
                        placeholder="36.8"
                        {...form.register("patient.temperature")}
                      />
                      {vitalAlertsByKey.get("temperature") ? (
                        <p
                          className={`text-[11px] ${
                            vitalAlertsByKey.get("temperature")?.level ===
                            "critical"
                              ? "text-rose-600"
                              : vitalAlertsByKey.get("temperature")?.level ===
                                  "warning"
                                ? "text-yellow-600"
                                : "text-emerald-600"
                          }`}
                        >
                          {vitalAlertsByKey.get("temperature")?.status}
                        </p>
                      ) : null}
                    </div>
                  </FormField>
                  <FormField
                    error={
                      form.formState.errors.patient?.bloodPressure?.message
                    }
                    label="Blood pressure"
                  >
                    <div className="space-y-1.5">
                      <Input
                        placeholder="120/80"
                        {...form.register("patient.bloodPressure")}
                      />
                      {vitalAlertsByKey.get("bloodPressure") ? (
                        <p
                          className={`text-[11px] ${
                            vitalAlertsByKey.get("bloodPressure")?.level ===
                            "critical"
                              ? "text-rose-600"
                              : vitalAlertsByKey.get("bloodPressure")?.level ===
                                  "warning"
                                ? "text-yellow-600"
                                : "text-emerald-600"
                          }`}
                        >
                          {vitalAlertsByKey.get("bloodPressure")?.status}
                        </p>
                      ) : null}
                    </div>
                  </FormField>
                  <FormField
                    error={form.formState.errors.patient?.heartRate?.message}
                    label="Heart rate"
                  >
                    <div className="space-y-1.5">
                      <Input
                        placeholder="76"
                        {...form.register("patient.heartRate")}
                      />
                      {vitalAlertsByKey.get("heartRate") ? (
                        <p
                          className={`text-[11px] ${
                            vitalAlertsByKey.get("heartRate")?.level ===
                            "critical"
                              ? "text-rose-600"
                              : vitalAlertsByKey.get("heartRate")?.level ===
                                  "warning"
                                ? "text-yellow-600"
                                : "text-emerald-600"
                          }`}
                        >
                          {vitalAlertsByKey.get("heartRate")?.status}
                        </p>
                      ) : null}
                    </div>
                  </FormField>
                  <FormField
                    error={form.formState.errors.patient?.o2Sat?.message}
                    label="O2 saturation"
                  >
                    <div className="space-y-1.5">
                      <Input
                        placeholder="99"
                        {...form.register("patient.o2Sat")}
                      />
                      {vitalAlertsByKey.get("o2Sat") ? (
                        <p
                          className={`text-[11px] ${
                            vitalAlertsByKey.get("o2Sat")?.level === "critical"
                              ? "text-rose-600"
                              : vitalAlertsByKey.get("o2Sat")?.level ===
                                  "warning"
                                ? "text-yellow-600"
                                : "text-emerald-600"
                          }`}
                        >
                          {vitalAlertsByKey.get("o2Sat")?.status}
                        </p>
                      ) : null}
                    </div>
                  </FormField>
                  <FormField
                    error={
                      form.formState.errors.patient?.respiratoryRate?.message
                    }
                    label="Respiratory rate"
                  >
                    <div className="space-y-1.5">
                      <Input
                        placeholder="16"
                        {...form.register("patient.respiratoryRate")}
                      />
                      {vitalAlertsByKey.get("respiratoryRate") ? (
                        <p
                          className={`text-[11px] ${
                            vitalAlertsByKey.get("respiratoryRate")?.level ===
                            "critical"
                              ? "text-rose-600"
                              : vitalAlertsByKey.get("respiratoryRate")
                                    ?.level === "warning"
                                ? "text-yellow-600"
                                : "text-emerald-600"
                          }`}
                        >
                          {vitalAlertsByKey.get("respiratoryRate")?.status}
                        </p>
                      ) : null}
                    </div>
                  </FormField>
                  <FormField
                    error={form.formState.errors.patient?.weight?.message}
                    label="Weight"
                  >
                    <div className="space-y-1.5">
                      <Input
                        placeholder="55"
                        {...form.register("patient.weight")}
                      />
                      {vitalAlertsByKey.get("bmi") ? (
                        <p
                          className={`text-[11px] ${
                            vitalAlertsByKey.get("bmi")?.level === "critical"
                              ? "text-rose-600"
                              : vitalAlertsByKey.get("bmi")?.level === "warning"
                                ? "text-yellow-600"
                                : "text-emerald-600"
                          }`}
                        >
                          BMI: {vitalAlertsByKey.get("bmi")?.status}
                        </p>
                      ) : null}
                    </div>
                  </FormField>
                  <FormField
                    error={form.formState.errors.patient?.height?.message}
                    label="Height"
                  >
                    <div className="space-y-1.5">
                      <Input
                        placeholder="160"
                        {...form.register("patient.height")}
                      />
                      {vitalAlertsByKey.get("bmi") ? (
                        <p
                          className={`text-[11px] ${
                            vitalAlertsByKey.get("bmi")?.level === "critical"
                              ? "text-rose-600"
                              : vitalAlertsByKey.get("bmi")?.level === "warning"
                                ? "text-yellow-600"
                                : "text-emerald-600"
                          }`}
                        >
                          BMI: {vitalAlertsByKey.get("bmi")?.status}
                        </p>
                      ) : null}
                    </div>
                  </FormField>
                </div>
              </div>
            </div>
          ) : null}

          {stage === "appointment" ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                  Patient and Provider
                </p>
                <p className="mt-1 text-sm font-bold text-slate-950">
                  {createdPatient
                    ? `${createdPatient.firstName} ${createdPatient.lastName}`
                    : "Patient selected"}
                </p>
              </div>

              <FormField
                error={form.formState.errors.appointment?.doctorId?.message}
                label="Doctor"
              >
                <Select {...form.register("appointment.doctorId")}>
                  <option value="">Select doctor</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.fullName}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField
                error={form.formState.errors.appointment?.serviceId?.message}
                label="Service"
              >
                <Select {...form.register("appointment.serviceId")}>
                  <option value="">Select service</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </Select>
              </FormField>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  error={form.formState.errors.appointment?.status?.message}
                  label="Status"
                >
                  <Select {...form.register("appointment.status")}>
                    <option value="confirmed">Confirmed</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="in_progress">In progress</option>
                    <option value="completed">Completed</option>
                  </Select>
                </FormField>
                <FormField
                  error={form.formState.errors.appointment?.source?.message}
                  label="Source"
                >
                  <Select {...form.register("appointment.source")}>
                    <option value="internal">Internal</option>
                    <option value="portal">Portal</option>
                  </Select>
                </FormField>
              </div>

              <FormField
                error={form.formState.errors.appointment?.visitType?.message}
                label="Visit type"
              >
                <Select {...form.register("appointment.visitType")}>
                  <option value="in_person">In person</option>
                  <option value="teleconsultation">Teleconsultation</option>
                </Select>
              </FormField>

              <div className="rounded-sm border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                Appointment schedule is now queue-based. When you create this
                appointment, the system will auto-assign queue number, scheduled
                time, and estimated end time.
              </div>

              <FormField
                error={form.formState.errors.appointment?.reason?.message}
                label="Reason"
              >
                <Input
                  placeholder="Reason for visit"
                  {...form.register("appointment.reason")}
                />
              </FormField>

              <FormField
                error={form.formState.errors.appointment?.notes?.message}
                label="Notes"
              >
                <Textarea
                  placeholder="Additional appointment notes"
                  {...form.register("appointment.notes")}
                />
              </FormField>
            </div>
          ) : null}

          {stage === "billing" ? (
            <div className="space-y-5">
              <div className="border border-emerald-200 bg-emerald-50/60 px-4 py-3">
                <p className="text-xs font-extrabold uppercase tracking-widest text-emerald-700">
                  Invoice Form
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-950">
                  Create the actual invoice before sending the patient to
                  consultation.
                </p>
              </div>

              <FormField
                error={form.formState.errors.billing?.patientId?.message}
                label="Select patient"
              >
                <div className="relative">
                  <Input
                    onBlur={() => {
                      window.setTimeout(
                        () => setIsInvoicePatientDropdownOpen(false),
                        120,
                      );
                    }}
                    onFocus={() => setIsInvoicePatientDropdownOpen(true)}
                    onChange={(event) => {
                      const query = event.target.value;
                      setInvoicePatientSearch(query);
                      setIsInvoicePatientDropdownOpen(true);

                      const exactMatch = patients.find(
                        (patient) =>
                          `${patient.firstName} ${patient.lastName}`
                            .trim()
                            .toLowerCase() === query.trim().toLowerCase(),
                      );

                      if (exactMatch) {
                        form.setValue("billing.patientId", exactMatch.id, {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                        return;
                      }

                      form.setValue("billing.patientId", "", {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }}
                    placeholder="Type patient name"
                    value={invoicePatientSearch}
                  />
                  {isInvoicePatientDropdownOpen ? (
                    <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto border border-slate-200 bg-white shadow-lg">
                      {filteredInvoicePatients.length > 0 ? (
                        filteredInvoicePatients.slice(0, 20).map((patient) => (
                          <button
                            className={`block w-full px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${
                              selectedBillingPatientId === patient.id
                                ? "bg-emerald-50 text-emerald-800"
                                : "text-slate-700"
                            }`}
                            key={patient.id}
                            onMouseDown={() => {
                              form.setValue("billing.patientId", patient.id, {
                                shouldDirty: true,
                                shouldValidate: true,
                              });
                              setInvoicePatientSearch(
                                `${patient.firstName} ${patient.lastName}`,
                              );
                              setIsInvoicePatientDropdownOpen(false);
                            }}
                            type="button"
                          >
                            {patient.firstName} {patient.lastName}
                          </button>
                        ))
                      ) : (
                        <p className="px-3 py-2 text-xs text-slate-500">
                          No matching patients found.
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              </FormField>

              <FormField label="Tag from booking">
                <Select
                  {...form.register("billing.bookingId")}
                  onChange={(event) => {
                    const booking =
                      bookings.find((item) => item.id === event.target.value) ??
                      null;
                    form.setValue("billing.bookingId", event.target.value);
                    if (!booking) {
                      form.setValue("billing.items", [
                        {
                          description:
                            selectedService?.name ?? "General Consultation",
                          category: "consultation",
                          quantity: 1,
                          unitPrice: selectedService?.price ?? 800,
                        },
                      ]);
                      return;
                    }

                    form.setValue("billing.patientId", booking.patientId, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                    const bookingPatient =
                      patients.find(
                        (patient) => patient.id === booking.patientId,
                      ) ?? null;
                    if (bookingPatient) {
                      setInvoicePatientSearch(
                        `${bookingPatient.firstName} ${bookingPatient.lastName}`,
                      );
                    }
                    form.setValue("billing.items", [
                      {
                        description:
                          booking.feeType === "follow_up"
                            ? "Follow-up Consultation"
                            : "Consultation Fee",
                        category: "consultation",
                        quantity: 1,
                        unitPrice: booking.feeAmount,
                      },
                    ]);
                  }}
                >
                  <option value="">Manual entry</option>
                  {bookings.map((booking) => {
                    const patient = patients.find(
                      (item) => item.id === booking.patientId,
                    );
                    return (
                      <option key={booking.id} value={booking.id}>
                        {patient?.firstName} {patient?.lastName} -{" "}
                        {booking.feeType === "follow_up"
                          ? "Follow-up"
                          : "Consultation"}
                      </option>
                    );
                  })}
                </Select>
              </FormField>

              <FormField label="Link to appointment (optional but recommended)">
                <Select
                  {...form.register("billing.appointmentId")}
                  onChange={(event) => {
                    form.setValue("billing.appointmentId", event.target.value);
                  }}
                >
                  <option value="">Select an appointment</option>
                  {(createdAppointment ? [createdAppointment] : appointments)
                    .filter(
                      (appointment) =>
                        appointment.patientId ===
                        form.watch("billing.patientId"),
                    )
                    .filter(
                      (appointment) =>
                        !["cancelled", "completed", "no_show"].includes(
                          appointment.status,
                        ),
                    )
                    .sort(
                      (left, right) =>
                        new Date(right.scheduledAt).getTime() -
                        new Date(left.scheduledAt).getTime(),
                    )
                    .map((appointment) => {
                      const scheduled = new Date(appointment.scheduledAt);
                      const formatted = scheduled.toLocaleDateString("en-PH", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      });

                      return (
                        <option key={appointment.id} value={appointment.id}>
                          {formatted} - {appointment.status}
                        </option>
                      );
                    })}
                </Select>
              </FormField>

              <FormField
                error={form.formState.errors.billing?.companyId?.message}
                label="Company (optional)"
              >
                <div className="relative">
                  <Input
                    onBlur={() => {
                      window.setTimeout(
                        () => setIsCompanyDropdownOpen(false),
                        120,
                      );
                    }}
                    onFocus={() => setIsCompanyDropdownOpen(true)}
                    onChange={(event) => {
                      const query = event.target.value;
                      setCompanySearch(query);
                      setIsCompanyDropdownOpen(true);

                      const exactMatch = companies.find(
                        (c) =>
                          c.companyName.trim().toLowerCase() ===
                            query.trim().toLowerCase() ||
                          c.companyCode.trim().toLowerCase() ===
                            query.trim().toLowerCase(),
                      );

                      if (exactMatch) {
                        form.setValue("billing.companyId", exactMatch.id, {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                        return;
                      }

                      form.setValue("billing.companyId", "", {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }}
                    placeholder="Search/type company name"
                    value={companySearch}
                  />
                  {isCompanyDropdownOpen ? (
                    <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto border border-slate-200 bg-white shadow-lg">
                      {filteredCompanies.length > 0 ? (
                        filteredCompanies.map((company) => (
                          <button
                            className={`block w-full px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${
                              selectedBillingCompanyId === company.id
                                ? "bg-emerald-50 text-emerald-800"
                                : "text-slate-700"
                            }`}
                            key={company.id}
                            onMouseDown={() => {
                              form.setValue("billing.companyId", company.id, {
                                shouldDirty: true,
                                shouldValidate: true,
                              });
                              setCompanySearch(company.companyName);
                              setIsCompanyDropdownOpen(false);
                            }}
                            type="button"
                          >
                            {company.companyName} {company.companyCode ? `(${company.companyCode})` : ""}
                          </button>
                        ))
                      ) : (
                        <p className="px-3 py-2 text-xs text-slate-500">
                          No matching companies found.
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              </FormField>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Payment status">
                  <Select {...form.register("billing.paymentStatus")}>
                    <option value="paid">Paid</option>
                    <option value="unpaid">Unpaid</option>
                  </Select>
                </FormField>

                {selectedBillingPaymentStatus === "paid" ? (
                  <FormField
                    error={
                      form.formState.errors.billing?.referenceNumber?.message
                    }
                    label="Reference number"
                  >
                    <Input
                      placeholder="Enter reference number"
                      {...form.register("billing.referenceNumber")}
                    />
                  </FormField>
                ) : null}
              </div>

              {selectedBillingPaymentStatus === "paid" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Payment type">
                    <Select {...form.register("billing.paymentType")}>
                      <option value="cash">Cash</option>
                      <option value="gcash">GCash</option>
                      <option value="card">Card</option>
                    </Select>
                  </FormField>
                </div>
              ) : null}

              <div className="space-y-4 border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                      Line items
                    </p>
                    <p className="text-sm text-slate-500">
                      Add the invoice items that will be printed on the receipt.
                    </p>
                  </div>
                  <Button
                    className="rounded-none border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-slate-700 hover:bg-slate-100"
                    onClick={() =>
                      billingItems.append({
                        description: "New service",
                        category: "other",
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

                {billingItems.fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">
                        Item {index + 1}
                      </p>
                      {billingItems.fields.length > 1 ? (
                        <button
                          className="text-xs font-semibold uppercase tracking-widest text-rose-600 hover:text-rose-700"
                          onClick={() => billingItems.remove(index)}
                          type="button"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                    <div className="grid gap-4 md:grid-cols-4">
                      <FormField
                        error={
                          form.formState.errors.billing?.items?.[index]
                            ?.description?.message
                        }
                        label="Description"
                      >
                        <Input
                          placeholder="Service description"
                          {...form.register(
                            `billing.items.${index}.description` as const,
                          )}
                        />
                      </FormField>
                      <FormField
                        error={
                          form.formState.errors.billing?.items?.[index]
                            ?.category?.message
                        }
                        label="Category"
                      >
                        <Select
                          {...form.register(
                            `billing.items.${index}.category` as const,
                          )}
                        >
                          <option value="consultation">Consultation</option>
                          <option value="laboratory">Laboratory</option>
                          <option value="medicine">Medicine</option>
                          <option value="other">Other</option>
                        </Select>
                      </FormField>
                      <FormField
                        error={
                          form.formState.errors.billing?.items?.[index]
                            ?.quantity?.message
                        }
                        label="Qty"
                      >
                        <Input
                          placeholder="1"
                          type="number"
                          {...form.register(
                            `billing.items.${index}.quantity` as const,
                            { valueAsNumber: true },
                          )}
                        />
                      </FormField>
                      <FormField
                        error={
                          form.formState.errors.billing?.items?.[index]
                            ?.unitPrice?.message
                        }
                        label="Unit price"
                      >
                        <Input
                          placeholder="0.00"
                          type="number"
                          {...form.register(
                            `billing.items.${index}.unitPrice` as const,
                            { valueAsNumber: true },
                          )}
                        />
                      </FormField>
                    </div>
                  </div>
                ))}
                <p className="text-sm font-semibold text-slate-700">
                  Total:{" "}
                  {formatCurrency(
                    (billingLineItems ?? []).reduce(
                      (sum, item) =>
                        sum +
                        (Number(item.quantity) || 0) *
                          (Number(item.unitPrice) || 0),
                      0,
                    ),
                  )}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                Billing completion will mark the appointment as in progress and
                send the patient to consultation.
              </div>
            </div>
          ) : null}

          {stage === "complete" ? (
            <div className="space-y-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
              <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-emerald-700">
                Workflow complete
              </p>
              <h3 className="text-2xl font-black tracking-tight text-slate-950">
                Patient is ready for consultation
              </h3>
              <p className="max-w-2xl text-sm text-emerald-900/80">
                The patient record, appointment, and billing record were created
                in one flow, and the appointment has been marked in progress.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  className="rounded-none bg-emerald-700 px-4 py-2.5 text-sm font-extrabold uppercase tracking-widest hover:bg-emerald-800"
                  onClick={onClose}
                  type="button"
                >
                  Finish
                </Button>
                <Button
                  className="rounded-none border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
                  onClick={() => void handlePrintBillingReceipt()}
                  type="button"
                  variant="secondary"
                >
                  Print billing receipt
                </Button>
                <Button
                  className="rounded-none border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
                  onClick={handleSaveBillingReceiptAsPdf}
                  type="button"
                  variant="secondary"
                >
                  Save receipt as PDF
                </Button>
                <Button
                  className="rounded-none border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
                  onClick={handleReprintQueueNumber}
                  type="button"
                  variant="secondary"
                >
                  Print queue number
                </Button>
                {createdPatient ? (
                  <Link
                    className="inline-flex items-center border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
                    to={`/app/patients/${createdPatient.id}`}
                  >
                    Open patient chart
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        {stage !== "complete" ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
            <div className="text-xs text-slate-500">
              Step {stepIndex + 1} of 4
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                className="rounded-none border-slate-300 px-4 py-2 text-sm font-bold uppercase tracking-widest"
                disabled={isBusy || stage === "patient"}
                onClick={() =>
                  setStage(
                    stage === "billing"
                      ? "appointment"
                      : stage === "appointment"
                        ? "patient"
                        : stage,
                  )
                }
                type="button"
                variant="secondary"
              >
                Back
              </Button>
              <Button
                className="bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:brightness-95"
                disabled={isBusy}
                onClick={() => {
                  if (stage === "patient") {
                    void handlePatientStep();
                  } else if (stage === "appointment") {
                    void handleAppointmentStep();
                  } else if (stage === "billing") {
                    void handleBillingStep();
                  }
                }}
                type="button"
              >
                {isBusy
                  ? "Saving..."
                  : stage === "patient"
                    ? isUsingExistingPatient
                      ? "Next"
                      : "Save patient"
                    : stage === "appointment"
                      ? "Create appointment"
                      : "Bill and send to doctor"}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
