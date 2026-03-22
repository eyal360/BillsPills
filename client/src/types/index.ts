export interface User {
  id: string;
  email: string;
  full_name?: string;
  role: 'user' | 'admin';
  created_at?: string;
}

export interface Property {
  id: string;
  user_id: string;
  name: string;
  icon?: string;
  address?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Bill {
  id: string;
  property_id: string;
  bill_type: string;
  amount?: number;
  paid_amount?: number;
  status: 'waiting' | 'paid' | 'partial';
  due_date?: string;
  bill_date?: string;
  image_url?: string;
  extracted_data: Record<string, unknown>;
  billing_period_start?: string;
  billing_period_end?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  user: User;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface OcrResult {
  bill_type: string;
  amount: number | null;
  bill_date: string | null;
  due_date: string | null;
  billing_period_start: string | null;
  billing_period_end: string | null;
  matched_property_id: string | null;
  extracted_data: Record<string, unknown>;
  fields: string[];
}

export interface ExpenseSummary {
  bill_type: string;
  total: number;
  count: number;
}

export interface AdminStats {
  totalUsers: number;
  totalProperties: number;
  totalBills: number;
  totalSpent: number;
  waitingCount: number;
}
