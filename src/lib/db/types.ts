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
