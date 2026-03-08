export type LeadStatus =
  | "pending"
  | "email_1_sent"
  | "email_2_sent"
  | "email_3_sent"
  | "email_4_sent"
  | "email_5_sent"
  | "completed"
  | "failed";

export interface Lead {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  company: string | null;
  title: string | null;
  sender_inbox_id: string | null;
  sender_email?: string;
  status: LeadStatus;
  contacted_at: string | null;
  response_received: boolean;
  next_send_date: string | null;
  created_at: string;
  updated_at: string;

  // Per-lead email content
  email_1_subject: string | null;
  email_1_body: string | null;
  wait_after_email_1: number | null;
  email_2_subject: string | null;
  email_2_body: string | null;
  wait_after_email_2: number | null;
  email_3_subject: string | null;
  email_3_body: string | null;
  wait_after_email_3: number | null;
  email_4_subject: string | null;
  email_4_body: string | null;
  wait_after_email_4: number | null;
  email_5_subject: string | null;
  email_5_body: string | null;
}

export interface SenderInbox {
  id: string;
  email: string;
  display_name: string;
  lindy_webhook_url: string;
  lindy_webhook_secret: string | null;
  daily_limit: number;
  hourly_limit: number;
  is_active: boolean;
  created_at: string;
}

export interface SendLog {
  id: string;
  lead_id: string;
  sender_inbox_id: string;
  email_number: number;
  sent_at: string;
  status: "sent" | "failed" | "bounced";
}

export interface InboxStats {
  id: string;
  email: string;
  display_name: string;
  sent_today: number;
  sent_this_hour: number;
  daily_limit: number;
  hourly_limit: number;
  is_active: boolean;
}

export interface SendLogEntry {
  id: string;
  lead_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  company: string | null;
  sender_email: string;
  email_number: number;
  email_subject: string | null;
  email_body: string | null;
  lead_deleted: boolean;
  status: "sent" | "failed" | "bounced";
  sent_at: string;
}
