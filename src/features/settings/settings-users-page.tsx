import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Pencil, Plus, Search, ShieldCheck, Trash2, X } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import * as XLSX from 'xlsx';

import { FormField } from '../../components/forms/form-field';
import { Button } from '../../components/ui/button';
import { FeedbackModal } from '../../components/ui/feedback-modal';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { roleLabels } from '../../config/permissions';
import {
  clearUserPermissionOverride,
} from '../../lib/local-db';
import { queryKeys } from '../../lib/query-keys';
import {
  assignAccessRoleToProfileLiveOrDemo,
  createAdminUserLiveOrDemo,
  deleteAdminUserLiveOrDemo,
  listAccessRolesLiveOrDemo,
  listUsersLiveOrDemo,
  updateAdminUserLiveOrDemo,
} from '../../lib/supabase-clinic';
import { isSupabaseConfigured } from '../../lib/supabase';
import type { AccessRoleTemplate, AdminCreateUserInput, Role, UserProfile } from '../../types/domain';

const staffRoleOptions = ['owner_admin', 'doctor', 'specialist', 'nurse_staff', 'front_desk_cashier', 'lab_staff', 'inventory_staff'] as const satisfies ReadonlyArray<Exclude<Role, 'patient'>>;

const PASSWORD_RULES_HINT = 'At least 6 characters, with uppercase, lowercase, and a number.';
const BULK_TEMPLATE_CSV = `firstName,lastName,email,contactNumber,password,accessRoleName,staffRole,title,prcLicenseNumber,prcLicenseExpiry,birNumber,ptrNumber,consultationFee,followUpFee
Jose,Ramirez,jose.ramirez@example.com,09171234567,TempPass123,doctor,doctor,MD,PRC-12345,2026-12-31,BIR-12345,PTR-67890,800,500
Jose,Ramirez2,jose.ramirez2@example.com,09171234568,TempPass123,doctor,doctor,"MD, MBAH, PHD",PRC-12346,2026-12-31,BIR-12346,PTR-67891,800,500`;
const BULK_HEADER_MAP: Record<string, keyof BulkRow> = {
  firstname: 'firstName',
  'first name': 'firstName',
  lastname: 'lastName',
  'last name': 'lastName',
  email: 'email',
  contactnumber: 'contactNumber',
  contact: 'contactNumber',
  phone: 'contactNumber',
  password: 'password',
  accessrolename: 'accessRoleName',
  accessrole: 'accessRoleName',
  accessroleid: 'accessRoleId',
  staffrole: 'staffRole',
  title: 'title',
  prclicensenumber: 'prcLicenseNumber',
  prclicenseexpiry: 'prcLicenseExpiry',
  birnumber: 'birNumber',
  ptrnumber: 'ptrNumber',
  consultationfee: 'consultationFee',
  followupfee: 'followUpFee',
};

const userSchema = z
  .object({
    mode: z.enum(['create', 'edit']),
    firstName: z.string().trim().min(1, 'First name is required.'),
    lastName: z.string().trim().min(1, 'Last name is required.'),
    contactNumber: z.string().trim().min(1, 'Contact number is required.'),
    email: z.string().email('Enter a valid email address.'),
    title: z.string().optional(),
    password: z.string().optional(),
    confirmPassword: z.string().optional(),
    accessRoleId: z.string().min(1, 'Select an access role.'),
    staffRole: z.enum(staffRoleOptions),
    prcLicenseNumber: z.string().optional(),
    prcLicenseExpiry: z.string().optional(),
    birNumber: z.string().optional(),
    ptrNumber: z.string().optional(),
    prcIdFile: z.custom<File | null>((value) => value === null || value instanceof File, {
      message: 'Upload a PRC ID file.',
    }).optional(),
    consultationFee: z.number().min(0, 'Consultation fee must be 0 or higher.').optional(),
    followUpFee: z.number().min(0, 'Follow-up fee must be 0 or higher.').optional(),
    doctorSharePercentage: z.number().min(0, 'Share % must be 0 or higher.').max(100, 'Share % cannot exceed 100.').optional(),
  })
  .superRefine((value, ctx) => {
    if (value.mode === 'create') {
      const password = value.password ?? '';
      const confirmPassword = value.confirmPassword ?? '';

      if (password.length < 6 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
        ctx.addIssue({ code: 'custom', path: ['password'], message: PASSWORD_RULES_HINT });
      }

      if (password !== confirmPassword) {
        ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match.' });
      }
    }

    if ((value.staffRole !== 'doctor' && value.staffRole !== 'specialist') || value.mode === 'edit') {
      return;
    }

    if (!value.prcLicenseNumber?.trim()) {
      ctx.addIssue({ code: 'custom', path: ['prcLicenseNumber'], message: 'PRC license number is required for doctor and specialist accounts.' });
    }

    if (!value.prcLicenseExpiry?.trim()) {
      ctx.addIssue({ code: 'custom', path: ['prcLicenseExpiry'], message: 'PRC license expiry is required for doctor and specialist accounts.' });
    }

    if (!value.birNumber?.trim()) {
      ctx.addIssue({ code: 'custom', path: ['birNumber'], message: 'BIR number is required for doctor and specialist accounts.' });
    }

    if (!value.ptrNumber?.trim()) {
      ctx.addIssue({ code: 'custom', path: ['ptrNumber'], message: 'PTR number is required for doctor and specialist accounts.' });
    }

    if (!value.prcIdFile) {
      ctx.addIssue({ code: 'custom', path: ['prcIdFile'], message: 'PRC ID upload is required for doctor and specialist accounts.' });
    }
  });

