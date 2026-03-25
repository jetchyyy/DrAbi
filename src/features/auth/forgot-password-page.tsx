import { PasswordResetForm } from './components/password-reset-form';

export function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f7fbff_0%,#fefbf6_100%)] px-4">
      <PasswordResetForm />
    </div>
  );
}

