/**
 * Database types for the Supabase Data API (public schema).
 *
 * These are HAND-AUTHORED to match `supabase/migrations` because the Supabase
 * CLI (`supabase gen types typescript`) requires a running local stack, which is
 * not available in this environment. Regenerate with `pnpm db:types` wherever
 * the CLI/Docker are present; the shape below is the contract until then.
 *
 * Only the public schema is typed - `private` and `app` are never exposed to the
 * Data API.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          timezone: string;
          is_system_owner: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          timezone?: string;
        };
        Update: {
          full_name?: string | null;
          avatar_url?: string | null;
          timezone?: string;
        };
        Relationships: [];
      };
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          status: string;
          plan_code: string;
          default_timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          status?: string;
          plan_code?: string;
          default_timezone?: string;
        };
        Update: {
          name?: string;
          status?: string;
          plan_code?: string;
          default_timezone?: string;
        };
        Relationships: [];
      };
      organization_members: {
        Row: {
          organization_id: string;
          user_id: string;
          role: Database["public"]["Enums"]["member_role"];
          invited_by: string | null;
          created_at: string;
        };
        Insert: {
          organization_id: string;
          user_id: string;
          role: Database["public"]["Enums"]["member_role"];
          invited_by?: string | null;
        };
        Update: {
          role?: Database["public"]["Enums"]["member_role"];
        };
        Relationships: [];
      };
      datasets: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          status: Database["public"]["Enums"]["dataset_status"];
          owner_organization_id: string | null;
          coverage_country_code: string;
          coverage_region: string;
          default_timezone: string;
          is_demo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          status?: Database["public"]["Enums"]["dataset_status"];
          owner_organization_id?: string | null;
          is_demo?: boolean;
        };
        Update: {
          name?: string;
          description?: string | null;
          status?: Database["public"]["Enums"]["dataset_status"];
        };
        Relationships: [];
      };
      organization_dataset_access: {
        Row: {
          organization_id: string;
          dataset_id: string;
          access_level: Database["public"]["Enums"]["access_level"];
          created_at: string;
        };
        Insert: {
          organization_id: string;
          dataset_id: string;
          access_level?: Database["public"]["Enums"]["access_level"];
        };
        Update: {
          access_level?: Database["public"]["Enums"]["access_level"];
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: {
      member_role: "owner" | "admin" | "analyst" | "viewer";
      dataset_status: "active" | "paused" | "archived";
      access_level: "read" | "manage";
    };
    CompositeTypes: Record<never, never>;
  };
}
