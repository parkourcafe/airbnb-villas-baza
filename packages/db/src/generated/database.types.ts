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
          reviewed_by: string | null;
          reviewed_at: string | null;
          dismissed_at: string | null;
          dismissal_reason: string | null;
          created_at: string;
        };
        Insert: Record<string, never>;
        Update: {
          is_reviewed?: boolean;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          dismissed_at?: string | null;
          dismissal_reason?: string | null;
        };
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
        Insert: {
          organization_id?: string | null;
          actor_user_id?: string | null;
          actor_type?: string;
          action: string;
          target_type?: string | null;
          target_id?: string | null;
          metadata?: Json;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      imports: {
        Row: {
          id: string;
          organization_id: string;
          dataset_id: string;
          source_id: string;
          status: Database["public"]["Enums"]["import_status"];
          input_object_path: string | null;
          original_filename: string | null;
          file_checksum: string | null;
          column_mapping: Json;
          requested_by: string | null;
          collection_run_id: string | null;
          total_rows: number;
          accepted_rows: number;
          rejected_rows: number;
          duplicate_rows: number;
          warning_count: number;
          error_summary: string | null;
          created_at: string;
          started_at: string | null;
          finished_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          dataset_id: string;
          source_id: string;
          status?: Database["public"]["Enums"]["import_status"];
          input_object_path?: string | null;
          original_filename?: string | null;
          file_checksum?: string | null;
          column_mapping?: Json;
          requested_by?: string | null;
        };
        Update: {
          status?: Database["public"]["Enums"]["import_status"];
          collection_run_id?: string | null;
          total_rows?: number;
          accepted_rows?: number;
          rejected_rows?: number;
          duplicate_rows?: number;
          warning_count?: number;
          error_summary?: string | null;
          started_at?: string | null;
          finished_at?: string | null;
        };
        Relationships: [];
      };
      import_rejections: {
        Row: {
          id: number;
          import_id: string;
          row_number: number;
          error_code: string;
          error_message: string | null;
          raw_row: Json | null;
          created_at: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      watchlists: {
        Row: {
          id: string;
          organization_id: string;
          dataset_id: string;
          name: string;
          description: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          dataset_id: string;
          name: string;
          description?: string | null;
        };
        Update: {
          name?: string;
          description?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      watchlist_items: {
        Row: {
          id: string;
          watchlist_id: string;
          item_type: string;
          property_id: string | null;
          source_listing_id: string | null;
          region_id: string | null;
          saved_filter: Json | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          watchlist_id: string;
          item_type: string;
          property_id?: string | null;
          source_listing_id?: string | null;
          region_id?: string | null;
          saved_filter?: Json | null;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      leads: {
        Row: {
          id: string;
          organization_id: string;
          dataset_id: string;
          property_id: string;
          source_listing_id: string | null;
          event_id: string | null;
          stage: Database["public"]["Enums"]["lead_stage"];
          priority: number;
          reason_code: string | null;
          reason_text: string | null;
          contact_name: string | null;
          contact_role: string | null;
          business_email: string | null;
          business_whatsapp: string | null;
          website: string | null;
          instagram: string | null;
          contact_source_url: string | null;
          contact_data_basis: string | null;
          assigned_to: string | null;
          last_activity_at: string | null;
          next_action_at: string | null;
          do_not_contact: boolean;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          dataset_id: string;
          property_id: string;
          source_listing_id?: string | null;
          event_id?: string | null;
          stage?: Database["public"]["Enums"]["lead_stage"];
          priority?: number;
          reason_code?: string | null;
          reason_text?: string | null;
          do_not_contact?: boolean;
        };
        Update: {
          stage?: Database["public"]["Enums"]["lead_stage"];
          priority?: number;
          reason_text?: string | null;
          contact_name?: string | null;
          contact_role?: string | null;
          business_email?: string | null;
          business_whatsapp?: string | null;
          website?: string | null;
          instagram?: string | null;
          contact_source_url?: string | null;
          contact_data_basis?: string | null;
          assigned_to?: string | null;
          last_activity_at?: string | null;
          next_action_at?: string | null;
          do_not_contact?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      lead_activities: {
        Row: {
          id: string;
          lead_id: string;
          activity_type: string;
          body: string | null;
          previous_stage: Database["public"]["Enums"]["lead_stage"] | null;
          new_stage: Database["public"]["Enums"]["lead_stage"] | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          activity_type: string;
          body?: string | null;
          previous_stage?: Database["public"]["Enums"]["lead_stage"] | null;
          new_stage?: Database["public"]["Enums"]["lead_stage"] | null;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      property_notes: {
        Row: {
          id: string;
          organization_id: string;
          property_id: string;
          body: string;
          created_by: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          property_id: string;
          body: string;
        };
        Update: {
          body?: string;
          deleted_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      reports: {
        Row: {
          id: string;
          organization_id: string;
          dataset_id: string;
          report_type: string;
          name: string;
          parameters: Json;
          status: Database["public"]["Enums"]["report_status"];
          output_object_path: string | null;
          row_count: number | null;
          requested_by: string;
          created_at: string;
          ready_at: string | null;
          expires_at: string | null;
          error_summary: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          dataset_id: string;
          report_type: string;
          name: string;
          parameters?: Json;
        };
        Update: {
          status?: Database["public"]["Enums"]["report_status"];
          output_object_path?: string | null;
          row_count?: number | null;
          ready_at?: string | null;
          expires_at?: string | null;
          error_summary?: string | null;
        };
        Relationships: [];
      };
      property_redirects: {
        Row: {
          id: string;
          dataset_id: string;
          from_property_id: string;
          to_property_id: string;
          reason: string | null;
          kind: string;
          moved_source_listing_ids: string[];
          created_by: string;
          created_at: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      collection_schedules: {
        Row: {
          id: string;
          dataset_id: string;
          source_id: string;
          cadence_minutes: number;
          enabled: boolean;
          last_enqueued_at: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          dataset_id: string;
          source_id: string;
          cadence_minutes?: number;
          enabled?: boolean;
        };
        Update: {
          cadence_minutes?: number;
          enabled?: boolean;
          last_enqueued_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      browser_collections: {
        Row: {
          id: string;
          organization_id: string;
          dataset_id: string;
          source_id: string;
          source_key: string;
          market: string;
          mode: Database["public"]["Enums"]["collection_mode"];
          state: Database["public"]["Enums"]["collection_job_state"];
          headed: boolean;
          collect_details: boolean;
          max_listings: number | null;
          min_rating: number | null;
          min_review_count: number | null;
          selected_areas: string[];
          requested_start_at: string | null;
          source_snapshot_id: string | null;
          config: Json;
          planned_cells: number;
          completed_cells: number;
          cards_discovered: number;
          unique_listings: number;
          duplicate_discoveries: number;
          detail_pages_completed: number;
          warning_count: number;
          error_count: number;
          current_area: string | null;
          current_cell: string | null;
          manual_action_reason:
            Database["public"]["Enums"]["manual_action_reason"] | null;
          manual_action_detail: string | null;
          locked_by: string | null;
          locked_at: string | null;
          heartbeat_at: string | null;
          requested_by: string | null;
          started_at: string | null;
          finished_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          dataset_id: string;
          source_id: string;
          source_key: string;
          market?: string;
          mode?: Database["public"]["Enums"]["collection_mode"];
          state?: Database["public"]["Enums"]["collection_job_state"];
          headed?: boolean;
          collect_details?: boolean;
          max_listings?: number | null;
          min_rating?: number | null;
          min_review_count?: number | null;
          selected_areas?: string[];
          requested_start_at?: string | null;
          source_snapshot_id?: string | null;
          config?: Json;
        };
        Update: {
          state?: Database["public"]["Enums"]["collection_job_state"];
          manual_action_reason?:
            Database["public"]["Enums"]["manual_action_reason"] | null;
          manual_action_detail?: string | null;
          finished_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      collection_search_cells: {
        Row: {
          id: string;
          collection_id: string;
          dataset_id: string;
          parent_area: string;
          north: number;
          south: number;
          east: number;
          west: number;
          zoom: number;
          status: Database["public"]["Enums"]["search_cell_status"];
          listings_discovered: number;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          collection_id: string;
          dataset_id: string;
          parent_area: string;
          north: number;
          south: number;
          east: number;
          west: number;
          zoom: number;
          status?: Database["public"]["Enums"]["search_cell_status"];
        };
        Update: {
          status?: Database["public"]["Enums"]["search_cell_status"];
          listings_discovered?: number;
          started_at?: string | null;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      collection_observations: {
        Row: {
          id: string;
          collection_id: string;
          dataset_id: string;
          source_id: string;
          source_listing_id: string;
          source_url: string | null;
          title: string | null;
          area: string | null;
          rating: number | null;
          review_count: number | null;
          displayed_price: string | null;
          currency: string | null;
          guest_capacity: number | null;
          bedrooms: number | null;
          latitude: number | null;
          longitude: number | null;
          image_url: string | null;
          discovery_cell_ids: string[];
          discovery_count: number;
          detail_collected: boolean;
          detail_observed_status:
            Database["public"]["Enums"]["detail_observed_status"] | null;
          detail: Json | null;
          raw_payload: Json;
          observed_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          collection_id: string;
          dataset_id: string;
          source_id: string;
          source_listing_id: string;
          observed_at: string;
        };
        Update: {
          detail_collected?: boolean;
          detail_observed_status?:
            Database["public"]["Enums"]["detail_observed_status"] | null;
          detail?: Json | null;
        };
        Relationships: [];
      };
      market_snapshots: {
        Row: {
          id: string;
          dataset_id: string;
          collection_id: string | null;
          source_id: string;
          source_key: string;
          market: string;
          observation_started_at: string | null;
          observation_completed_at: string | null;
          unique_listing_count: number;
          search_cell_coverage: number;
          completion_percentage: number;
          quality_status: Database["public"]["Enums"]["snapshot_quality_status"];
          warning_count: number;
          checksum: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          dataset_id: string;
          collection_id?: string | null;
          source_id: string;
          source_key: string;
          market: string;
          quality_status: Database["public"]["Enums"]["snapshot_quality_status"];
          checksum: string;
        };
        Update: {
          quality_status?: Database["public"]["Enums"]["snapshot_quality_status"];
        };
        Relationships: [];
      };
      market_snapshot_listings: {
        Row: {
          id: string;
          snapshot_id: string;
          dataset_id: string;
          source_listing_id: string;
          source_url: string | null;
          title: string | null;
          area: string | null;
          rating: number | null;
          review_count: number | null;
          displayed_price: string | null;
          currency: string | null;
          guest_capacity: number | null;
          bedrooms: number | null;
          latitude: number | null;
          longitude: number | null;
          detail: Json | null;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          snapshot_id: string;
          dataset_id: string;
          source_listing_id: string;
        };
        Update: Record<never, never>;
        Relationships: [];
      };
      listing_verifications: {
        Row: {
          id: string;
          collection_id: string;
          dataset_id: string;
          source_id: string;
          source_listing_id: string;
          source_url: string | null;
          status: Database["public"]["Enums"]["listing_verification_status"];
          previous_snapshot_id: string | null;
          observed_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          collection_id: string;
          dataset_id: string;
          source_id: string;
          source_listing_id: string;
          status: Database["public"]["Enums"]["listing_verification_status"];
          observed_at: string;
        };
        Update: Record<never, never>;
        Relationships: [];
      };
    };
    Views: {
      import_sources: {
        Row: {
          id: string;
          key: string;
          display_name: string;
          access_mode: string;
        };
        Relationships: [];
      };
      source_catalog: {
        Row: {
          id: string;
          key: string;
          display_name: string;
          access_mode: string;
          compliance_status: string;
          automation_allowed: boolean;
          capabilities: string[];
          terms_reviewed_at: string | null;
          review_expires_at: string | null;
          restriction_reason: string | null;
          rate_limit_policy: Json | null;
        };
        Relationships: [];
      };
      browser_collection_sources: {
        Row: {
          id: string;
          key: string;
          display_name: string;
          access_mode: string;
          compliance_status: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      merge_properties: {
        Args: { p_from: string; p_to: string; p_reason?: string | null };
        Returns: undefined;
      };
      split_listing: {
        Args: { p_source_listing: string; p_reason?: string | null };
        Returns: string;
      };
      rollback_merge: {
        Args: { p_redirect: string; p_reason?: string | null };
        Returns: undefined;
      };
      enqueue_due_collections: {
        Args: Record<string, never>;
        Returns: number;
      };
    };
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
      import_status:
        | "uploaded"
        | "validating"
        | "ready"
        | "processing"
        | "completed"
        | "completed_with_errors"
        | "failed"
        | "cancelled";
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
      lead_stage:
        | "new"
        | "qualified"
        | "contacted"
        | "in_progress"
        | "won"
        | "lost"
        | "archived";
      report_status:
        "pending" | "queued" | "running" | "ready" | "failed" | "expired";
      collection_mode:
        | "search_results_only"
        | "search_and_details"
        | "verify_existing_listings";
      collection_job_state:
        | "draft"
        | "queued"
        | "claimed"
        | "running"
        | "manual_action_required"
        | "paused"
        | "completing"
        | "completed"
        | "partial"
        | "failed"
        | "cancelled";
      manual_action_reason:
        | "captcha"
        | "login_challenge"
        | "account_verification"
        | "access_denied"
        | "blocking_page"
        | "navigation_failure";
      search_cell_status:
        | "pending"
        | "running"
        | "completed"
        | "manual_action_required"
        | "failed"
        | "skipped";
      snapshot_quality_status: "complete" | "partial" | "degraded" | "failed";
      listing_verification_status:
        | "active"
        | "unavailable"
        | "not_found"
        | "login_required"
        | "blocked"
        | "source_error"
        | "unknown";
      detail_observed_status:
        | "collected"
        | "unavailable"
        | "not_found"
        | "blocked"
        | "error"
        | "skipped";
    };
    CompositeTypes: Record<never, never>;
  };
}
