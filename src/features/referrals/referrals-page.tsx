import { useAuth } from '../auth/auth-context';
import { ReferralFrontdeskPage } from './referral-frontdesk-page';
import { SpecialistReferralsPage } from './specialist-referrals-page';

export function ReferralsPage() {
  const { profile } = useAuth();
  return profile?.role === 'doctor'
    ? <SpecialistReferralsPage />
    : <ReferralFrontdeskPage />;
}
