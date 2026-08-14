// Hand-written to match supabase/migrations/*.sql until a Supabase
// project exists to link. Run `pnpm db:types` to replace this file
// with the real generated types after `supabase link` (see AGENTS.md
// "Regenerate types after every migration" and RUNBOOK.md).

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
      leagues: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["leagues"]["Insert"]>;
        Relationships: [];
      };
      franchises: {
        Row: {
          id: string;
          league_id: string;
          display_name: string;
          owner_user_id: string | null;
          founded_year: number | null;
          is_active: boolean;
          status: "active" | "retired";
          og_manager: boolean;
          espn_owner_ids: string[];
          retired_season: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          league_id: string;
          display_name: string;
          owner_user_id?: string | null;
          founded_year?: number | null;
          is_active?: boolean;
          status?: "active" | "retired";
          og_manager?: boolean;
          espn_owner_ids?: string[];
          retired_season?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["franchises"]["Insert"]>;
        Relationships: [];
      };
      seasons: {
        Row: {
          id: string;
          league_id: string;
          year: number;
          espn_league_id: string | null;
          regular_weeks: number;
          playoff_teams: number;
          is_locked: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          league_id: string;
          year: number;
          espn_league_id?: string | null;
          regular_weeks?: number;
          playoff_teams?: number;
          is_locked?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["seasons"]["Insert"]>;
        Relationships: [];
      };
      teams: {
        Row: {
          id: string;
          season_id: string;
          franchise_id: string;
          name: string;
          abbreviation: string | null;
          logo_url: string | null;
          espn_team_id: string | null;
          draft_slot: number | null;
        };
        Insert: {
          id?: string;
          season_id: string;
          franchise_id: string;
          name: string;
          abbreviation?: string | null;
          logo_url?: string | null;
          espn_team_id?: string | null;
          draft_slot?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["teams"]["Insert"]>;
        Relationships: [];
      };
      stat_categories: {
        Row: {
          key: string;
          display_name: string;
          unit: string | null;
          applies_to: string[];
        };
        Insert: {
          key: string;
          display_name: string;
          unit?: string | null;
          applies_to: string[];
        };
        Update: Partial<Database["public"]["Tables"]["stat_categories"]["Insert"]>;
        Relationships: [];
      };
      scoring_rules: {
        Row: {
          id: string;
          season_id: string;
          stat_key: string;
          points_per_unit: number;
          flat_bonus: number;
          min_value: number | null;
          max_value: number | null;
          position_filter: string[] | null;
          sort_order: number;
        };
        Insert: {
          id?: string;
          season_id: string;
          stat_key: string;
          points_per_unit?: number;
          flat_bonus?: number;
          min_value?: number | null;
          max_value?: number | null;
          position_filter?: string[] | null;
          sort_order?: number;
        };
        Update: Partial<Database["public"]["Tables"]["scoring_rules"]["Insert"]>;
        Relationships: [];
      };
      roster_slots: {
        Row: {
          id: string;
          season_id: string;
          slot_code: string;
          eligible_positions: string[];
          count: number;
          is_starting_slot: boolean;
          sort_order: number;
        };
        Insert: {
          id?: string;
          season_id: string;
          slot_code: string;
          eligible_positions: string[];
          count: number;
          is_starting_slot?: boolean;
          sort_order?: number;
        };
        Update: Partial<Database["public"]["Tables"]["roster_slots"]["Insert"]>;
        Relationships: [];
      };
      players: {
        Row: {
          id: string;
          full_name: string;
          position: string;
          nfl_team: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          position: string;
          nfl_team?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["players"]["Insert"]>;
        Relationships: [];
      };
      player_external_ids: {
        Row: {
          player_id: string;
          provider: string;
          external_id: string;
        };
        Insert: {
          player_id: string;
          provider: string;
          external_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["player_external_ids"]["Insert"]>;
        Relationships: [];
      };
      stat_lines: {
        Row: {
          id: number;
          player_id: string;
          year: number;
          week: number;
          stat_key: string;
          value: number;
          source: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          player_id: string;
          year: number;
          week: number;
          stat_key: string;
          value: number;
          source: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["stat_lines"]["Insert"]>;
        Relationships: [];
      };
      matchups: {
        Row: {
          id: string;
          season_id: string;
          week: number;
          home_team_id: string;
          away_team_id: string;
          home_score: number | null;
          away_score: number | null;
          is_playoff: boolean;
          is_championship: boolean;
          is_final: boolean;
        };
        Insert: {
          id?: string;
          season_id: string;
          week: number;
          home_team_id: string;
          away_team_id: string;
          home_score?: number | null;
          away_score?: number | null;
          is_playoff?: boolean;
          is_championship?: boolean;
          is_final?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["matchups"]["Insert"]>;
        Relationships: [];
      };
      lineup_entries: {
        Row: {
          id: string;
          team_id: string;
          week: number;
          player_id: string;
          slot_code: string;
          is_starter: boolean;
          points: number | null;
        };
        Insert: {
          id?: string;
          team_id: string;
          week: number;
          player_id: string;
          slot_code: string;
          is_starter: boolean;
          points?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["lineup_entries"]["Insert"]>;
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          season_id: string;
          week: number | null;
          type: string;
          team_id: string | null;
          counterparty_team_id: string | null;
          faab_spent: number | null;
          occurred_at: string;
          details: Json | null;
        };
        Insert: {
          id?: string;
          season_id: string;
          week?: number | null;
          type: string;
          team_id?: string | null;
          counterparty_team_id?: string | null;
          faab_spent?: number | null;
          occurred_at: string;
          details?: Json | null;
        };
        Update: Partial<Database["public"]["Tables"]["transactions"]["Insert"]>;
        Relationships: [];
      };
      draft_picks: {
        Row: {
          id: string;
          season_id: string;
          round: number;
          pick_in_round: number;
          overall_pick: number;
          team_id: string;
          player_id: string | null;
          keeper: boolean;
          auction_cost: number | null;
        };
        Insert: {
          id?: string;
          season_id: string;
          round: number;
          pick_in_round: number;
          overall_pick: number;
          team_id: string;
          player_id?: string | null;
          keeper?: boolean;
          auction_cost?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["draft_picks"]["Insert"]>;
        Relationships: [];
      };
      record_definitions: {
        Row: {
          id: string;
          league_id: string;
          key: string;
          title: string;
          description: string | null;
          scope: string;
          direction: string;
          query_name: string;
          is_featured: boolean;
          sort_order: number;
        };
        Insert: {
          id?: string;
          league_id: string;
          key: string;
          title: string;
          description?: string | null;
          scope: string;
          direction?: string;
          query_name: string;
          is_featured?: boolean;
          sort_order?: number;
        };
        Update: Partial<Database["public"]["Tables"]["record_definitions"]["Insert"]>;
        Relationships: [];
      };
      awards: {
        Row: {
          id: string;
          season_id: string;
          franchise_id: string | null;
          title: string;
          note: string | null;
        };
        Insert: {
          id?: string;
          season_id: string;
          franchise_id?: string | null;
          title: string;
          note?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["awards"]["Insert"]>;
        Relationships: [];
      };
      draft_pick_grades: {
        Row: {
          id: string;
          draft_pick_id: string;
          adp_at_pick: number | null;
          reach_value: number | null;
          draft_night_grade: string | null;
          season_points: number | null;
          expected_points: number | null;
          voe: number | null;
          regrade_grade: string | null;
          regrade_rank: number | null;
          computed_at: string;
        };
        Insert: {
          id?: string;
          draft_pick_id: string;
          adp_at_pick?: number | null;
          reach_value?: number | null;
          draft_night_grade?: string | null;
          season_points?: number | null;
          expected_points?: number | null;
          voe?: number | null;
          regrade_grade?: string | null;
          regrade_rank?: number | null;
          computed_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["draft_pick_grades"]["Insert"]>;
        Relationships: [];
      };
      trade_grades: {
        Row: {
          id: string;
          season_id: string;
          trade_id: string;
          team_id: string;
          started_points: number;
          total_points: number;
          evaluation_window: string;
          verdict: string | null;
          computed_at: string;
        };
        Insert: {
          id?: string;
          season_id: string;
          trade_id: string;
          team_id: string;
          started_points: number;
          total_points: number;
          evaluation_window: string;
          verdict?: string | null;
          computed_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["trade_grades"]["Insert"]>;
        Relationships: [];
      };
      data_gaps: {
        Row: {
          id: string;
          season_id: string | null;
          scope: string;
          description: string;
          assumption: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          season_id?: string | null;
          scope: string;
          description: string;
          assumption: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["data_gaps"]["Insert"]>;
        Relationships: [];
      };
      sync_runs: {
        Row: {
          id: number;
          provider: string;
          scope: string;
          season_id: string | null;
          week: number | null;
          status: string;
          message: string | null;
          started_at: string;
          finished_at: string | null;
        };
        Insert: {
          id?: number;
          provider: string;
          scope: string;
          season_id?: string | null;
          week?: number | null;
          status: string;
          message?: string | null;
          started_at?: string;
          finished_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["sync_runs"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
