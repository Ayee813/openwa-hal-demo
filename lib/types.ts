/**
 * Hand-written mirror of supabase/migrations. Once the project is linked,
 * `pnpm types:gen` writes the generated version to lib/database.types.ts — swap
 * the `Database` below for that one when the schema starts to grow.
 *
 * Every row shape is a `type`, never an `interface`: PostgREST's generics need
 * `Row extends Record<string, unknown>`, which an interface does not satisfy,
 * and every query result would silently collapse to `never`.
 */

export type UserRole = "admin" | "branch";

export type ParcelStatus =
  | "in_transit"
  | "arrived"
  | "notified"
  | "picked_up"
  | "delivered";

export type MessageStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "no_whatsapp";

export type MessageKind = "arrival" | "reminder";

export type Profile = {
  id: string;
  role: UserRole;
  full_name: string;
  email: string | null;
  is_active: boolean;
  branch_id: number | null;
  created_at: string;
};

export type Branch = {
  /** HAL's own branch id. */
  id: number;
  name: string;
  code: string | null;
  tel: string | null;
  district: string | null;
  province: string | null;
  staff_phone: string | null;
  auto_send: boolean;
  pickup_days: number;
  daily_limit: number;
  /** OpenWA session id. */
  wa_session_id: string | null;
  wa_status: string;
  wa_phone: string | null;
  wa_name: string | null;
  wa_updated_at: string | null;
  created_at: string;
};

export type Shipment = {
  /** HAL's own shipment id (demo bills draw from 9000000000 up). */
  id: number;
  shipment_number: string;
  shipment_type: string | null;
  shipment_pay_type: string | null;
  shipment_status_id: number | null;
  status_step: string | null;
  status_name: string | null;
  pieces: number | null;
  total_freight: number | null;
  total_price: number | null;
  sender_customer_id: number | null;
  sender_name: string | null;
  receiver_customer_id: number | null;
  receiver_name: string | null;
  start_branch_id: number | null;
  end_branch_id: number | null;
  start_date_actual: string | null;
  end_date_actual: string | null;
  hal_created_at: string | null;
  hal_updated_at: string | null;
  /** The record exactly as the HAL API returned it. */
  raw: Record<string, unknown>;
  imported_by: string | null;
  imported_at: string;
  parcel_status: ParcelStatus;
  receiver_phone: string | null;
  weight_kg: number | null;
  size_cm: number | null;
  cod_amount: number | null;
  arrived_at: string | null;
  scanned_by: string | null;
  pickup_deadline: string | null;
  picked_up_at: string | null;
  is_demo: boolean;
  last_message_status: MessageStatus | null;
  last_message_at: string | null;
};

export type MessageLog = {
  id: number;
  shipment_id: number;
  branch_id: number;
  kind: MessageKind;
  phone: string;
  chat_id: string | null;
  body: string;
  status: MessageStatus;
  wa_message_id: string | null;
  error: string | null;
  sent_by: string | null;
  created_at: string;
  updated_at: string;
};

export type MessageTemplate = {
  key: MessageKind;
  body: string;
  updated_by: string | null;
  updated_at: string;
};

type Table<Row, Required extends keyof Row> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile, "id" | "full_name">;
      branches: Table<Branch, "id" | "name">;
      shipments: Table<Shipment, "shipment_number" | "raw">;
      message_logs: Table<
        MessageLog,
        "shipment_id" | "branch_id" | "phone" | "body"
      >;
      message_templates: Table<MessageTemplate, "key" | "body">;
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_active_user: { Args: Record<string, never>; Returns: boolean };
      my_branch_id: { Args: Record<string, never>; Returns: number | null };
    };
    Enums: {
      user_role: UserRole;
      parcel_status: ParcelStatus;
      message_status: MessageStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
