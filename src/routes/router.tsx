import { createBrowserRouter, Navigate } from "react-router-dom";

import { AppShell } from "../components/layout/app-shell";
import { PublicLayout } from "../components/layout/public-layout";
import { SpecialistShell } from "../components/layout/specialist-shell";
import { SettingsLayout } from "../components/layout/settings-layout";
import { AppointmentsPage } from "../features/appointments/appointments-page";
import { ForgotPasswordPage } from "../features/auth/forgot-password-page";
import { LoginPage } from "../features/auth/login-page";
import { PatientRegisterPage } from "../features/auth/patient-register-page";
import { ResetPasswordPage } from "../features/auth/reset-password-page";
import { BillingPage } from "../features/billing/billing-page";
import { BookingReceiptScanPage } from "../features/booking/booking-receipt-scan-page";
import { PatientMedicalHistoryPage } from "../features/booking/patient-medical-history-page";
import { MyBookingsPage } from "../features/booking/my-bookings-page";
import { ReferralPage } from "../features/referrals/referral-frontdesk-page";
import { PatientProfilePage } from "../features/booking/patient-profile-page";
import { PortalBookPage } from "../features/booking/portal-book-page";
import { PortalHomePage } from "../features/booking/portal-home-page";
import { ConsultationEntryPage } from "../features/consultation/consultation-entry-page";
import { DashboardPage } from "../features/dashboard/dashboard-page";
import { DoctorAvailabilityPage } from "../features/doctor/doctor-availability-page";
import { SpecialistReferralsPage } from "../features/referrals/specialist-referrals-page";
import { InventoryPage } from "../features/inventory/inventory-page";
import { LaboratoryPage } from "../features/laboratory/laboratory-page";
import { LabServiceReceiptScanPage } from "../features/laboratory/lab-service-receipt-scan-page";
import { PatientDetailPage } from "../features/patients/patient-detail-page";
import { PatientActionLogsPage } from "../features/patients/patient-action-logs-page";
import { PatientQrLookupPage } from "../features/patients/patient-qr-lookup-page";
import { PatientsPage } from "../features/patients/patients-page";
import { StaffProfilePage } from "../features/staff/staff-profile-page";
import { SettingsClinicPage } from "../features/settings/settings-clinic-page";
import { SettingsServicesPage } from "../features/settings/settings-services-page";
import { SettingsSupportPage } from "../features/settings/settings-support-page";
import { SettingsRolesPage } from "../features/settings/settings-roles-page";
import { SettingsUsersPage } from "../features/settings/settings-users-page";
import { NotFoundPage } from "../features/shared/not-found-page";
import { OdcPage } from "../features/shared/odc-page";
import { TeleconsultRoomPage } from "../features/teleconsult/teleconsult-room-page";
import { PermissionGate, ProtectedRoute } from "./guards";
import { SystemAvailabilityGate } from "./system-availability-gate";

