/**
 * Hand-written mirror of supabase/migrations. Once the project is linked,
 * `pnpm types:gen` writes the generated version to lib/database.types.ts — swap
 * the `Database` below for that one when the schema starts to grow.
 *
 * Every row shape is a `type`, never an `interface`: PostgREST's generics need
 * `Row extends Record<string, unknown>`, which an interface does not satisfy,
 * and every query result would silently collapse to `never`.
 */

export type MessageStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "no_whatsapp";

export type MessageKind = "arrival" | "reminder";

export type Branch = {
  /** HAL's own branch id. */
  id: number;
  name: string;
  tel: string | null;
  district: string | null;
  province: string | null;
  staff_phone: string | null;
  pickup_days: number;
  daily_limit: number;
  /** OpenWA session id. */
  wa_session_id: string | null;
  wa_status: string;
  wa_phone: string | null;
  wa_name: string | null;
  wa_updated_at: string | null;
  /** The branch's own arrival message; null uses the shared template. */
  arrival_template: string | null;
  created_at: string;
};

export type MessageLog = {
  id: number;
  bill_number: string | null;
  tracking_id: string | null;
  receiver_name: string | null;
  hal_user_id: string | null;
  sent_by_name: string | null;
  branch_id: number;
  kind: MessageKind;
  phone: string;
  chat_id: string | null;
  body: string;
  status: MessageStatus;
  wa_message_id: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

export type MessageTemplate = {
  key: MessageKind;
  body: string;
  updated_at: string;
};

/** Mock bill of the development account (lib/demo.ts). */
export type DemoBill = {
  id: number;
  branch_id: number;
  bill_number: string;
  tracking_id: string | null;
  receiver_name: string | null;
  receiver_phone: string | null;
  sender_name: string | null;
  sender_phone: string | null;
  start_branch: string | null;
  start_branch_tel: string | null;
  pay_type: string | null;
  total_freight: number | null;
  cod_amount: number | null;
  weight_kg: number | null;
  size_cm: number | null;
  arrived_at: string;
  created_at: string;
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
      branches: Table<Branch, "id" | "name">;
      message_logs: Table<
        MessageLog,
        "branch_id" | "phone" | "body"
      >;
      message_templates: Table<MessageTemplate, "key" | "body">;
      demo_bills: Table<DemoBill, "branch_id" | "bill_number">;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      message_status: MessageStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