type UserFormValues = z.infer<typeof userSchema>;

type BulkRow = {
  firstName?: string;
  lastName?: string;
  email?: string;
  contactNumber?: string;
  password?: string;
  accessRoleName?: string;
  accessRoleId?: string;
  staffRole?: string;
  title?: string;
  prcLicenseNumber?: string;
  prcLicenseExpiry?: string;
  birNumber?: string;
  ptrNumber?: string;
  consultationFee?: string;
  followUpFee?: string;
};

interface BulkCandidate {
  rowNumber: number;
  accessRole: AccessRoleTemplate;
  payload: AdminCreateUserInput;
}

interface FeedbackModalState {
  open: boolean;
  title: string;
  message: string;
  variant: 'success' | 'error';
}

function splitFullName(fullName: string) {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return { firstName: '', lastName: '' };
  }

  const parts = trimmed.split(/\s+/);
  return {
    firstName: parts[0] ?? '',
    lastName: parts.slice(1).join(' '),
  };
}

function getEffectiveRoleLabel(user: UserProfile) {
  return user.accessRoleName ?? roleLabels[user.role];
}

function isBulkDoctorRole(role: Role) {
  return role === 'doctor' || role === 'specialist';
}

function normalizeLicenseNumber(value: string | undefined | null) {
  if (!value) return '';
  return value
    .toString()
    .trim()
    .replace(/^\s*(prc|bir|ptr)\s*[-:]?\s*/i, '');
}

function downloadBulkTemplateExcel() {
  const rows = [
    [
      'firstName',
      'lastName',
      'email',
      'contactNumber',
      'password',
      'accessRoleName',
      'staffRole',
      'title',
      'prcLicenseNumber',
      'prcLicenseExpiry',
      'birNumber',
      'ptrNumber',
      'consultationFee',
      'followUpFee',
    ],
    ['Jose', 'Ramirez', 'jose.ramirez@example.com', '09171234567', 'TestPass123', 'doctor', 'doctor', 'MD', '12345', '2026-12-31', '12345', '67890', '800', '500'],
    ['Jose', 'Ramirez2', 'jose.ramirez2@example.com', '09171234568', 'TestPass123', 'doctor', 'doctor', 'MD, MBAH, PHD', '12346', '2026-12-31', '12346', '67891', '800', '500'],
  ];

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Doctors');

  const arrayBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([arrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'doctor-bulk-upload.xlsx';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildCreateUserInput(values: UserFormValues, accessRole: AccessRoleTemplate): AdminCreateUserInput {
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    contactNumber: values.contactNumber.trim(),
    email: values.email.trim().toLowerCase(),
    password: values.password ?? '',
    role: values.staffRole,
    permissions: accessRole.permissions,
    title: values.staffRole === 'doctor' || values.staffRole === 'specialist' ? values.title?.trim() ?? '' : undefined,
    prcLicenseNumber: values.staffRole === 'doctor' || values.staffRole === 'specialist' ? values.prcLicenseNumber?.trim() ?? '' : undefined,
    prcLicenseExpiry: values.staffRole === 'doctor' || values.staffRole === 'specialist' ? values.prcLicenseExpiry?.trim() ?? '' : undefined,
    birNumber: values.staffRole === 'doctor' || values.staffRole === 'specialist' ? values.birNumber?.trim() ?? '' : undefined,
    ptrNumber: values.staffRole === 'doctor' || values.staffRole === 'specialist' ? values.ptrNumber?.trim() ?? '' : undefined,
    consultationFee: values.staffRole === 'doctor' || values.staffRole === 'specialist' ? values.consultationFee ?? 0 : undefined,
    followUpFee: values.staffRole === 'doctor' || values.staffRole === 'specialist' ? values.followUpFee ?? 0 : undefined,
    doctorSharePercentage: values.staffRole === 'doctor' || values.staffRole === 'specialist' ? values.doctorSharePercentage ?? 100 : undefined,
    prcIdFile: values.staffRole === 'doctor' || values.staffRole === 'specialist' ? values.prcIdFile ?? null : null,
  };
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s_]+/g, ' ');
}

