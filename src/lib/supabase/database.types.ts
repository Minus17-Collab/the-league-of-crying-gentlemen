export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      awards: {
        Row: {
          franchise_id: string | null
          id: string
          note: string | null
          season_id: string
          title: string
        }
        Insert: {
          franchise_id?: string | null
          id?: string
          note?: string | null
          season_id: string
          title: string
        }
        Update: {
          franchise_id?: string | null
          id?: string
          note?: string | null
          season_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "awards_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "awards_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      data_gaps: {
        Row: {
          assumption: string
          created_at: string
          description: string
          id: string
          scope: string
          season_id: string | null
        }
        Insert: {
          assumption: string
          created_at?: string
          description: string
          id?: string
          scope: string
          season_id?: string | null
        }
        Update: {
          assumption?: string
          created_at?: string
          description?: string
          id?: string
          scope?: string
          season_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_gaps_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_pick_grades: {
        Row: {
          adp_at_pick: number | null
          computed_at: string
          draft_night_grade: string | null
          draft_pick_id: string
          expected_points: number | null
          id: string
          reach_value: number | null
          regrade_grade: string | null
          regrade_rank: number | null
          season_points: number | null
          voe: number | null
        }
        Insert: {
          adp_at_pick?: number | null
          computed_at?: string
          draft_night_grade?: string | null
          draft_pick_id: string
          expected_points?: number | null
          id?: string
          reach_value?: number | null
          regrade_grade?: string | null
          regrade_rank?: number | null
          season_points?: number | null
          voe?: number | null
        }
        Update: {
          adp_at_pick?: number | null
          computed_at?: string
          draft_night_grade?: string | null
          draft_pick_id?: string
          expected_points?: number | null
          id?: string
          reach_value?: number | null
          regrade_grade?: string | null
          regrade_rank?: number | null
          season_points?: number | null
          voe?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "draft_pick_grades_draft_pick_id_fkey"
            columns: ["draft_pick_id"]
            isOneToOne: true
            referencedRelation: "draft_picks"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_picks: {
        Row: {
          auction_cost: number | null
          id: string
          keeper: boolean
          overall_pick: number
          pick_in_round: number
          player_id: string | null
          round: number
          season_id: string
          team_id: string
        }
        Insert: {
          auction_cost?: number | null
          id?: string
          keeper?: boolean
          overall_pick: number
          pick_in_round: number
          player_id?: string | null
          round: number
          season_id: string
          team_id: string
        }
        Update: {
          auction_cost?: number | null
          id?: string
          keeper?: boolean
          overall_pick?: number
          pick_in_round?: number
          player_id?: string | null
          round?: number
          season_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "draft_picks_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_picks_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_picks_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      franchises: {
        Row: {
          created_at: string
          display_name: string
          espn_owner_ids: string[]
          founded_year: number | null
          id: string
          is_active: boolean
          league_id: string
          notes: string | null
          og_manager: boolean
          owner_user_id: string | null
          retired_season: number | null
          status: string
        }
        Insert: {
          created_at?: string
          display_name: string
          espn_owner_ids?: string[]
          founded_year?: number | null
          id?: string
          is_active?: boolean
          league_id: string
          notes?: string | null
          og_manager?: boolean
          owner_user_id?: string | null
          retired_season?: number | null
          status?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          espn_owner_ids?: string[]
          founded_year?: number | null
          id?: string
          is_active?: boolean
          league_id?: string
          notes?: string | null
          og_manager?: boolean
          owner_user_id?: string | null
          retired_season?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "franchises_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      leagues: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      lineup_entries: {
        Row: {
          id: string
          is_starter: boolean
          player_id: string
          points: number | null
          slot_code: string
          team_id: string
          week: number
        }
        Insert: {
          id?: string
          is_starter: boolean
          player_id: string
          points?: number | null
          slot_code: string
          team_id: string
          week: number
        }
        Update: {
          id?: string
          is_starter?: boolean
          player_id?: string
          points?: number | null
          slot_code?: string
          team_id?: string
          week?: number
        }
        Relationships: [
          {
            foreignKeyName: "lineup_entries_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineup_entries_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      matchups: {
        Row: {
          away_score: number | null
          away_team_id: string
          home_score: number | null
          home_team_id: string
          id: string
          is_championship: boolean
          is_final: boolean
          is_playoff: boolean
          playoff_bracket: string | null
          season_id: string
          week: number
        }
        Insert: {
          away_score?: number | null
          away_team_id: string
          home_score?: number | null
          home_team_id: string
          id?: string
          is_championship?: boolean
          is_final?: boolean
          is_playoff?: boolean
          playoff_bracket?: string | null
          season_id: string
          week: number
        }
        Update: {
          away_score?: number | null
          away_team_id?: string
          home_score?: number | null
          home_team_id?: string
          id?: string
          is_championship?: boolean
          is_final?: boolean
          is_playoff?: boolean
          playoff_bracket?: string | null
          season_id?: string
          week?: number
        }
        Relationships: [
          {
            foreignKeyName: "matchups_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchups_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchups_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      player_external_ids: {
        Row: {
          external_id: string
          player_id: string
          provider: string
        }
        Insert: {
          external_id: string
          player_id: string
          provider: string
        }
        Update: {
          external_id?: string
          player_id?: string
          provider?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_external_ids_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          created_at: string
          full_name: string
          id: string
          nfl_team: string | null
          position: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          nfl_team?: string | null
          position: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          nfl_team?: string | null
          position?: string
        }
        Relationships: []
      }
      record_definitions: {
        Row: {
          description: string | null
          direction: string
          id: string
          is_featured: boolean
          key: string
          league_id: string
          query_name: string
          scope: string
          sort_order: number
          title: string
        }
        Insert: {
          description?: string | null
          direction?: string
          id?: string
          is_featured?: boolean
          key: string
          league_id: string
          query_name: string
          scope: string
          sort_order?: number
          title: string
        }
        Update: {
          description?: string | null
          direction?: string
          id?: string
          is_featured?: boolean
          key?: string
          league_id?: string
          query_name?: string
          scope?: string
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "record_definitions_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      record_results: {
        Row: {
          computed_at: string
          context: Json
          franchise_id: string
          id: string
          is_playoff: boolean
          record_definition_id: string
          scope: string
          season_year: number | null
          value: number
        }
        Insert: {
          computed_at?: string
          context?: Json
          franchise_id: string
          id?: string
          is_playoff?: boolean
          record_definition_id: string
          scope: string
          season_year?: number | null
          value: number
        }
        Update: {
          computed_at?: string
          context?: Json
          franchise_id?: string
          id?: string
          is_playoff?: boolean
          record_definition_id?: string
          scope?: string
          season_year?: number | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "record_results_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_results_record_definition_id_fkey"
            columns: ["record_definition_id"]
            isOneToOne: false
            referencedRelation: "record_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      roster_slots: {
        Row: {
          count: number
          eligible_positions: string[]
          id: string
          is_starting_slot: boolean
          season_id: string
          slot_code: string
          sort_order: number
        }
        Insert: {
          count: number
          eligible_positions: string[]
          id?: string
          is_starting_slot?: boolean
          season_id: string
          slot_code: string
          sort_order?: number
        }
        Update: {
          count?: number
          eligible_positions?: string[]
          id?: string
          is_starting_slot?: boolean
          season_id?: string
          slot_code?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "roster_slots_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      scoring_rules: {
        Row: {
          flat_bonus: number
          id: string
          max_value: number | null
          min_value: number | null
          points_per_unit: number
          position_filter: string[] | null
          season_id: string
          sort_order: number
          stat_key: string
        }
        Insert: {
          flat_bonus?: number
          id?: string
          max_value?: number | null
          min_value?: number | null
          points_per_unit?: number
          position_filter?: string[] | null
          season_id: string
          sort_order?: number
          stat_key: string
        }
        Update: {
          flat_bonus?: number
          id?: string
          max_value?: number | null
          min_value?: number | null
          points_per_unit?: number
          position_filter?: string[] | null
          season_id?: string
          sort_order?: number
          stat_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "scoring_rules_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scoring_rules_stat_key_fkey"
            columns: ["stat_key"]
            isOneToOne: false
            referencedRelation: "stat_categories"
            referencedColumns: ["key"]
          },
        ]
      }
      seasons: {
        Row: {
          created_at: string
          divisions: Json | null
          draft_type: string | null
          espn_league_id: string | null
          id: string
          is_locked: boolean
          keeper_count: number | null
          league_id: string
          playoff_matchup_period_length: number | null
          playoff_teams: number
          regular_weeks: number
          year: number
        }
        Insert: {
          created_at?: string
          divisions?: Json | null
          draft_type?: string | null
          espn_league_id?: string | null
          id?: string
          is_locked?: boolean
          keeper_count?: number | null
          league_id: string
          playoff_matchup_period_length?: number | null
          playoff_teams?: number
          regular_weeks?: number
          year: number
        }
        Update: {
          created_at?: string
          divisions?: Json | null
          draft_type?: string | null
          espn_league_id?: string | null
          id?: string
          is_locked?: boolean
          keeper_count?: number | null
          league_id?: string
          playoff_matchup_period_length?: number | null
          playoff_teams?: number
          regular_weeks?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "seasons_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      stat_categories: {
        Row: {
          applies_to: string[]
          display_name: string
          key: string
          unit: string | null
        }
        Insert: {
          applies_to: string[]
          display_name: string
          key: string
          unit?: string | null
        }
        Update: {
          applies_to?: string[]
          display_name?: string
          key?: string
          unit?: string | null
        }
        Relationships: []
      }
      stat_lines: {
        Row: {
          id: number
          player_id: string
          source: string
          stat_key: string
          updated_at: string
          value: number
          week: number
          year: number
        }
        Insert: {
          id?: number
          player_id: string
          source: string
          stat_key: string
          updated_at?: string
          value: number
          week: number
          year: number
        }
        Update: {
          id?: number
          player_id?: string
          source?: string
          stat_key?: string
          updated_at?: string
          value?: number
          week?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "stat_lines_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stat_lines_stat_key_fkey"
            columns: ["stat_key"]
            isOneToOne: false
            referencedRelation: "stat_categories"
            referencedColumns: ["key"]
          },
        ]
      }
      sync_runs: {
        Row: {
          finished_at: string | null
          id: number
          message: string | null
          provider: string
          scope: string
          season_id: string | null
          started_at: string
          status: string
          week: number | null
        }
        Insert: {
          finished_at?: string | null
          id?: number
          message?: string | null
          provider: string
          scope: string
          season_id?: string | null
          started_at?: string
          status: string
          week?: number | null
        }
        Update: {
          finished_at?: string | null
          id?: number
          message?: string | null
          provider?: string
          scope?: string
          season_id?: string | null
          started_at?: string
          status?: string
          week?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_runs_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          abbreviation: string | null
          draft_slot: number | null
          espn_team_id: string | null
          final_rank: number | null
          franchise_id: string
          id: string
          logo_url: string | null
          losses: number | null
          name: string
          playoff_seed: number | null
          points_against: number | null
          points_for: number | null
          season_id: string
          ties: number
          wins: number | null
        }
        Insert: {
          abbreviation?: string | null
          draft_slot?: number | null
          espn_team_id?: string | null
          final_rank?: number | null
          franchise_id: string
          id?: string
          logo_url?: string | null
          losses?: number | null
          name: string
          playoff_seed?: number | null
          points_against?: number | null
          points_for?: number | null
          season_id: string
          ties?: number
          wins?: number | null
        }
        Update: {
          abbreviation?: string | null
          draft_slot?: number | null
          espn_team_id?: string | null
          final_rank?: number | null
          franchise_id?: string
          id?: string
          logo_url?: string | null
          losses?: number | null
          name?: string
          playoff_seed?: number | null
          points_against?: number | null
          points_for?: number | null
          season_id?: string
          ties?: number
          wins?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_grades: {
        Row: {
          computed_at: string
          evaluation_window: string
          id: string
          season_id: string
          started_points: number
          team_id: string
          total_points: number
          trade_id: string
          verdict: string | null
        }
        Insert: {
          computed_at?: string
          evaluation_window: string
          id?: string
          season_id: string
          started_points: number
          team_id: string
          total_points: number
          trade_id: string
          verdict?: string | null
        }
        Update: {
          computed_at?: string
          evaluation_window?: string
          id?: string
          season_id?: string
          started_points?: number
          team_id?: string
          total_points?: number
          trade_id?: string
          verdict?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_grades_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_grades_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          counterparty_team_id: string | null
          details: Json | null
          faab_spent: number | null
          id: string
          occurred_at: string
          season_id: string
          team_id: string | null
          type: string
          week: number | null
        }
        Insert: {
          counterparty_team_id?: string | null
          details?: Json | null
          faab_spent?: number | null
          id?: string
          occurred_at: string
          season_id: string
          team_id?: string | null
          type: string
          week?: number | null
        }
        Update: {
          counterparty_team_id?: string | null
          details?: Json | null
          faab_spent?: number | null
          id?: string
          occurred_at?: string
          season_id?: string
          team_id?: string | null
          type?: string
          week?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_counterparty_team_id_fkey"
            columns: ["counterparty_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
