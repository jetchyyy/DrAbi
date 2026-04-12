import { useEffect, useState } from 'react';
import { Bell, LogOut, Menu, Search, ShieldEllipsis, Stethoscope } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '../../features/auth/auth-context';
import { useClinicSettingsData } from '../../hooks/use-clinic-data';
import { appNavigation } from '../../config/navigation';
import { defaultClinicSettings } from '../../config/clinic';
import { roleLabels } from '../../config/permissions';
import { Button } from '../ui/button';
import { cn, getInitials } from '../../lib/utils';

export function AppShell() {
  const { profile, can, pinSetupRequired, pinVerificationRequired, setSecurityPin, verifySecurityPin, signOut } = useAuth();
  const { data: clinic = defaultClinicSettings } = useClinicSettingsData();
  const profileRoleLabel = profile?.accessRoleName ?? (profile ? roleLabels[profile.role] : 'Unknown role');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [activePinField, setActivePinField] = useState<'pin' | 'confirm'>('pin');
  const [pinError, setPinError] = useState('');
  const [savingPin, setSavingPin] = useState(false);

  useEffect(() => {
    if (!pinSetupRequired && !pinVerificationRequired) {
      setPin('');
      setConfirmPin('');
      setActivePinField('pin');
      setPinError('');
    }
  }, [pinSetupRequired, pinVerificationRequired]);

  const pinPadKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'] as const;

  const handlePinDigit = (digit: string) => {
    if (pinError) setPinError('');

    if (activePinField === 'pin') {
      if (pin.length >= 6) {
        return;
      }

      const nextPin = `${pin}${digit}`;
      setPin(nextPin);
      if (pinSetupRequired && nextPin.length === 6) {
        setActivePinField('confirm');
      }
      return;
    }

    if (confirmPin.length >= 6) {
      return;
    }

    setConfirmPin(`${confirmPin}${digit}`);
  };

  const handlePinBackspace = () => {
    if (pinError) setPinError('');

    if (activePinField === 'confirm') {
      if (confirmPin.length > 0) {
        setConfirmPin(confirmPin.slice(0, -1));
        return;
      }

      setActivePinField('pin');
    }

    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
    }
  };

  const handleSavePin = async () => {
    if (pinVerificationRequired) {
      if (!/^\d{6}$/.test(pin)) {
        setPinError('PIN must be exactly 6 digits.');
        return;
      }

      try {
        setSavingPin(true);
        setPinError('');
        await verifySecurityPin(pin);
      } catch (error) {
        setPinError(error instanceof Error ? error.message : 'Unable to verify your PIN.');
      } finally {
        setSavingPin(false);
      }
      return;
    }

    if (!/^\d{6}$/.test(pin)) {
      setPinError('PIN must be exactly 6 digits.');
      return;
    }

    if (pin !== confirmPin) {
      setPinError('PIN entries do not match.');
      return;
    }

    try {
      setSavingPin(true);
      setPinError('');
      await setSecurityPin(pin);
    } catch (error) {
      setPinError(error instanceof Error ? error.message : 'Unable to save your PIN.');
    } finally {
      setSavingPin(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-100">

      {/* ── White Sidebar ────────────────────────────────────── */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-white border-r border-slate-200 lg:flex overflow-hidden">

        {/* Brand */}
        <div className="px-5 pt-6 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-600 text-white shrink-0">
              <Stethoscope className="size-4" />
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-orange-600">Clinic OS</p>
              <h1 className="text-sm font-extrabold leading-tight text-slate-950">{clinic.clinicName}</h1>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 pt-4 pb-2 space-y-0.5 overflow-y-auto">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-3 pb-2">Main Menu</p>
          {appNavigation
            .filter((item) => can(item.permission) && (!item.roles || (profile ? item.roles.includes(profile.role) : false)))
            .map((item) => (
              <NavLink
                key={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 text-sm font-semibold transition-all duration-150',
                    isActive
                      ? 'bg-orange-50 text-orange-700 border-l-[3px] border-orange-600 font-extrabold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-l-[3px] border-transparent',
                  )
                }
                to={item.to}
              >
                <item.icon className="size-4 shrink-0" />
                {item.label}
              </NavLink>
            ))}
        </nav>

        {/* User profile footer */}
        <div className="border-t border-slate-100 px-4 py-4 space-y-2">
          <div className="flex items-center gap-3 px-1">
            <div className="flex h-8 w-8 items-center justify-center bg-orange-600 text-white text-xs font-extrabold shrink-0">
              {getInitials(profile?.fullName ?? 'Guest User')}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-950 truncate leading-tight">{profile?.fullName ?? 'Guest'}</p>
              <p className="text-[11px] text-slate-400 font-medium truncate">{profileRoleLabel}</p>
            </div>
          </div>
          <button
            onClick={() => void signOut()}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors"
          >
            <LogOut className="size-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main Content ──────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white px-6 py-3.5 shadow-sm flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button className="border border-slate-200 p-2 text-slate-700 lg:hidden" type="button">
              <Menu className="size-5" />
            </button>
            <div className="hidden items-center gap-2.5 border border-slate-200 bg-slate-50 px-4 py-2 md:flex">
              <Search className="size-4 text-slate-400" />
              <span className="text-sm text-slate-400">Search patients, appointments, invoices…</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {profile?.role === 'owner_admin' ? (
              <NavLink
                className="border border-slate-200 p-2.5 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors"
                title="Super Admin Console"
                to="/odc"
              >
                <ShieldEllipsis className="size-4" />
              </NavLink>
            ) : null}
            <button className="border border-slate-200 p-2.5 text-slate-500 hover:bg-slate-50 transition-colors" type="button">
              <Bell className="size-4" />
            </button>
            <div className="hidden md:flex items-center gap-2.5 border border-slate-200 bg-white px-3 py-2">
              <div className="flex h-8 w-8 items-center justify-center bg-orange-600 text-white text-xs font-extrabold shrink-0">
                {getInitials(profile?.fullName ?? 'Guest User')}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 leading-none">{profile?.fullName}</p>
                <p className="text-xs text-slate-400 mt-0.5">{profile?.accessRoleName ?? (profile ? roleLabels[profile.role] : 'Guest')}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-8 w-full max-w-[1600px] mx-auto">
          <Outlet />
        </main>
      </div>

      {pinSetupRequired || pinVerificationRequired ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-md overflow-hidden border border-slate-200 bg-white shadow-2xl">
            <div className="bg-orange-600 px-6 py-4 text-white">
              <p className="text-xs font-extrabold uppercase tracking-widest text-orange-100">
                {pinVerificationRequired ? 'Security PIN Verification' : 'Security PIN Required'}
              </p>
              <h2 className="mt-1 text-lg font-extrabold tracking-tight">
                {pinVerificationRequired ? 'Enter your 6-digit PIN to continue' : 'Set your 6-digit PIN to continue'}
              </h2>
              <p className="mt-2 text-sm text-orange-50">
                {pinVerificationRequired
                  ? 'Your password was accepted. Enter your security PIN to unlock the system.'
                  : 'Your account needs a security PIN before you can continue using the system.'}
              </p>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="space-y-3">
                <div className={cn('grid gap-3', pinSetupRequired ? 'sm:grid-cols-2' : 'sm:grid-cols-1')}>
                  <button
                    className={cn(
                      'rounded-2xl border px-4 py-3 text-left transition-colors',
                      activePinField === 'pin' ? 'border-orange-500 bg-orange-50' : 'border-slate-200 bg-slate-50',
                    )}
                    onClick={() => setActivePinField('pin')}
                    type="button"
                  >
                    <p className="text-xs font-extrabold uppercase tracking-widest text-slate-500">
                      {pinVerificationRequired ? 'Security PIN' : 'PIN'}
                    </p>
                    <div className="mt-3 flex gap-2">
                      {Array.from({ length: 6 }).map((_, index) => (
                        <span
                          className={cn(
                            'size-3 rounded-full border',
                            index < pin.length ? 'border-orange-600 bg-orange-600' : 'border-slate-300 bg-white',
                          )}
                          key={`pin-dot-${index}`}
                        />
                      ))}
                    </div>
                  </button>

                  {pinSetupRequired ? (
                    <button
                      className={cn(
                        'rounded-2xl border px-4 py-3 text-left transition-colors',
                        activePinField === 'confirm' ? 'border-orange-500 bg-orange-50' : 'border-slate-200 bg-slate-50',
                      )}
                      onClick={() => setActivePinField('confirm')}
                      type="button"
                    >
                      <p className="text-xs font-extrabold uppercase tracking-widest text-slate-500">Confirm PIN</p>
                      <div className="mt-3 flex gap-2">
                        {Array.from({ length: 6 }).map((_, index) => (
                          <span
                            className={cn(
                              'size-3 rounded-full border',
                              index < confirmPin.length ? 'border-orange-600 bg-orange-600' : 'border-slate-300 bg-white',
                            )}
                            key={`confirm-pin-dot-${index}`}
                          />
                        ))}
                      </div>
                    </button>
                  ) : null}
                </div>

                <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
                  {pinVerificationRequired
                    ? 'Enter your 6-digit security PIN'
                    : activePinField === 'pin'
                      ? 'Enter your 6-digit PIN'
                      : 'Re-enter your PIN to confirm'}
                </p>
              </div>

              <div className="mx-auto grid w-full max-w-[280px] grid-cols-3 justify-items-center gap-3">
                {pinPadKeys.slice(0, 9).map((digit) => (
                  <button
                    className="flex size-16 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-extrabold text-slate-900 shadow-sm transition hover:border-orange-300 hover:bg-orange-50"
                    key={digit}
                    onClick={() => handlePinDigit(digit)}
                    type="button"
                  >
                    {digit}
                  </button>
                ))}
                <div className="size-16" />
                <button
                  className="flex size-16 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-extrabold text-slate-900 shadow-sm transition hover:border-orange-300 hover:bg-orange-50"
                  onClick={() => handlePinDigit('0')}
                  type="button"
                >
                  0
                </button>
                <button
                  className="flex size-16 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-xs font-extrabold uppercase tracking-widest text-slate-600 shadow-sm transition hover:border-orange-300 hover:bg-orange-50"
                  onClick={handlePinBackspace}
                  type="button"
                >
                  Delete
                </button>
              </div>

              {pinError ? <p className="text-sm font-medium text-rose-600">{pinError}</p> : null}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button className="w-full rounded-none sm:w-auto" onClick={() => void signOut()} type="button" variant="secondary">
                  Sign out
                </Button>
                <Button className="w-full rounded-none bg-orange-600 hover:bg-orange-700 sm:w-auto" disabled={savingPin} onClick={() => void handleSavePin()} type="button">
                  {savingPin ? (pinVerificationRequired ? 'Verifying...' : 'Saving...') : pinVerificationRequired ? 'Verify PIN' : 'Save PIN'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