function parseCsvText(text: string) {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && nextChar === '\n') {
        index += 1;
      }
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = '';
      continue;
    }

    if (!inQuotes && char === ',') {
      currentRow.push(currentField);
      currentField = '';
      continue;
    }

    currentField += char;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows.filter((row) => row.some((value) => value.trim().length > 0));
}

function rowsToBulkRecords(rows: string[][]) {
  if (rows.length === 0) return [] as BulkRow[];

  const [rawHeaders, ...dataRows] = rows;
  const headers = rawHeaders.map((header) => BULK_HEADER_MAP[normalizeHeader(header)]).filter(Boolean) as (keyof BulkRow)[];

  return dataRows.map((row) => {
    const record: BulkRow = {};
    headers.forEach((header, index) => {
      record[header] = row[index]?.trim() ?? '';
    });
    return record;
  });
}

async function parseBulkFile(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'csv') {
    const text = await file.text();
    return rowsToBulkRecords(parseCsvText(text));
  }

  if (extension === 'xlsx' || extension === 'xls') {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!firstSheet) return [];
    const rows = XLSX.utils.sheet_to_json<string[]>(firstSheet, { header: 1, raw: false, blankrows: false });
    return rowsToBulkRecords(rows as string[][]);
  }

  return [];
}

function buildBulkCandidates(rows: BulkRow[], accessRoles: AccessRoleTemplate[]) {
  const errors: string[] = [];
  const candidates: BulkCandidate[] = [];
  const roleById = new Map(accessRoles.map((role) => [role.id, role]));
  const roleByName = new Map(accessRoles.map((role) => [role.name.trim().toLowerCase(), role]));
  const seenEmails = new Set<string>();

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const firstName = row.firstName?.trim() ?? '';
    const lastName = row.lastName?.trim() ?? '';
    const email = row.email?.trim().toLowerCase() ?? '';
    const contactNumber = row.contactNumber?.trim() ?? '';
    const password = row.password?.trim() ?? '';
    const staffRole = (row.staffRole?.trim() || 'doctor') as Role;
    const roleKey = row.accessRoleId?.trim() || row.accessRoleName?.trim().toLowerCase() || '';
    const accessRole = roleById.get(roleKey) ?? roleByName.get(roleKey);

    if (!firstName || !lastName || !email || !contactNumber || !password) {
      errors.push(`Row ${rowNumber}: Missing required fields (firstName, lastName, email, contactNumber, password).`);
      return;
    }

    if (!accessRole) {
      errors.push(`Row ${rowNumber}: Access role not found. Use accessRoleName or accessRoleId from the Access Role list.`);
      return;
    }

    if (!isBulkDoctorRole(staffRole)) {
      errors.push(`Row ${rowNumber}: Staff role must be doctor or specialist.`);
      return;
    }

    if (!row.prcLicenseNumber?.trim()) {
      errors.push(`Row ${rowNumber}: PRC license number is required for doctor and specialist accounts.`);
      return;
    }

    if (!row.prcLicenseExpiry?.trim()) {
      errors.push(`Row ${rowNumber}: PRC license expiry is required for doctor and specialist accounts.`);
      return;
    }

    if (!row.birNumber?.trim()) {
      errors.push(`Row ${rowNumber}: BIR number is required for doctor and specialist accounts.`);
      return;
    }

    if (!row.ptrNumber?.trim()) {
      errors.push(`Row ${rowNumber}: PTR number is required for doctor and specialist accounts.`);
      return;
    }

    if (seenEmails.has(email)) {
      errors.push(`Row ${rowNumber}: Duplicate email in upload (${email}).`);
      return;
    }

    seenEmails.add(email);

    const consultationFee = row.consultationFee ? Number(row.consultationFee) : 0;
    const followUpFee = row.followUpFee ? Number(row.followUpFee) : 0;

    if (Number.isNaN(consultationFee) || Number.isNaN(followUpFee)) {
      errors.push(`Row ${rowNumber}: Consultation and follow-up fee must be numeric.`);
      return;
    }

    candidates.push({
      rowNumber,
      accessRole,
      payload: {
        firstName,
        lastName,
        contactNumber,
        email,
        password,
        role: staffRole,
        permissions: accessRole.permissions,
        title: row.title?.trim(),
        prcLicenseNumber: normalizeLicenseNumber(row.prcLicenseNumber),
        prcLicenseExpiry: row.prcLicenseExpiry?.trim(),
        birNumber: normalizeLicenseNumber(row.birNumber),
        ptrNumber: normalizeLicenseNumber(row.ptrNumber),
        consultationFee,
        followUpFee,
        prcIdFile: null,
      },
    });
  });

  return { candidates, errors };
}

