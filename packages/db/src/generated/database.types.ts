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
      regions: {
        Row: {
          id: string;
          parent_id: string | null;
          name: string;
          slug: string;
          region_type: string | null;
          country_code: string;
          created_at: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      properties: {
        Row: {
          id: string;
          dataset_id: string;
          canonical_name: string;
          slug: string | null;
          property_type: string | null;
          primary_region_id: string | null;
          latitude: number | null;
          longitude: number | null;
          coordinate_precision_meters: number | null;
          bedrooms: number | null;
          bathrooms: number | null;
          guest_capacity: number | null;
          official_website: string | null;
          business_whatsapp: string | null;
          direct_booking_url: string | null;
          owner_verified: boolean;
          verification_source: string | null;
          current_lifecycle_status:
            Database["public"]["Enums"]["listing_lifecycle_status"] | null;
          current_confidence:
            Database["public"]["Enums"]["confidence_level"] | null;
          first_observed_at: string | null;
          last_observed_at: string | null;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      property_aliases: {
        Row: {
          id: string;
          property_id: string;
          alias: string;
          source: string | null;
          created_at: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      source_listings: {
        Row: {
          id: string;
          dataset_id: string;
          property_id: string;
          source_id: string;
          external_id: string;
          source_url: string | null;
          current_title: string | null;
          current_observation_status:
            Database["public"]["Enums"]["observation_status"] | null;
          current_lifecycle_status: Database["public"]["Enums"]["listing_lifecycle_status"];
          current_confidence: Database["public"]["Enums"]["confidence_level"];
          first_seen_at: string;
          last_seen_active_at: string | null;
          last_observed_at: string;
          consecutive_misses: number;
          host_external_id: string | null;
          official_website: string | null;
          business_whatsapp: string | null;
          direct_booking_url: string | null;
          latest_snapshot_id: string | null;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      listing_snapshots: {
        Row: {
          id: string;
          dataset_id: string;
          source_listing_id: string;
          collection_run_id: string;
          raw_observation_id: string | null;
          observed_at: string;
          observation_status: Database["public"]["Enums"]["observation_status"];
          title: string | null;
          property_type: string | null;
          region_id: string | null;
          latitude: number | null;
          longitude: number | null;
          rating: number | null;
          review_count: number | null;
          observed_price_amount: string | null;
          observed_price_currency: string | null;
          observed_price_unit: string | null;
          bedrooms: number | null;
          bathrooms: number | null;
          guest_capacity: number | null;
          is_superhost: boolean | null;
          host_external_id: string | null;
          content_fingerprint: string;
          parser_version: string;
          created_at: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      snapshot_diffs: {
        Row: {
          id: string;
          dataset_id: string;
          source_listing_id: string;
          previous_snapshot_id: string | null;
          current_snapshot_id: string;
          field_name: string;
          previous_value: Json | null;
          current_value: Json | null;
          change_kind: string;
          is_material: boolean;
          rule_version: string;
          created_at: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          dataset_id: string;
          property_id: string;
          source_listing_id: string | null;
          event_type: Database["public"]["Enums"]["event_type"];
          event_at: string;
          detected_at: string;
          confidence: Database["public"]["Enums"]["confidence_level"] | null;
          title: string;
          summary: string | null;
          previous_value: Json | null;
          current_value: Json | null;
          rule_version: string | null;
          deduplication_key: string | null;
          is_reviewed: boolean;
          dismissed_at: string | null;
          created_at: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      event_evidence: {
        Row: {
          id: string;
          event_id: string;
          previous_snapshot_id: string | null;
          current_snapshot_id: string | null;
          collection_run_id: string | null;
          raw_observation_id: string | null;
          evidence_type: string;
          explanation: string;
          metadata: Json;
          created_at: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: number;
          organization_id: string | null;
          actor_user_id: string | null;
          actor_type: string;
          action: string;
          target_type: string | null;
          target_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: {
      member_role: "owner" | "admin" | "analyst" | "viewer";
      dataset_status: "active" | "paused" | "archived";
      access_level: "read" | "manage";
      observation_status:
        | "active"
        | "unavailable"
        | "not_found"
        | "search_not_observed"
        | "blocked"
        | "source_error"
        | "unknown";
      listing_lifecycle_status:
        | "active"
        | "first_miss"
        | "suspected_inactive"
        | "confirmed_inactive"
        | "reactivated"
        | "archived";
      confidence_level: "low" | "medium" | "high";
      event_type:
        | "listing_created"
        | "listing_first_miss"
        | "listing_suspected_inactive"
        | "listing_confirmed_inactive"
        | "listing_reactivated"
        | "listing_archived"
        | "price_changed"
        | "rating_changed"
        | "review_count_changed"
        | "title_changed"
        | "description_changed"
        | "photos_changed"
        | "amenities_changed"
        | "host_changed"
        | "superhost_gained"
        | "superhost_lost"
        | "location_changed"
        | "direct_channel_added"
        | "direct_channel_removed"
        | "source_error"
        | "manual_correction"
        | "property_merged"
        | "property_split";
    };
    CompositeTypes: Record<never, never>;
  };
}
