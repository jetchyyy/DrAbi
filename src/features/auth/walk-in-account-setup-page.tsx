import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, UserRoundPlus } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "../../components/ui/button";
import { Card, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { claimWalkInPatientAccountLiveOrDemo } from "../../lib/supabase-clinic";
import { useAuth } from "./auth-context";
import {
  clearWalkInUniqueSession,
  readWalkInUniqueSession,
} from "./walk-in-unique-session";

const setupSchema = z
  .object({
    email: z.string().email("Enter a valid email address."),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .regex(/[A-Z]/, "Password must include an uppercase letter.")
      .regex(/[a-z]/, "Password must include a lowercase letter.")
      .regex(/\d/, "Password must include a number."),
    confirmPassword: z.string().min(1, "Confirm your password."),
    phone: z.string().min(5, "Phone number is required."),
    address: z.string().min(4, "Address is required."),
    allergies: z.string().min(1, "Allergies field is required."),
    medicalHistory: z.string().min(1, "Medical history field is required."),
    emergencyContactName: z.string().min(2, "Emergency contact name is required."),
    emergencyContactPhone: z
      .string()
      .min(5, "Emergency contact phone is required."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

type SetupFormValues = z.infer<typeof setupSchema>;

export function WalkInAccountSetupPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const sessionPayload = useMemo(() => readWalkInUniqueSession(), []);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<SetupFormValues>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      email: sessionPayload?.profile.email ?? "",
      password: "",
      confirmPassword: "",
      phone: sessionPayload?.profile.mobileNumber ?? "",
      address: sessionPayload?.profile.address ?? "",
      allergies: sessionPayload?.profile.allergies ?? "",
      medicalHistory: sessionPayload?.profile.medicalHistory ?? "",
      emergencyContactName: sessionPayload?.profile.emergencyContactName ?? "",
      emergencyContactPhone:
        sessionPayload?.profile.emergencyContactPhone ?? "",
    },
  });

  useEffect(() => {
    if (!sessionPayload) {
      navigate("/portal/walk-in/login", { replace: true });
    }
  }, [navigate, sessionPayload]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!sessionPayload) {
      toast.error("Unique ID session expired. Please login again.");
      navigate("/portal/walk-in/login", { replace: true });
      return;
    }

    try {
      const normalizedEmail = values.email.trim().toLowerCase();
      await claimWalkInPatientAccountLiveOrDemo({
        uniqueLoginId: sessionPayload.uniqueLoginId,
        email: normalizedEmail,
        password: values.password,
        phone: values.phone,
        address: values.address,
        allergies: values.allergies,
        medicalHistory: values.medicalHistory,
        emergencyContactName: values.emergencyContactName,
        emergencyContactPhone: values.emergencyContactPhone,
      });

      await signIn(normalizedEmail, values.password);
      clearWalkInUniqueSession();
      toast.success("Account setup complete.");
      navigate("/portal/medical-history", { replace: true });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to complete account setup.",
      );
    }
  });

  if (!sessionPayload) {
    return null;
  }

  const { profile } = sessionPayload;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-10">
      <Card className="w-full border-slate-200 bg-white shadow-lg">
        <div className="mb-6 border-l-4 border-[var(--color-primary)] pl-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
            Walk-In Account Setup
          </p>
          <CardTitle className="mt-1 text-2xl">
            Complete Patient Registration
          </CardTitle>
          <p className="mt-2 text-sm text-slate-500">
            Set your account credentials and confirm your contact information.
          </p>
        </div>

        <div className="mb-5 grid gap-3 border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
              Patient
            </p>
            <p className="mt-1 font-semibold text-slate-900">
              {profile.firstName} {profile.lastName}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
              Birth Date
            </p>
            <p className="mt-1 font-semibold text-slate-900">{profile.birthDate}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
              Unique ID
            </p>
            <p className="mt-1 font-mono font-semibold text-slate-900">
              {sessionPayload.uniqueLoginId}
            </p>
          </div>
        </div>

        <form className="space-y-5" onSubmit={onSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormRow
              error={form.formState.errors.email?.message}
              id="walk-in-email"
              label="Email"
            >
              <Input id="walk-in-email" type="email" {...form.register("email")} />
            </FormRow>
            <FormRow
              error={form.formState.errors.phone?.message}
              id="walk-in-phone"
              label="Phone"
            >
              <Input id="walk-in-phone" {...form.register("phone")} />
            </FormRow>
            <FormRow
              error={form.formState.errors.password?.message}
              id="walk-in-password"
              label="Password"
            >
              <div className="relative">
                <Input
                  id="walk-in-password"
                  type={showPassword ? "text" : "password"}
                  className="pr-10"
                  {...form.register("password")}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-700"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </FormRow>
            <FormRow
              error={form.formState.errors.confirmPassword?.message}
              id="walk-in-confirm-password"
              label="Confirm Password"
            >
              <div className="relative">
                <Input
                  id="walk-in-confirm-password"
                  type={showPassword ? "text" : "password"}
                  className="pr-10"
                  {...form.register("confirmPassword")}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-700"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </FormRow>
          </div>

          <FormRow
            error={form.formState.errors.address?.message}
            id="walk-in-address"
            label="Address"
          >
            <Input id="walk-in-address" {...form.register("address")} />
          </FormRow>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormRow
              error={form.formState.errors.allergies?.message}
              id="walk-in-allergies"
              label="Allergies"
            >
              <Textarea id="walk-in-allergies" rows={3} {...form.register("allergies")} />
            </FormRow>
            <FormRow
              error={form.formState.errors.medicalHistory?.message}
              id="walk-in-history"
              label="Medical History"
            >
              <Textarea
                id="walk-in-history"
                rows={3}
                {...form.register("medicalHistory")}
              />
            </FormRow>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormRow
              error={form.formState.errors.emergencyContactName?.message}
              id="walk-in-emergency-name"
              label="Emergency Contact Name"
            >
              <Input
                id="walk-in-emergency-name"
                {...form.register("emergencyContactName")}
              />
            </FormRow>
            <FormRow
              error={form.formState.errors.emergencyContactPhone?.message}
              id="walk-in-emergency-phone"
              label="Emergency Contact Phone"
            >
              <Input
                id="walk-in-emergency-phone"
                {...form.register("emergencyContactPhone")}
              />
            </FormRow>
          </div>

          <Button
            className="w-full gap-2"
            disabled={form.formState.isSubmitting}
            type="submit"
          >
            {form.formState.isSubmitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <UserRoundPlus className="size-4" />
            )}
            Complete Setup
          </Button>
        </form>

        <div className="mt-6 border-t border-slate-200 pt-4 text-center text-sm text-slate-500">
          Wrong Unique ID?{" "}
          <Link
            className="font-semibold text-slate-700 hover:underline"
            onClick={() => clearWalkInUniqueSession()}
            to="/portal/walk-in/login"
          >
            Go back
          </Link>
        </div>
      </Card>
    </div>
  );
}

function FormRow({
  children,
  error,
  id,
  label,
}: {
  children: ReactNode;
  error?: string;
  id: string;
  label: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-slate-700" htmlFor={id}>
        {label}
      </label>
      {children}
      {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
    </div>
  );
}