export function SettingsUsersPage() {
  const queryClient = useQueryClient();
  const { data: usersData } = useQuery({ queryKey: ['settings-users'], queryFn: listUsersLiveOrDemo });
  const { data: accessRolesData } = useQuery({ queryKey: ['access-roles'], queryFn: listAccessRolesLiveOrDemo });
  const users = useMemo(() => usersData ?? [], [usersData]);
  const accessRoles = useMemo(() => accessRolesData ?? [], [accessRolesData]);
  const [search, setSearch] = useState('');
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [feedbackModal, setFeedbackModal] = useState<FeedbackModalState>({
    open: false,
    title: '',
    message: '',
    variant: 'success',
  });
  const deferredSearch = useDeferredValue(search);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkCandidates, setBulkCandidates] = useState<BulkCandidate[]>([]);
  const [bulkParseErrors, setBulkParseErrors] = useState<string[]>([]);
  const [bulkUploadErrors, setBulkUploadErrors] = useState<string[]>([]);
  const [bulkIsUploading, setBulkIsUploading] = useState(false);
  const [bulkPrcFiles, setBulkPrcFiles] = useState<Record<string, File | null>>({});
  const [bulkInputKey, setBulkInputKey] = useState(0);
  const bulkTemplateHref = useMemo(
    () => `data:text/csv;charset=utf-8,${encodeURIComponent(BULK_TEMPLATE_CSV)}`,
    [],
  );

  const createUserMutation = useMutation({
    mutationFn: createAdminUserLiveOrDemo,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['settings-users'] });
      await queryClient.invalidateQueries({ queryKey: queryKeys.providers });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, values, accessRole }: { id: string; values: UserFormValues; accessRole: AccessRoleTemplate }) =>
      updateAdminUserLiveOrDemo(id, {
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        contactNumber: values.contactNumber.trim(),
        email: values.email.trim().toLowerCase(),
        role: values.staffRole,
        permissions: accessRole.permissions,
        title: values.staffRole === 'doctor' || values.staffRole === 'specialist' ? values.title?.trim() ?? '' : null,
        prcLicenseNumber: values.prcLicenseNumber?.trim(),
        prcLicenseExpiry: values.prcLicenseExpiry?.trim(),
        birNumber: values.birNumber?.trim(),
        ptrNumber: values.ptrNumber?.trim(),
        consultationFee: values.consultationFee ?? 0,
        followUpFee: values.followUpFee ?? 0,
        doctorSharePercentage: values.doctorSharePercentage ?? 100,
    }),
    onSuccess: async (_updatedUser, variables) => {
      clearUserPermissionOverride({ userId: variables.id, email: variables.values.email.trim().toLowerCase() });
      await assignAccessRoleToProfileLiveOrDemo({
        userId: variables.id,
        email: variables.values.email.trim().toLowerCase(),
        accessRoleId: variables.accessRole.id,
      });
      await queryClient.invalidateQueries({ queryKey: ['settings-users'] });
      await queryClient.invalidateQueries({ queryKey: ['access-roles'] });
      await queryClient.invalidateQueries({ queryKey: queryKeys.providers });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (user: UserProfile) => deleteAdminUserLiveOrDemo(user.id, { email: user.email }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['settings-users'] });
    },
  });

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      mode: 'create',
      firstName: '',
      lastName: '',
      contactNumber: '',
      email: '',
      title: '',
      password: '',
      confirmPassword: '',
      accessRoleId: '',
      staffRole: 'nurse_staff',
      prcLicenseNumber: '',
      prcLicenseExpiry: '',
      birNumber: '',
      ptrNumber: '',
      prcIdFile: null,
      consultationFee: 0,
      followUpFee: 0,
      doctorSharePercentage: 100,
    },
  });

  const formMode = useWatch({ control: form.control, name: 'mode' });
  const selectedAccessRoleId = useWatch({ control: form.control, name: 'accessRoleId' });
  const selectedStaffRole = useWatch({ control: form.control, name: 'staffRole' });
  const selectedAccessRole = accessRoles.find((role) => role.id === selectedAccessRoleId) ?? null;
  const isDoctorRole = selectedStaffRole === 'doctor' || selectedStaffRole === 'specialist';
  const isEditing = formMode === 'edit';
  const isLiveEdit = isEditing && isSupabaseConfigured;
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const filteredUsers = useMemo(
    () =>
      users.filter((user) =>
        `${user.fullName} ${user.email} ${user.phone} ${getEffectiveRoleLabel(user)} ${roleLabels[user.role]}`.toLowerCase().includes(deferredSearch.toLowerCase()),
      ),
    [deferredSearch, users],
  );

  useEffect(() => {
    if (!isUserModalOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsUserModalOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isUserModalOpen]);

  useEffect(() => {
    if (!bulkFile) {
      setBulkCandidates([]);
      setBulkParseErrors([]);
      setBulkUploadErrors([]);
      setBulkPrcFiles({});
      return;
    }

    let active = true;
    (async () => {
      try {
        const parsedRows = await parseBulkFile(bulkFile);
        if (!active) return;
        if (accessRoles.length === 0) {
          setBulkCandidates([]);
          setBulkParseErrors(['Access roles are still loading. Please wait and reselect the file.']);
          setBulkUploadErrors([]);
          setBulkPrcFiles({});
          return;
        }
        const { candidates, errors } = buildBulkCandidates(parsedRows, accessRoles);
        setBulkCandidates(candidates);
        setBulkParseErrors(errors);
        setBulkUploadErrors([]);
        setBulkPrcFiles({});
      } catch (error) {
        setBulkCandidates([]);
        setBulkParseErrors([error instanceof Error ? error.message : 'Unable to read the uploaded file.']);
        setBulkUploadErrors([]);
        setBulkPrcFiles({});
      }
    })();

    return () => {
      active = false;
    };
  }, [bulkFile, accessRoles]);

  const closeFeedbackModal = () => {
    setFeedbackModal((currentState) => ({ ...currentState, open: false }));
  };

  const closeUserModal = () => {
    setEditingUser(null);
    setIsUserModalOpen(false);
  };

  const openCreateModal = () => {
    form.reset({
      mode: 'create',
      firstName: '',
      lastName: '',
      contactNumber: '',
      email: '',
      title: '',
      password: '',
      confirmPassword: '',
      accessRoleId: accessRoles[0]?.id ?? '',
      staffRole: 'nurse_staff',
      prcLicenseNumber: '',
      prcLicenseExpiry: '',
      birNumber: '',
      ptrNumber: '',
      prcIdFile: null,
      consultationFee: 0,
      followUpFee: 0,
      doctorSharePercentage: 100,
    });
    setEditingUser(null);
    setIsUserModalOpen(true);
  };

  const openEditModal = (user: UserProfile) => {
    const { firstName, lastName } = splitFullName(user.fullName);
    const matchingAccessRole = accessRoles.find((role) => role.id === user.accessRoleId) ?? null;

    form.reset({
      mode: 'edit',
      firstName,
      lastName,
      contactNumber: user.phone ?? '',
      email: user.email,
      title: user.title ?? '',
      password: '',
      confirmPassword: '',
      accessRoleId: matchingAccessRole?.id ?? '',
      staffRole: user.role === 'patient' ? 'nurse_staff' : user.role,
      prcLicenseNumber: '',
      prcLicenseExpiry: '',
      birNumber: '',
      ptrNumber: '',
      prcIdFile: null,
      consultationFee: user.consultationFee ?? 0,
      followUpFee: user.followUpFee ?? 0,
      doctorSharePercentage: user.doctorSharePercentage ?? 100,
    });
    setEditingUser(user);
    setIsUserModalOpen(true);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    const accessRole = accessRoles.find((role) => role.id === values.accessRoleId);
    if (!accessRole) {
      setFeedbackModal({
        open: true,
        title: 'Missing access role',
        message: 'Select a valid access role before saving the user.',
        variant: 'error',
      });
      return;
    }

    if (editingUser && isSupabaseConfigured && values.staffRole !== editingUser.role) {
      setFeedbackModal({
        open: true,
        title: 'Staff role locked',
        message: 'Changing the underlying staff role of a live account is not supported from this screen yet.',
        variant: 'error',
      });
      return;
    }

    try {
      if (editingUser) {
        await updateUserMutation.mutateAsync({ id: editingUser.id, values, accessRole });
        setFeedbackModal({
          open: true,
          title: 'User updated',
          message: 'The user account was updated successfully.',
          variant: 'success',
        });
      } else {
        const createdUser = await createUserMutation.mutateAsync(buildCreateUserInput(values, accessRole));
        clearUserPermissionOverride({ userId: createdUser.id, email: createdUser.email });
        await assignAccessRoleToProfileLiveOrDemo({
          userId: createdUser.id,
          email: createdUser.email,
          accessRoleId: accessRole.id,
        });
        setFeedbackModal({
          open: true,
          title: 'User created',
          message: `${accessRole.name} account created successfully.`,
          variant: 'success',
        });
      }

      closeUserModal();
    } catch (error) {
      setFeedbackModal({
        open: true,
        title: editingUser ? 'Unable to update user' : 'Unable to create user',
        message: error instanceof Error ? error.message : 'Something went wrong while saving the user.',
        variant: 'error',
      });
    }
  });

  const handleDeleteUser = async (user: UserProfile) => {
    if (!window.confirm(`Delete ${user.fullName}'s account?`)) return;

    try {
      await deleteUserMutation.mutateAsync(user);
      setFeedbackModal({
        open: true,
        title: 'User deleted',
        message: 'The user account was removed successfully.',
        variant: 'success',
      });
    } catch (error) {
      setFeedbackModal({
        open: true,
        title: 'Unable to delete user',
        message: error instanceof Error ? error.message : 'Something went wrong while deleting the user.',
        variant: 'error',
      });
    }
  };

  const handleBulkUpload = async () => {
    if (bulkCandidates.length === 0 || bulkIsUploading) return;

    const missingFiles = bulkCandidates
      .filter((candidate) => isBulkDoctorRole(candidate.payload.role) && !bulkPrcFiles[candidate.payload.email])
      .map((candidate) => `Row ${candidate.rowNumber}: PRC ID upload is required.`);

    if (missingFiles.length > 0) {
      setBulkUploadErrors(missingFiles);
      setFeedbackModal({
        open: true,
        title: 'Missing PRC ID files',
        message: 'Upload PRC ID files for each doctor/specialist row before starting the bulk upload.',
        variant: 'error',
      });
      return;
    }

    setBulkUploadErrors([]);

    setBulkIsUploading(true);
    const errors: string[] = [];
    let createdCount = 0;

    for (const candidate of bulkCandidates) {
      try {
        const prcIdFile = bulkPrcFiles[candidate.payload.email] ?? null;
        const createdUser = await createAdminUserLiveOrDemo({ ...candidate.payload, prcIdFile });
        clearUserPermissionOverride({ userId: createdUser.id, email: createdUser.email });
        await assignAccessRoleToProfileLiveOrDemo({
          userId: createdUser.id,
          email: createdUser.email,
          accessRoleId: candidate.accessRole.id,
        });
        createdCount += 1;
      } catch (error) {
        errors.push(`Row ${candidate.rowNumber}: ${error instanceof Error ? error.message : 'Failed to create account.'}`);
      }
    }

    await queryClient.invalidateQueries({ queryKey: ['settings-users'] });
    await queryClient.invalidateQueries({ queryKey: queryKeys.providers });

    setBulkIsUploading(false);
    setFeedbackModal({
      open: true,
      title: 'Bulk upload complete',
      message: errors.length
        ? `${createdCount} account(s) created. ${errors.length} failed. Check the error list for details.`
        : `${createdCount} account(s) created successfully.`,
      variant: errors.length ? 'error' : 'success',
    });
    setBulkUploadErrors(errors);

    if (errors.length === 0) {
      setBulkFile(null);
      setBulkCandidates([]);
      setBulkParseErrors([]);
      setBulkUploadErrors([]);
      setBulkPrcFiles({});
      setBulkInputKey((value) => value + 1);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div className="border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="shrink-0 bg-orange-600 p-2.5 text-white">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-slate-950">User Management</h1>
                <p className="mt-1 text-sm text-slate-500">Manage user accounts in a table and assign them to access roles from the Role Management page.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button className="rounded-none bg-orange-600 px-4 py-2.5 text-sm font-extrabold uppercase tracking-widest hover:bg-orange-700" onClick={openCreateModal}>
                <Plus className="mr-2 size-4" />
                Add user
              </Button>
              <div className="flex w-full max-w-sm items-center gap-2 border border-slate-200 bg-slate-50 px-4 py-2.5">
                <Search className="size-4 shrink-0 text-slate-400" />
                <input
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search user or assigned role"
                  value={search}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">User</th>
                  <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Access Role</th>
                  <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Staff Role</th>
                  <th className="px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Contact</th>
                  <th className="px-6 py-3 text-right text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Actions</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((user) => (
                    <tr className="transition-colors hover:bg-slate-50" key={user.id}>
                      <td className="px-6 py-4 align-top">
                        <p className="font-bold text-slate-950">{user.fullName}</p>
                        <p className="mt-1 text-sm text-slate-500">{user.email}</p>
                      </td>
                      <td className="px-6 py-4 align-top text-sm font-medium text-slate-700">{getEffectiveRoleLabel(user)}</td>
                      <td className="px-6 py-4 align-top text-sm text-slate-600">{roleLabels[user.role]}</td>
                      <td className="px-6 py-4 align-top text-sm text-slate-600">{user.phone || 'No contact number set'}</td>
                      <td className="px-6 py-4 align-top">
                        <div className="flex min-w-max items-center justify-end gap-3 whitespace-nowrap text-xs font-extrabold uppercase tracking-widest">
                          <button className="inline-flex items-center gap-1 text-slate-600 hover:underline" onClick={() => openEditModal(user)} type="button">
                            <Pencil className="size-3.5" />
                            Edit
                          </button>
                          <button className="inline-flex items-center gap-1 text-rose-600 hover:underline" onClick={() => void handleDeleteUser(user)} type="button">
                            <Trash2 className="size-3.5" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td className="px-6 py-10 text-center text-sm text-slate-500" colSpan={5}>
                        No users matched your search.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            <div className="border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-950">Bulk doctor upload</h2>
              <p className="mt-3 text-sm text-slate-600">
                Upload a CSV or Excel sheet to register multiple doctor or specialist accounts. Required columns: firstName, lastName, email, contactNumber, password, accessRoleName, prcLicenseNumber, prcLicenseExpiry, birNumber, ptrNumber.
              </p>
              <div className="mt-4 space-y-3">
                <Input
                  key={bulkInputKey}
                  accept=".csv,.xlsx,.xls"
                  onChange={(event) => setBulkFile(event.target.files?.[0] ?? null)}
                  type="file"
                />
                <div className="text-xs text-slate-500">
                  Need a template?{' '}
                  <a className="font-semibold text-orange-700 hover:underline" download="doctor-bulk-upload.csv" href={bulkTemplateHref}>
                    Download CSV template
                  </a>
                  {' '}or{' '}
                  <button className="font-semibold text-orange-700 hover:underline" onClick={downloadBulkTemplateExcel} type="button">
                    Download Excel template
                  </button>
                </div>
                {bulkCandidates.length > 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold text-slate-700">PRC ID uploads</p>
                    <p className="mt-1 text-xs text-slate-500">Upload a PRC ID file for each doctor or specialist row.</p>
                    <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
                      {bulkCandidates.map((candidate) => (
                        <div className="flex flex-wrap items-center justify-between gap-2" key={candidate.payload.email}>
                          <div className="text-xs text-slate-600">
                            Row {candidate.rowNumber} - {candidate.payload.email}
                          </div>
                          <Input
                            accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                            onChange={(event) => {
                              const file = event.target.files?.[0] ?? null;
                              setBulkPrcFiles((current) => ({ ...current, [candidate.payload.email]: file }));
                              setBulkUploadErrors([]);
                            }}
                            type="file"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {bulkCandidates.length > 0 ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-900">
                    {bulkCandidates.length} valid row(s) ready to upload.
                  </div>
                ) : null}
                {bulkParseErrors.length > 0 || bulkUploadErrors.length > 0 ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
                    <p className="font-semibold">Upload issues</p>
                    <ul className="mt-2 space-y-1">
                      {[...bulkParseErrors, ...bulkUploadErrors].slice(0, 5).map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                      {[...bulkParseErrors, ...bulkUploadErrors].length > 5 ? (
                        <li>...and {[...bulkParseErrors, ...bulkUploadErrors].length - 5} more.</li>
                      ) : null}
                    </ul>
                  </div>
                ) : null}
                <Button
                  className="w-full rounded-none bg-orange-600 hover:bg-orange-700"
                  disabled={bulkIsUploading || bulkCandidates.length === 0 || bulkParseErrors.length > 0}
                  onClick={() => void handleBulkUpload()}
                  type="button"
                >
                  {bulkIsUploading ? 'Uploading...' : 'Upload doctor accounts'}
                </Button>
              </div>
            </div>

            <div className="border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-950">Access role summary</h2>
              <div className="mt-5 space-y-4">
                {accessRoles.map((role) => (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" key={role.id}>
                    <p className="font-semibold text-slate-950">{role.name}</p>
                    <p className="mt-2 text-sm text-slate-500">{role.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-950">Live account note</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <p>Access roles control what pages and actions a user can use.</p>
                <p>Staff role stays on the user account itself for route guards and doctor-specific workflows.</p>
                <p>Deleting live accounts still needs an admin auth-delete backend, so the delete button will show a clear error until that flow is added.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isUserModalOpen ? (
        <div aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4 sm:p-6" onClick={closeUserModal} role="dialog">
          <div className="my-auto flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl sm:max-h-[80vh]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 bg-orange-600 px-6 py-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-orange-100">User Form</p>
                <p className="mt-0.5 text-sm font-bold text-white">{editingUser ? 'Edit user account' : 'Add user account'}</p>
              </div>
              <button aria-label="Close user modal" className="inline-flex items-center justify-center border border-orange-300/40 bg-white/10 p-2 text-white transition hover:bg-white/20" onClick={closeUserModal} type="button">
                <X className="size-4" />
              </button>
            </div>

            <form className="flex min-h-0 flex-1 flex-col" onSubmit={onSubmit}>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
                {isLiveEdit ? (
                  <div className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Email stays locked when editing live accounts. You can still update the contact number, assigned access role, and doctor fees here.
                  </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField error={form.formState.errors.firstName?.message} label="First name">
                    <Input {...form.register('firstName')} />
                  </FormField>
                  <FormField error={form.formState.errors.lastName?.message} label="Last name">
                    <Input {...form.register('lastName')} />
                  </FormField>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField error={form.formState.errors.contactNumber?.message} label="Contact number">
                    <Input {...form.register('contactNumber')} />
                  </FormField>
                  <FormField error={form.formState.errors.email?.message} label="Email address">
                    <Input disabled={isLiveEdit} type="email" {...form.register('email')} />
                  </FormField>
                </div>

                {!isEditing ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField error={form.formState.errors.password?.message} hint={PASSWORD_RULES_HINT} label="Password">
                      <div className="relative">
                        <Input type={showCreatePassword ? 'text' : 'password'} className="pr-10" {...form.register('password')} />
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => setShowCreatePassword((value) => !value)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-700"
                          aria-label={showCreatePassword ? 'Hide password' : 'Show password'}
                        >
                          {showCreatePassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </FormField>
                    <FormField error={form.formState.errors.confirmPassword?.message} label="Confirm password">
                      <div className="relative">
                        <Input type={showConfirmPassword ? 'text' : 'password'} className="pr-10" {...form.register('confirmPassword')} />
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => setShowConfirmPassword((value) => !value)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-700"
                          aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                        >
                          {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </FormField>
                  </div>
                ) : null}

                <FormField error={form.formState.errors.accessRoleId?.message} label="Access role">
                  <Select onChange={(event) => form.setValue('accessRoleId', event.target.value, { shouldDirty: true, shouldValidate: true })} value={selectedAccessRoleId}>
                    <option value="">Select access role</option>
                    {accessRoles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <FormField error={form.formState.errors.staffRole?.message} hint="This controls the underlying staff type for routing and doctor workflows." label="Staff role">
                  <Select onChange={(event) => form.setValue('staffRole', event.target.value as UserFormValues['staffRole'], { shouldDirty: true, shouldValidate: true })} value={selectedStaffRole}>
                    {staffRoleOptions.map((role) => (
                      <option key={role} value={role}>
                        {roleLabels[role]}
                      </option>
                    ))}
                  </Select>
                </FormField>

                {selectedAccessRole ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    <p className="font-semibold text-slate-950">{selectedAccessRole.name}</p>
                    <p className="mt-2">{selectedAccessRole.description}</p>
                    <p className="mt-3 text-xs text-slate-500">{selectedAccessRole.permissions.join(', ')}</p>
                  </div>
                ) : null}

                {isDoctorRole ? (
                  <div className="space-y-4 rounded-2xl border border-orange-200 bg-orange-50/50 p-4">
                    <p className="text-sm font-semibold text-orange-900">Provider account fields</p>
                    <FormField hint="Example: MD, FPCS, DPBO" label="Post-nominals">
                      <Input placeholder="MD" {...form.register('title')} />
                    </FormField>
                    {!isEditing ? (
                      <>
                        <div className="grid gap-4 md:grid-cols-2">
                          <FormField error={form.formState.errors.prcLicenseNumber?.message} label="PRC license number">
                            <Input {...form.register('prcLicenseNumber')} />
                          </FormField>
                          <FormField error={form.formState.errors.prcLicenseExpiry?.message} label="PRC license expiry">
                            <Input type="date" {...form.register('prcLicenseExpiry')} />
                          </FormField>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <FormField error={form.formState.errors.birNumber?.message} label="BIR number">
                            <Input {...form.register('birNumber')} />
                          </FormField>
                          <FormField error={form.formState.errors.ptrNumber?.message} label="PTR number">
                            <Input {...form.register('ptrNumber')} />
                          </FormField>
                        </div>
                        <FormField
                          error={form.formState.errors.prcIdFile?.message}
                          hint="Upload a JPG, PNG, or PDF copy of the PRC ID."
                          label="PRC ID upload"
                        >
                          <Input
                            accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                            onChange={(event) => {
                              const file = event.target.files?.[0] ?? null;
                              form.setValue('prcIdFile', file, { shouldDirty: true, shouldValidate: true });
                            }}
                            type="file"
                          />
                        </FormField>
                      </>
                    ) : (
                      <p className="text-xs text-orange-700">Doctor credential fields stay read-only during edit to avoid breaking the verified doctor setup.</p>
                    )}
                    <div className="grid gap-4 md:grid-cols-3">
                      <FormField label="Consultation fee">
                        <Input min="0" step="0.01" type="number" {...form.register('consultationFee', { valueAsNumber: true })} />
                      </FormField>
                      <FormField label="Follow-up fee">
                        <Input min="0" step="0.01" type="number" {...form.register('followUpFee', { valueAsNumber: true })} />
                      </FormField>
                      <FormField label="Doctor Share %">
                        <Input min="0" max="100" step="1" type="number" {...form.register('doctorSharePercentage', { valueAsNumber: true })} />
                      </FormField>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col-reverse gap-3 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
                <Button className="w-full rounded-none sm:w-auto" onClick={closeUserModal} type="button" variant="secondary">
                  Cancel
                </Button>
                <Button className="w-full rounded-none bg-orange-600 hover:bg-orange-700 sm:w-auto" disabled={createUserMutation.isPending || updateUserMutation.isPending} type="submit">
                  {createUserMutation.isPending || updateUserMutation.isPending ? 'Saving...' : editingUser ? 'Save User' : 'Add User'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <FeedbackModal autoCloseMs={3000} message={feedbackModal.message} onClose={closeFeedbackModal} open={feedbackModal.open} title={feedbackModal.title} variant={feedbackModal.variant} />
    </>
  );
}
