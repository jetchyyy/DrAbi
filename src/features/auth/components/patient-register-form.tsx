import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

import { FormField } from "../../../components/forms/form-field";
import { Button } from "../../../components/ui/button";
import { Card, CardTitle } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import { useAuth } from "../auth-context";

const registerSchema = z.object({
  fullName: z.string().min(2),
  email: z
    .string()
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  phone: z.string().min(5),
  sex: z.enum(["male", "female", "other"]),
  birthDate: z.string().min(1),
  address: z.string().min(4),
  allergies: z.string().min(2),
  medicalHistory: z.string().min(4),
  emergencyContactName: z.string().min(2),
  emergencyContactPhone: z.string().min(5),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export function PatientRegisterForm() {
  const { signUpPatient } = useAuth();
  const navigate = useNavigate();
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      phone: "",
      sex: "female",
      birthDate: "",
      address: "",
      allergies: "None reported",
      medicalHistory: "No significant medical history yet",
      emergencyContactName: "",
      emergencyContactPhone: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const result = await signUpPatient(values);
      if (result.requiresEmailConfirmation) {
        toast.success(
          "Account created. Verify your email, then sign in before booking an appointment.",
        );
        navigate("/login", { replace: true });
        return;
      }

      toast.success("Account created. You can now book your appointment.");
      navigate("/portal/book", { replace: true });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to create your account.",
      );
    }
  });

  return (
    <Card className="w-full max-w-2xl p-8">
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-[0.18em] text-slate-400">
          Patient Portal
        </p>
        <CardTitle className="text-3xl">Create account</CardTitle>
        <p className="text-sm text-slate-500">
          Patients who register here are added to the clinic registry right away
          and stay tagged as not yet visited until their first clinic visit.
        </p>
      </div>

      <form className="mt-8 space-y-4" onSubmit={onSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            error={form.formState.errors.fullName?.message}
            label="Full name"
          >
            <Input {...form.register("fullName")} />
          </FormField>
          <FormField error={form.formState.errors.email?.message} label="Email">
            <Input {...form.register("email")} />
          </FormField>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <FormField
            error={form.formState.errors.password?.message}
            label="Password"
          >
            <Input type="password" {...form.register("password")} />
          </FormField>
          <FormField error={form.formState.errors.phone?.message} label="Phone">
            <Input {...form.register("phone")} />
          </FormField>
          <FormField label="Sex">
            <Select {...form.register("sex")}>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </Select>
          </FormField>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            error={form.formState.errors.birthDate?.message}
            label="Birth date"
          >
            <Input type="date" {...form.register("birthDate")} />
          </FormField>
          <FormField
            error={form.formState.errors.address?.message}
            label="Address"
          >
            <Input {...form.register("address")} />
          </FormField>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            error={form.formState.errors.allergies?.message}
            label="Allergies"
          >
            <Input {...form.register("allergies")} />
          </FormField>
          <FormField
            error={form.formState.errors.emergencyContactName?.message}
            label="Emergency contact name"
          >
            <Input {...form.register("emergencyContactName")} />
          </FormField>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            error={form.formState.errors.emergencyContactPhone?.message}
            label="Emergency contact phone"
          >
            <Input {...form.register("emergencyContactPhone")} />
          </FormField>
          <FormField
            error={form.formState.errors.medicalHistory?.message}
            label="Medical history"
          >
            <Textarea rows={3} {...form.register("medicalHistory")} />
          </FormField>
        </div>
        <Button className="w-full" type="submit">
          Create patient account
        </Button>
      </form>
    </Card>
  );
}
