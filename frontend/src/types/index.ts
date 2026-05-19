// ─── Enums ────────────────────────────────────────────────────
export type UserRole = 'admin' | 'manager' | 'user';

export type AssetCondition = 'new' | 'good' | 'damaged' | 'retired';
export type AssetStatus = 'stock' | 'assigned' | 'faulty' | 'sold';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export type HistoryEventType =
  | 'created' | 'updated' | 'assigned'
  | 'unassigned' | 'maintenance' | 'status_changed' | 'disposed';

// ─── User ─────────────────────────────────────────────────────
export interface User {
  id: string;
  employee_id?: string;
  full_name: string;
  email: string;
  department?: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

// ─── Asset ────────────────────────────────────────────────────
export interface Asset {
  id: string;
  asset_tag: string;
  name: string;
  category: string;
  brand?: string;
  model_number?: string;
  serial_number?: string;
  specifications?: Record<string, string>;
  condition: AssetCondition;
  status: AssetStatus;
  location?: string;
  purchase_date?: string;
  warranty_expiry_date?: string;
  notes?: string;
  purchase_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  current_assignee_name?: string | null;
}

export interface AssetListResponse {
  total: number;
  page: number;
  page_size: number;
  items: Asset[];
}

// ─── Purchase ─────────────────────────────────────────────────
export interface Purchase {
  id: string;
  vendor_name: string;
  invoice_number: string;
  purchase_date: string;
  total_cost: number;
  warranty_details?: string;
  documents?: string[];
  created_at: string;
}

// ─── Assignment ───────────────────────────────────────────────
export interface Assignment {
  id: string;
  asset_id: string;
  asset?: Asset;
  user_id: string;
  assigned_user?: User;
  department?: string;
  assignment_date: string;
  return_date?: string;
  expected_return_date?: string;
  approval_status: ApprovalStatus;
  approved_by?: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
}

// ─── Asset History ────────────────────────────────────────────
export interface AssetHistory {
  id: string;
  asset_id: string;
  event_type: HistoryEventType;
  description: string;
  changed_fields?: Record<string, { old: unknown; new: unknown }>;
  performed_by?: string;
  performed_by_user?: User;
  created_at: string;
}

// ─── Auth ─────────────────────────────────────────────────────
export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  department?: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: AuthUser;
}

// ─── Reports ─────────────────────────────────────────────────
export interface AssetSummary {
  total_assets: number;
  by_status: Record<AssetStatus, number>;
}

// ─── Pagination ───────────────────────────────────────────────
export interface PaginatedResponse<T> {
  total: number;
  page: number;
  page_size: number;
  items: T[];
}

// ─── API Errors ───────────────────────────────────────────────
export interface ApiError {
  detail: string;
  status_code?: number;
}
