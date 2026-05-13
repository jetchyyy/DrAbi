import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "../../components/ui/button";
import { Card, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { getWalkInPatientByUniqueLoginIdLiveOrDemo } from "../../lib/supabase-clinic";
import { clearWalkInUniqueSession, saveWalkInUniqueSession } from "./walk-in-unique-session";

const uniqueLoginSchema = z.object({
  uniqueLoginId: z.string().min(4, "Enter your walk-in Unique ID."),
});

type UniqueLoginFormValues = z.infer<typeof uniqueLoginSchema>;

export function WalkInUniqueLoginPage() {
  const navigate = useNavigate();
  const form = useForm<UniqueLoginFormValues>({
    resolver: zodResolver(uniqueLoginSchema),
    defaultValues: {
      uniqueLoginId: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const uniqueLoginId = values.uniqueLoginId.trim().toUpperCase();
      const profile = await getWalkInPatientByUniqueLoginIdLiveOrDemo(
        uniqueLoginId,
      );

      if (!profile) {
        toast.error("Unique ID not found. Please check the code from front desk.");
        return;
      }

      if (profile.accountLinked) {
        toast.error(
          "This Unique ID already has an account. Please sign in with email and password.",
        );
        return;
      }

      clearWalkInUniqueSession();
      saveWalkInUniqueSession({
        uniqueLoginId,
        profile,
      });
      navigate("/portal/walk-in/setup");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to verify the Unique ID.",
      );
    }
  });

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-xl items-center px-4 py-10">
      <Card className="w-full border-slate-200 bg-white shadow-lg">
        <div className="mb-6 border-l-4 border-[var(--color-primary)] pl-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
            Walk-In Patient Portal
          </p>
          <CardTitle className="mt-1 text-2xl">Unique ID Login</CardTitle>
          <p className="mt-2 text-sm text-slate-500">
            Enter the Unique ID provided by front desk to start your account setup.
          </p>
        </div>

        <form className="space-y-5" onSubmit={onSubmit}>
          <div className="space-y-2">
            <label
              className="text-sm font-semibold text-slate-700"
              htmlFor="walk-in-unique-id"
            >
              Unique ID
            </label>
            <Input
              id="walk-in-unique-id"
              placeholder="ODC-WALK-XXXXXXXXXX"
              {...form.register("uniqueLoginId")}
            />
            {form.formState.errors.uniqueLoginId?.message ? (
              <p className="text-xs font-medium text-rose-600">
                {form.formState.errors.uniqueLoginId.message}
              </p>
            ) : null}
          </div>

          <Button
            className="w-full gap-2"
            disabled={form.formState.isSubmitting}
            type="submit"
          >
            {form.formState.isSubmitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <KeyRound className="size-4" />
            )}
            Continue
          </Button>
        </form>

        <div className="mt-6 border-t border-slate-200 pt-4 text-center text-sm text-slate-500">
          Already set up your account?{" "}
          <Link className="font-semibold text-slate-700 hover:underline" to="/login">
            Sign in here
          </Link>
        </div>
      </Card>
    </div>
  );
}
