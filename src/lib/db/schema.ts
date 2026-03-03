import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";

export const leadStatusEnum = pgEnum("lead_status", [
  "pending",
  "email_1_sent",
  "email_2_sent",
  "email_3_sent",
  "email_4_sent",
  "email_5_sent",
  "completed",
  "failed",
]);

export const sendLogStatusEnum = pgEnum("send_log_status", [
  "sent",
  "failed",
  "bounced",
]);

export const campaigns = pgTable("campaigns", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email_1_subject: text("email_1_subject").notNull(),
  email_1_body: text("email_1_body").notNull(),
  wait_after_email_1: integer("wait_after_email_1"),
  email_2_subject: text("email_2_subject"),
  email_2_body: text("email_2_body"),
  wait_after_email_2: integer("wait_after_email_2"),
  email_3_subject: text("email_3_subject"),
  email_3_body: text("email_3_body"),
  wait_after_email_3: integer("wait_after_email_3"),
  email_4_subject: text("email_4_subject"),
  email_4_body: text("email_4_body"),
  wait_after_email_4: integer("wait_after_email_4"),
  email_5_subject: text("email_5_subject"),
  email_5_body: text("email_5_body"),
  created_at: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  deleted_at: timestamp("deleted_at", { withTimezone: true }),
  updated_at: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const senderInboxes = pgTable("sender_inboxes", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  display_name: text("display_name").notNull(),
  lindy_webhook_url: text("lindy_webhook_url").notNull(),
  lindy_webhook_secret: text("lindy_webhook_secret"),
  daily_limit: integer("daily_limit").notNull().default(80),
  hourly_limit: integer("hourly_limit").notNull().default(10),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const leads = pgTable("leads", {
  id: uuid("id").defaultRandom().primaryKey(),
  first_name: text("first_name"),
  last_name: text("last_name"),
  email: text("email").notNull(),
  company: text("company"),
  title: text("title"),
  campaign_id: uuid("campaign_id")
    .references(() => campaigns.id, { onDelete: "set null" }),
  sender_inbox_id: uuid("sender_inbox_id").references(() => senderInboxes.id, {
    onDelete: "set null",
  }),
  status: leadStatusEnum("status").notNull().default("pending"),
  contacted_at: timestamp("contacted_at", { withTimezone: true }),
  response_received: boolean("response_received").notNull().default(false),

  // Per-lead email content (replaces campaign-level templates)
  email_1_subject: text("email_1_subject"),
  email_1_body: text("email_1_body"),
  wait_after_email_1: integer("wait_after_email_1"),
  email_2_subject: text("email_2_subject"),
  email_2_body: text("email_2_body"),
  wait_after_email_2: integer("wait_after_email_2"),
  email_3_subject: text("email_3_subject"),
  email_3_body: text("email_3_body"),
  wait_after_email_3: integer("wait_after_email_3"),
  email_4_subject: text("email_4_subject"),
  email_4_body: text("email_4_body"),
  wait_after_email_4: integer("wait_after_email_4"),
  email_5_subject: text("email_5_subject"),
  email_5_body: text("email_5_body"),

  created_at: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  deleted_at: timestamp("deleted_at", { withTimezone: true }),
  updated_at: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (table) => [
  index("leads_campaign_id_idx").on(table.campaign_id),
  index("leads_sender_inbox_id_idx").on(table.sender_inbox_id),
  index("leads_status_idx").on(table.status),
  index("leads_deleted_at_idx").on(table.deleted_at),
  index("leads_email_idx").on(table.email),
]);

export const appSettings = pgTable("app_settings", {
  id: integer("id").primaryKey().default(1),
  auto_send_enabled: boolean("auto_send_enabled").notNull().default(false),
  test_mode: boolean("test_mode").notNull().default(false),
  updated_at: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const sendLogs = pgTable("send_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  lead_id: uuid("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  sender_inbox_id: uuid("sender_inbox_id")
    .notNull()
    .references(() => senderInboxes.id, { onDelete: "cascade" }),
  email_number: integer("email_number").notNull(),
  sent_at: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  status: sendLogStatusEnum("status").notNull().default("sent"),
}, (table) => [
  index("send_logs_sender_inbox_id_idx").on(table.sender_inbox_id),
  index("send_logs_sent_at_idx").on(table.sent_at),
  index("send_logs_lead_id_idx").on(table.lead_id),
]);
