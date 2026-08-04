export type ServiceRecord = {
  id: string;
  slug: string;
  name: string;
  description: string;
  is_active: number;
  created_at: string;
  updated_at: string;
};

export type CustomerRecord = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  created_at: string;
  updated_at: string;
};

export const serviceRequestStatuses = [
  "new",
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export type ServiceRequestStatus = (typeof serviceRequestStatuses)[number];

export type ServiceRequestRecord = {
  id: string;
  customer_id: string;
  service_id: string;
  status: ServiceRequestStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type BetaAccessRequestRecord = {
  id: string;
  email: string;
  source: string | null;
  metadata_json: string | null;
  created_at: string;
};

export type NewCustomer = {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
};

export type NewServiceRequest = {
  id: string;
  customerId: string;
  serviceId: string;
  notes?: string | null;
};

export type NewBetaAccessRequest = {
  id: string;
  email: string;
  source?: string | null;
  metadataJson?: string | null;
};

export const licenseStates = ["pending", "active", "expired", "revoked"] as const;
export type LicenseState = (typeof licenseStates)[number];

export type UserRecord = {
  id: string;
  email: string;
  password_hash: string | null;
  display_name: string | null;
  created_at: string;
  updated_at: string;
};

export type LicenseRecord = {
  id: string;
  user_id: string;
  activation_key_hash: string;
  state: LicenseState;
  activation_limit: number;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LicensePublicRecord = Omit<LicenseRecord, "activation_key_hash">;

export type LicenseActivationRecord = {
  id: string;
  license_id: string;
  device_id: string;
  activated_at: string;
  deactivated_at: string | null;
};

export type DeviceRecord = {
  id: string;
  user_id: string;
  fingerprint_hash: string;
  name: string | null;
  last_seen_at: string | null;
  created_at: string;
};

export type SessionRecord = {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
  last_seen_at: string | null;
};

export type NewUser = { id: string; email: string; passwordHash?: string | null; displayName?: string | null };
export type NewDevice = { id: string; userId: string; fingerprintHash: string; name?: string | null };
export type NewSession = { id: string; userId: string; tokenHash: string; expiresAt: string };
export type NewLicense = {
  id: string;
  userId: string;
  activationLimit?: number;
  expiresAt?: string | null;
  state?: LicenseState;
};

export type LicenseSummaryRecord = {
  id: string;
  user_id: string;
  email: string;
  state: LicenseState;
  activation_limit: number;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  active_device_count: number;
};