export const router = createBrowserRouter([
  {
    path: "/odc",
    element: <OdcPage />,
  },
  {
    element: <SystemAvailabilityGate />,
    children: [
      {
        path: "/",
        element: <Navigate replace to="/portal" />,
      },
      {
        path: "/login",
        element: <LoginPage />,
      },
      {
        path: "/portal/register",
        element: <PatientRegisterPage />,
      },
      {
        path: "/portal/login",
        element: <Navigate replace to="/login" />,
      },
      {
        path: "/specialist/login",
        element: <Navigate replace to="/login" />,
      },
      {
        path: "/forgot-password",
        element: <ForgotPasswordPage />,
      },
      {
        path: "/reset-password",
        element: <ResetPasswordPage />,
      },
      {
        path: "/portal",
        element: <PublicLayout />,
        children: [
          { index: true, element: <PortalHomePage /> },
          {
            element: <ProtectedRoute allowedRoles={["patient"]} />,
            children: [
              { path: "book", element: <PortalBookPage /> },
              { path: "my-bookings", element: <MyBookingsPage /> },
              { path: "medical-history", element: <PatientMedicalHistoryPage /> },
              { path: "profile", element: <PatientProfilePage /> },
              {
                path: "teleconsult/:appointmentId",
                element: <TeleconsultRoomPage />,
              },
            ],
          },
        ],
      },
      {
        element: (
          <ProtectedRoute allowedRoles={["specialist"]} />
        ),
        children: [
          {
            path: "/specialist",
            element: <SpecialistShell />,
            children: [
              {
                index: true,
                element: <Navigate replace to="/specialist/referrals" />,
              },
              {
                element: <PermissionGate permission="patients.view" />,
                children: [
                  { path: "referrals", element: <SpecialistReferralsPage /> },
                  {
                    path: "patients/:patientId",
                    element: <PatientDetailPage />,
                  },
                  {
                    path: "consultation/:patientId",
                    element: <ConsultationEntryPage />,
                  },
                ],
              },
              {
                element: <PermissionGate permission="appointments.view" />,
                children: [
                  {
                    path: "availability",
                    element: <DoctorAvailabilityPage />,
                  },
                ],
              },
              { path: "profile", element: <StaffProfilePage /> },
            ],
          },
        ],
      },
      {
        element: (
          <ProtectedRoute
            allowedRoles={[
              "owner_admin",
              "doctor",
              "nurse_staff",
              "front_desk_cashier",
              "lab_staff",
              "inventory_staff",
            ]}
          />
        ),
        children: [
          {
            path: "/app",
            element: <AppShell />,
            children: [
              {
                index: true,
                element: <Navigate replace to="/app/dashboard" />,
              },
              { path: "dashboard", element: <DashboardPage /> },
              {
                element: <PermissionGate permission="patients.view" />,
                children: [
                  { path: "patients", element: <PatientsPage /> },
                  { path: "patients/logs", element: <PatientActionLogsPage /> },
                  { path: "patients/scan", element: <PatientQrLookupPage /> },
                  {
                    path: "patients/:patientId",
                    element: <PatientDetailPage />,
                  },
                  {
                    path: "consultation/:patientId",
                    element: <ProtectedRoute allowedRoles={["owner_admin", "doctor", "nurse_staff"]} />,
                    children: [{ index: true, element: <ConsultationEntryPage /> }],
                  },
                ],
              },
              {
                element: <PermissionGate permission="appointments.view" />,
                children: [
                  { path: "appointments", element: <AppointmentsPage /> },
                  { path: "referrals", element: <ReferralPage /> },
                  { path: "consultations", element: <AppointmentsPage /> },
                  {
                    path: "teleconsult/:appointmentId",
                    element: <TeleconsultRoomPage />,
                  },
                ],
              },
              {
                element: <ProtectedRoute allowedRoles={["doctor"]} />,
                children: [
                  {
                    path: "doctor-availability",
                    element: <DoctorAvailabilityPage />,
                  },
                  {
                    path: "specialist-referrals",
                    element: <SpecialistReferralsPage />,
                  },
                ],
              },
              {
                element: (
                  <ProtectedRoute
                    allowedRoles={[
                      "owner_admin",
                      "front_desk_cashier",
                      "lab_staff",
                      "nurse_staff",
                    ]}
                  />
                ),
                children: [
                  {
                    path: "bookings/scan",
                    element: <BookingReceiptScanPage />,
                  },
                  {
                    path: "laboratory/scan",
                    element: <LabServiceReceiptScanPage />,
                  },
                ],
              },
              {
                element: <PermissionGate permission="billing.view" />,
                children: [{ path: "billing", element: <BillingPage /> }],
              },
              {
                element: <PermissionGate permission="inventory.view" />,
                children: [{ path: "inventory", element: <InventoryPage /> }],
              },
              {
                element: <PermissionGate permission="laboratory.view" />,
                children: [{ path: "laboratory", element: <LaboratoryPage /> }],
              },
              { path: "profile", element: <StaffProfilePage /> },
              {
                path: "settings",
                element: <SettingsLayout />,
                children: [{ path: "clinic", element: <SettingsClinicPage /> }],
              },
              { path: "settings/catalog", element: <SettingsServicesPage /> },
              { path: "settings/users", element: <SettingsUsersPage /> },
              { path: "settings/roles", element: <SettingsRolesPage /> },
              { path: "settings/support", element: <SettingsSupportPage /> },
            ],
          },
        ],
      },
    ],
  },
  {
    path: "*",
    element: <NotFoundPage />,
  },
]);
