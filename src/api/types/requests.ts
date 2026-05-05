import type { RequestStatus } from "../lib/types";

export interface ServiceRequest {
  id: string;
  created_at: string;
  category: string;
  borough: string;
  description: string;
  service_id: string;
  member_id: string;
  assigned_org_id?: string;
  assigned_staff_id?: string;
  status: RequestStatus;
  urgency?: string;
  member?: { full_name: string; email?: string; phone?: string; borough?: string };
  assigned_staff?: { full_name: string; email?: string };
  organization?: { name: string; phone?: string; borough?: string };
  metadata?: any;
}

export interface ActivityItem {
  id: string;
  request_id: string;
  created_at: string;
  kind: "note" | "status";
  actor: string;
  text: string;
}
