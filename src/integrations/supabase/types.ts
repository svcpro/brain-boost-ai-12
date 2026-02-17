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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      ai_chat_messages: {
        Row: {
          bookmarked: boolean
          content: string
          created_at: string
          id: string
          language: string | null
          role: string
          user_id: string
          voice_used: boolean | null
        }
        Insert: {
          bookmarked?: boolean
          content: string
          created_at?: string
          id?: string
          language?: string | null
          role: string
          user_id: string
          voice_used?: boolean | null
        }
        Update: {
          bookmarked?: boolean
          content?: string
          created_at?: string
          id?: string
          language?: string | null
          role?: string
          user_id?: string
          voice_used?: boolean | null
        }
        Relationships: []
      }
      ai_recommendations: {
        Row: {
          completed: boolean
          created_at: string
          description: string | null
          id: string
          priority: string
          title: string
          topic_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          description?: string | null
          id?: string
          priority: string
          title: string
          topic_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          description?: string | null
          id?: string
          priority?: string
          title?: string
          topic_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_recommendations_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      api_endpoints: {
        Row: {
          avg_latency_ms: number | null
          category: string
          created_at: string
          description: string | null
          display_name: string
          id: string
          is_enabled: boolean | null
          method: string
          path: string
          rate_limit_per_minute: number | null
          request_schema: Json | null
          requires_auth: boolean | null
          response_schema: Json | null
          total_errors: number | null
          total_requests: number | null
          updated_at: string
          version: string | null
        }
        Insert: {
          avg_latency_ms?: number | null
          category?: string
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          is_enabled?: boolean | null
          method?: string
          path: string
          rate_limit_per_minute?: number | null
          request_schema?: Json | null
          requires_auth?: boolean | null
          response_schema?: Json | null
          total_errors?: number | null
          total_requests?: number | null
          updated_at?: string
          version?: string | null
        }
        Update: {
          avg_latency_ms?: number | null
          category?: string
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          is_enabled?: boolean | null
          method?: string
          path?: string
          rate_limit_per_minute?: number | null
          request_schema?: Json | null
          requires_auth?: boolean | null
          response_schema?: Json | null
          total_errors?: number | null
          total_requests?: number | null
          updated_at?: string
          version?: string | null
        }
        Relationships: []
      }
      api_integrations: {
        Row: {
          api_key_masked: string | null
          category: string
          config: Json
          created_at: string
          description: string | null
          display_name: string
          id: string
          is_enabled: boolean
          key_last_updated_at: string | null
          monthly_cost_estimate: number | null
          monthly_usage_count: number | null
          notes: string | null
          service_name: string
          status: string
          updated_at: string
          usage_limit: number | null
          usage_reset_at: string | null
        }
        Insert: {
          api_key_masked?: string | null
          category?: string
          config?: Json
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          is_enabled?: boolean
          key_last_updated_at?: string | null
          monthly_cost_estimate?: number | null
          monthly_usage_count?: number | null
          notes?: string | null
          service_name: string
          status?: string
          updated_at?: string
          usage_limit?: number | null
          usage_reset_at?: string | null
        }
        Update: {
          api_key_masked?: string | null
          category?: string
          config?: Json
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          is_enabled?: boolean
          key_last_updated_at?: string | null
          monthly_cost_estimate?: number | null
          monthly_usage_count?: number | null
          notes?: string | null
          service_name?: string
          status?: string
          updated_at?: string
          usage_limit?: number | null
          usage_reset_at?: string | null
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          created_by: string
          environment: string
          expires_at: string | null
          id: string
          is_active: boolean | null
          key_hash: string
          key_prefix: string
          key_type: string
          last_used_at: string | null
          name: string
          notes: string | null
          permissions: string[]
          rate_limit_per_minute: number | null
          updated_at: string
          usage_count: number | null
          usage_limit: number | null
        }
        Insert: {
          created_at?: string
          created_by: string
          environment?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash: string
          key_prefix: string
          key_type?: string
          last_used_at?: string | null
          name: string
          notes?: string | null
          permissions?: string[]
          rate_limit_per_minute?: number | null
          updated_at?: string
          usage_count?: number | null
          usage_limit?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string
          environment?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash?: string
          key_prefix?: string
          key_type?: string
          last_used_at?: string | null
          name?: string
          notes?: string | null
          permissions?: string[]
          rate_limit_per_minute?: number | null
          updated_at?: string
          usage_count?: number | null
          usage_limit?: number | null
        }
        Relationships: []
      }
      api_rate_limits: {
        Row: {
          burst_limit: number | null
          created_at: string
          id: string
          is_active: boolean | null
          requests_per_day: number | null
          requests_per_hour: number | null
          requests_per_minute: number
          target_id: string | null
          target_type: string
          updated_at: string
        }
        Insert: {
          burst_limit?: number | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          requests_per_day?: number | null
          requests_per_hour?: number | null
          requests_per_minute?: number
          target_id?: string | null
          target_type: string
          updated_at?: string
        }
        Update: {
          burst_limit?: number | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          requests_per_day?: number | null
          requests_per_hour?: number | null
          requests_per_minute?: number
          target_id?: string | null
          target_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      api_request_logs: {
        Row: {
          api_key_id: string | null
          created_at: string
          endpoint_id: string | null
          error_message: string | null
          id: string
          ip_address: string | null
          latency_ms: number | null
          method: string
          path: string
          request_size_bytes: number | null
          response_size_bytes: number | null
          status_code: number
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          endpoint_id?: string | null
          error_message?: string | null
          id?: string
          ip_address?: string | null
          latency_ms?: number | null
          method: string
          path: string
          request_size_bytes?: number | null
          response_size_bytes?: number | null
          status_code: number
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          endpoint_id?: string | null
          error_message?: string | null
          id?: string
          ip_address?: string | null
          latency_ms?: number | null
          method?: string
          path?: string
          request_size_bytes?: number | null
          response_size_bytes?: number | null
          status_code?: number
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_request_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_request_logs_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "api_endpoints"
            referencedColumns: ["id"]
          },
        ]
      }
      brain_missions: {
        Row: {
          completed_at: string | null
          created_at: string
          current_value: number | null
          description: string | null
          expires_at: string | null
          id: string
          mission_type: string
          priority: string
          reasoning: string | null
          reward_type: string | null
          reward_value: number | null
          status: string
          target_metric: string | null
          target_topic_id: string | null
          target_value: number | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_value?: number | null
          description?: string | null
          expires_at?: string | null
          id?: string
          mission_type?: string
          priority?: string
          reasoning?: string | null
          reward_type?: string | null
          reward_value?: number | null
          status?: string
          target_metric?: string | null
          target_topic_id?: string | null
          target_value?: number | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_value?: number | null
          description?: string | null
          expires_at?: string | null
          id?: string
          mission_type?: string
          priority?: string
          reasoning?: string | null
          reward_type?: string | null
          reward_value?: number | null
          status?: string
          target_metric?: string | null
          target_topic_id?: string | null
          target_value?: number | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brain_missions_target_topic_id_fkey"
            columns: ["target_topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      brain_reports: {
        Row: {
          created_at: string
          id: string
          metrics: Json | null
          report_type: string
          summary: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metrics?: Json | null
          report_type: string
          summary?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metrics?: Json | null
          report_type?: string
          summary?: string | null
          user_id?: string
        }
        Relationships: []
      }
      campaign_recipients: {
        Row: {
          ab_variant: string | null
          campaign_id: string
          clicked_at: string | null
          created_at: string
          delivered_at: string | null
          error_message: string | null
          id: string
          opened_at: string | null
          sent_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          ab_variant?: string | null
          campaign_id: string
          clicked_at?: string | null
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          opened_at?: string | null
          sent_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          ab_variant?: string | null
          campaign_id?: string
          clicked_at?: string | null
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          opened_at?: string | null
          sent_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          ab_variants: Json | null
          ab_winner_metric: string | null
          audience_filters: Json | null
          audience_type: string
          audience_user_ids: string[] | null
          body: string | null
          channel: string
          clicked_count: number | null
          created_at: string
          created_by: string
          delivered_count: number | null
          drip_delay_hours: number | null
          drip_sequence_id: string | null
          drip_step_index: number | null
          failed_count: number | null
          html_template: string | null
          id: string
          is_ab_test: boolean | null
          is_drip: boolean | null
          name: string
          opened_count: number | null
          scheduled_at: string | null
          sent_at: string | null
          status: string
          subject: string | null
          title: string | null
          total_recipients: number | null
          updated_at: string
          voice_settings: Json | null
        }
        Insert: {
          ab_variants?: Json | null
          ab_winner_metric?: string | null
          audience_filters?: Json | null
          audience_type?: string
          audience_user_ids?: string[] | null
          body?: string | null
          channel: string
          clicked_count?: number | null
          created_at?: string
          created_by: string
          delivered_count?: number | null
          drip_delay_hours?: number | null
          drip_sequence_id?: string | null
          drip_step_index?: number | null
          failed_count?: number | null
          html_template?: string | null
          id?: string
          is_ab_test?: boolean | null
          is_drip?: boolean | null
          name: string
          opened_count?: number | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          title?: string | null
          total_recipients?: number | null
          updated_at?: string
          voice_settings?: Json | null
        }
        Update: {
          ab_variants?: Json | null
          ab_winner_metric?: string | null
          audience_filters?: Json | null
          audience_type?: string
          audience_user_ids?: string[] | null
          body?: string | null
          channel?: string
          clicked_count?: number | null
          created_at?: string
          created_by?: string
          delivered_count?: number | null
          drip_delay_hours?: number | null
          drip_sequence_id?: string | null
          drip_step_index?: number | null
          failed_count?: number | null
          html_template?: string | null
          id?: string
          is_ab_test?: boolean | null
          is_drip?: boolean | null
          name?: string
          opened_count?: number | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          title?: string | null
          total_recipients?: number | null
          updated_at?: string
          voice_settings?: Json | null
        }
        Relationships: []
      }
      chat_admin_config: {
        Row: {
          active_model: string
          cost_per_request: number
          global_chat_enabled: boolean
          global_daily_limit: number
          id: string
          max_conversation_history: number
          max_tokens: number
          response_timeout_seconds: number
          system_prompt_override: string | null
          temperature: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active_model?: string
          cost_per_request?: number
          global_chat_enabled?: boolean
          global_daily_limit?: number
          id?: string
          max_conversation_history?: number
          max_tokens?: number
          response_timeout_seconds?: number
          system_prompt_override?: string | null
          temperature?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active_model?: string
          cost_per_request?: number
          global_chat_enabled?: boolean
          global_daily_limit?: number
          id?: string
          max_conversation_history?: number
          max_tokens?: number
          response_timeout_seconds?: number
          system_prompt_override?: string | null
          temperature?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      chat_usage_logs: {
        Row: {
          created_at: string
          error_message: string | null
          estimated_cost: number | null
          id: string
          latency_ms: number | null
          model_used: string
          status: string
          tokens_input: number | null
          tokens_output: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          estimated_cost?: number | null
          id?: string
          latency_ms?: number | null
          model_used: string
          status?: string
          tokens_input?: number | null
          tokens_output?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          estimated_cost?: number | null
          id?: string
          latency_ms?: number | null
          model_used?: string
          status?: string
          tokens_input?: number | null
          tokens_output?: number | null
          user_id?: string
        }
        Relationships: []
      }
      cognitive_twins: {
        Row: {
          avg_decay_rate: number | null
          avg_learning_speed: number | null
          brain_evolution_score: number | null
          cognitive_capacity_score: number | null
          computed_at: string
          created_at: string
          fatigue_threshold_minutes: number | null
          id: string
          learning_efficiency_score: number | null
          memory_growth_rate: number | null
          optimal_session_duration: number | null
          optimal_study_hour: number | null
          recall_pattern_type: string | null
          topic_models: Json
          twin_version: number | null
          user_id: string
        }
        Insert: {
          avg_decay_rate?: number | null
          avg_learning_speed?: number | null
          brain_evolution_score?: number | null
          cognitive_capacity_score?: number | null
          computed_at?: string
          created_at?: string
          fatigue_threshold_minutes?: number | null
          id?: string
          learning_efficiency_score?: number | null
          memory_growth_rate?: number | null
          optimal_session_duration?: number | null
          optimal_study_hour?: number | null
          recall_pattern_type?: string | null
          topic_models?: Json
          twin_version?: number | null
          user_id: string
        }
        Update: {
          avg_decay_rate?: number | null
          avg_learning_speed?: number | null
          brain_evolution_score?: number | null
          cognitive_capacity_score?: number | null
          computed_at?: string
          created_at?: string
          fatigue_threshold_minutes?: number | null
          id?: string
          learning_efficiency_score?: number | null
          memory_growth_rate?: number | null
          optimal_session_duration?: number | null
          optimal_study_hour?: number | null
          recall_pattern_type?: string | null
          topic_models?: Json
          twin_version?: number | null
          user_id?: string
        }
        Relationships: []
      }
      communities: {
        Row: {
          banner_url: string | null
          category: string
          created_at: string
          created_by: string
          description: string | null
          exam_type: string | null
          icon_url: string | null
          id: string
          is_active: boolean
          is_approved: boolean
          member_count: number
          name: string
          post_count: number
          rules: Json | null
          slug: string
          subject: string | null
          trending_score: number | null
          updated_at: string
          weekly_active_users: number | null
        }
        Insert: {
          banner_url?: string | null
          category?: string
          created_at?: string
          created_by: string
          description?: string | null
          exam_type?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          is_approved?: boolean
          member_count?: number
          name: string
          post_count?: number
          rules?: Json | null
          slug: string
          subject?: string | null
          trending_score?: number | null
          updated_at?: string
          weekly_active_users?: number | null
        }
        Update: {
          banner_url?: string | null
          category?: string
          created_at?: string
          created_by?: string
          description?: string | null
          exam_type?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          is_approved?: boolean
          member_count?: number
          name?: string
          post_count?: number
          rules?: Json | null
          slug?: string
          subject?: string | null
          trending_score?: number | null
          updated_at?: string
          weekly_active_users?: number | null
        }
        Relationships: []
      }
      community_members: {
        Row: {
          community_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          community_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          community_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_members_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          ai_answer: string | null
          ai_answered_at: string | null
          ai_detailed_summary: string | null
          ai_key_insights: Json | null
          ai_key_points: Json | null
          ai_quality_score: number | null
          ai_summary: string | null
          ai_tags: string[] | null
          bookmark_count: number | null
          comment_count: number
          community_id: string
          content: string
          created_at: string
          hot_score: number | null
          id: string
          image_urls: string[] | null
          importance_level: string | null
          importance_score: number | null
          is_best_answer: boolean | null
          is_deleted: boolean
          is_pinned: boolean
          post_type: string
          reaction_counts: Json | null
          share_count: number | null
          summary_updated_at: string | null
          title: string
          updated_at: string
          upvote_count: number
          user_id: string
          view_count: number
        }
        Insert: {
          ai_answer?: string | null
          ai_answered_at?: string | null
          ai_detailed_summary?: string | null
          ai_key_insights?: Json | null
          ai_key_points?: Json | null
          ai_quality_score?: number | null
          ai_summary?: string | null
          ai_tags?: string[] | null
          bookmark_count?: number | null
          comment_count?: number
          community_id: string
          content: string
          created_at?: string
          hot_score?: number | null
          id?: string
          image_urls?: string[] | null
          importance_level?: string | null
          importance_score?: number | null
          is_best_answer?: boolean | null
          is_deleted?: boolean
          is_pinned?: boolean
          post_type?: string
          reaction_counts?: Json | null
          share_count?: number | null
          summary_updated_at?: string | null
          title: string
          updated_at?: string
          upvote_count?: number
          user_id: string
          view_count?: number
        }
        Update: {
          ai_answer?: string | null
          ai_answered_at?: string | null
          ai_detailed_summary?: string | null
          ai_key_insights?: Json | null
          ai_key_points?: Json | null
          ai_quality_score?: number | null
          ai_summary?: string | null
          ai_tags?: string[] | null
          bookmark_count?: number | null
          comment_count?: number
          community_id?: string
          content?: string
          created_at?: string
          hot_score?: number | null
          id?: string
          image_urls?: string[] | null
          importance_level?: string | null
          importance_score?: number | null
          is_best_answer?: boolean | null
          is_deleted?: boolean
          is_pinned?: boolean
          post_type?: string
          reaction_counts?: Json | null
          share_count?: number | null
          summary_updated_at?: string | null
          title?: string
          updated_at?: string
          upvote_count?: number
          user_id?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      content_flags: {
        Row: {
          abuse_score: number
          ai_reasoning: string | null
          auto_hidden: boolean
          categories: string[] | null
          content_id: string
          content_type: string
          created_at: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          risk_level: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          abuse_score?: number
          ai_reasoning?: string | null
          auto_hidden?: boolean
          categories?: string[] | null
          content_id: string
          content_type: string
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_level?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          abuse_score?: number
          ai_reasoning?: string | null
          auto_hidden?: boolean
          categories?: string[] | null
          content_id?: string
          content_type?: string
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_level?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      discussion_recommendations: {
        Row: {
          created_at: string
          id: string
          post_id: string
          reason: string | null
          relevance_score: number | null
          seen: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          reason?: string | null
          relevance_score?: number | null
          seen?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          reason?: string | null
          relevance_score?: number | null
          seen?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discussion_recommendations_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      drip_sequences: {
        Row: {
          channel: string
          completed_count: number | null
          created_at: string
          created_by: string
          id: string
          name: string
          status: string
          steps: Json
          total_enrolled: number | null
          trigger_event: string
          updated_at: string
        }
        Insert: {
          channel: string
          completed_count?: number | null
          created_at?: string
          created_by: string
          id?: string
          name: string
          status?: string
          steps?: Json
          total_enrolled?: number | null
          trigger_event?: string
          updated_at?: string
        }
        Update: {
          channel?: string
          completed_count?: number | null
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          status?: string
          steps?: Json
          total_enrolled?: number | null
          trigger_event?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          bounced_at: string | null
          clicked_at: string | null
          created_at: string
          delivered_at: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          opened_at: string | null
          status: string
          subject: string
          template_id: string | null
          to_email: string
          trigger_key: string
          user_id: string
        }
        Insert: {
          bounced_at?: string | null
          clicked_at?: string | null
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          opened_at?: string | null
          status?: string
          subject: string
          template_id?: string | null
          to_email: string
          trigger_key: string
          user_id: string
        }
        Update: {
          bounced_at?: string | null
          clicked_at?: string | null
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          opened_at?: string | null
          status?: string
          subject?: string
          template_id?: string | null
          to_email?: string
          trigger_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_queue: {
        Row: {
          created_at: string
          error_message: string | null
          html_body: string
          id: string
          max_retries: number
          priority: string
          retry_count: number
          scheduled_at: string
          sent_at: string | null
          status: string
          subject: string
          template_id: string | null
          to_email: string
          trigger_key: string
          updated_at: string
          user_id: string
          variables: Json
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          html_body: string
          id?: string
          max_retries?: number
          priority?: string
          retry_count?: number
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          subject: string
          template_id?: string | null
          to_email: string
          trigger_key: string
          updated_at?: string
          user_id: string
          variables?: Json
        }
        Update: {
          created_at?: string
          error_message?: string | null
          html_body?: string
          id?: string
          max_retries?: number
          priority?: string
          retry_count?: number
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          subject?: string
          template_id?: string | null
          to_email?: string
          trigger_key?: string
          updated_at?: string
          user_id?: string
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "email_queue_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          category: string | null
          created_at: string
          created_by: string
          html_body: string
          id: string
          is_active: boolean | null
          name: string
          subject: string
          updated_at: string
          variables: string[] | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by: string
          html_body: string
          id?: string
          is_active?: boolean | null
          name: string
          subject: string
          updated_at?: string
          variables?: string[] | null
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string
          html_body?: string
          id?: string
          is_active?: boolean | null
          name?: string
          subject?: string
          updated_at?: string
          variables?: string[] | null
        }
        Relationships: []
      }
      email_triggers: {
        Row: {
          category: string
          conditions: Json
          cooldown_hours: number | null
          created_at: string
          description: string | null
          display_name: string
          id: string
          is_enabled: boolean
          priority: string
          template_id: string | null
          trigger_key: string
          updated_at: string
        }
        Insert: {
          category?: string
          conditions?: Json
          cooldown_hours?: number | null
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          is_enabled?: boolean
          priority?: string
          template_id?: string | null
          trigger_key: string
          updated_at?: string
        }
        Update: {
          category?: string
          conditions?: Json
          cooldown_hours?: number | null
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          is_enabled?: boolean
          priority?: string
          template_id?: string | null
          trigger_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_triggers_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_results: {
        Row: {
          created_at: string
          difficulty: string
          id: string
          questions_data: Json | null
          score: number
          time_used_seconds: number | null
          topics: string | null
          total_questions: number
          user_id: string
        }
        Insert: {
          created_at?: string
          difficulty?: string
          id?: string
          questions_data?: Json | null
          score: number
          time_used_seconds?: number | null
          topics?: string | null
          total_questions: number
          user_id: string
        }
        Update: {
          created_at?: string
          difficulty?: string
          id?: string
          questions_data?: Json | null
          score?: number
          time_used_seconds?: number | null
          topics?: string | null
          total_questions?: number
          user_id?: string
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          enabled: boolean
          flag_key: string
          id: string
          label: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled?: boolean
          flag_key: string
          id?: string
          label?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled?: boolean
          flag_key?: string
          id?: string
          label?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      freeze_gifts: {
        Row: {
          created_at: string
          freeze_id: string
          id: string
          recipient_id: string
          resolved_at: string | null
          sender_id: string
          status: string
        }
        Insert: {
          created_at?: string
          freeze_id: string
          id?: string
          recipient_id: string
          resolved_at?: string | null
          sender_id: string
          status?: string
        }
        Update: {
          created_at?: string
          freeze_id?: string
          id?: string
          recipient_id?: string
          resolved_at?: string | null
          sender_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "freeze_gifts_freeze_id_fkey"
            columns: ["freeze_id"]
            isOneToOne: false
            referencedRelation: "streak_freezes"
            referencedColumns: ["id"]
          },
        ]
      }
      global_learning_patterns: {
        Row: {
          created_at: string
          id: string
          metrics: Json
          pattern_date: string
          pattern_key: string
          pattern_type: string
          sample_size: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          metrics?: Json
          pattern_date?: string
          pattern_key: string
          pattern_type: string
          sample_size?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          metrics?: Json
          pattern_date?: string
          pattern_key?: string
          pattern_type?: string
          sample_size?: number
          updated_at?: string
        }
        Relationships: []
      }
      hybrid_predictions: {
        Row: {
          computed_at: string
          confidence: number | null
          created_at: string
          global_score: number | null
          global_weight: number | null
          hybrid_score: number | null
          id: string
          metadata: Json | null
          personal_score: number | null
          personal_weight: number | null
          prediction_type: string
          user_id: string
        }
        Insert: {
          computed_at?: string
          confidence?: number | null
          created_at?: string
          global_score?: number | null
          global_weight?: number | null
          hybrid_score?: number | null
          id?: string
          metadata?: Json | null
          personal_score?: number | null
          personal_weight?: number | null
          prediction_type: string
          user_id: string
        }
        Update: {
          computed_at?: string
          confidence?: number | null
          created_at?: string
          global_score?: number | null
          global_weight?: number | null
          hybrid_score?: number | null
          id?: string
          metadata?: Json | null
          personal_score?: number | null
          personal_weight?: number | null
          prediction_type?: string
          user_id?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          assigned_to: string | null
          created_at: string
          exam_count: number | null
          follow_up_at: string | null
          id: string
          last_active_at: string | null
          notes: Json | null
          score: number
          stage: string
          streak_days: number | null
          study_hours_7d: number | null
          subscription_plan: string | null
          tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          exam_count?: number | null
          follow_up_at?: string | null
          id?: string
          last_active_at?: string | null
          notes?: Json | null
          score?: number
          stage?: string
          streak_days?: number | null
          study_hours_7d?: number | null
          subscription_plan?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          exam_count?: number | null
          follow_up_at?: string | null
          id?: string
          last_active_at?: string | null
          notes?: Json | null
          score?: number
          stage?: string
          streak_days?: number | null
          study_hours_7d?: number | null
          subscription_plan?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_simulations: {
        Row: {
          confidence: number | null
          created_at: string
          id: string
          input_params: Json
          predicted_rank_change: number | null
          predicted_retention: number | null
          scenario_type: string
          simulation_result: Json
          user_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          id?: string
          input_params?: Json
          predicted_rank_change?: number | null
          predicted_retention?: number | null
          scenario_type?: string
          simulation_result?: Json
          user_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          id?: string
          input_params?: Json
          predicted_rank_change?: number | null
          predicted_retention?: number | null
          scenario_type?: string
          simulation_result?: Json
          user_id?: string
        }
        Relationships: []
      }
      memory_scores: {
        Row: {
          id: string
          predicted_drop_date: string | null
          recorded_at: string
          score: number
          topic_id: string
          user_id: string
        }
        Insert: {
          id?: string
          predicted_drop_date?: string | null
          recorded_at?: string
          score: number
          topic_id: string
          user_id: string
        }
        Update: {
          id?: string
          predicted_drop_date?: string | null
          recorded_at?: string
          score?: number
          topic_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memory_scores_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_learning_strategies: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          iteration: number | null
          performance_score: number | null
          strategy_params: Json
          strategy_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          iteration?: number | null
          performance_score?: number | null
          strategy_params?: Json
          strategy_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          iteration?: number | null
          performance_score?: number | null
          strategy_params?: Json
          strategy_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meta_template_submissions: {
        Row: {
          approved_at: string | null
          body_text: string
          button_type: string | null
          buttons: Json | null
          category: string
          created_at: string
          display_name: string
          footer_text: string | null
          header_content: string | null
          header_type: string | null
          id: string
          language: string
          last_synced_at: string | null
          message_sends_24h: number | null
          message_sends_total: number | null
          meta_status: string
          meta_template_id: string | null
          notes: string | null
          quality_score: string | null
          rejected_at: string | null
          rejection_reason: string | null
          sample_values: Json | null
          submitted_at: string | null
          submitted_by: string | null
          tags: string[] | null
          template_name: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          body_text: string
          button_type?: string | null
          buttons?: Json | null
          category?: string
          created_at?: string
          display_name: string
          footer_text?: string | null
          header_content?: string | null
          header_type?: string | null
          id?: string
          language?: string
          last_synced_at?: string | null
          message_sends_24h?: number | null
          message_sends_total?: number | null
          meta_status?: string
          meta_template_id?: string | null
          notes?: string | null
          quality_score?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          sample_values?: Json | null
          submitted_at?: string | null
          submitted_by?: string | null
          tags?: string[] | null
          template_name: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          body_text?: string
          button_type?: string | null
          buttons?: Json | null
          category?: string
          created_at?: string
          display_name?: string
          footer_text?: string | null
          header_content?: string | null
          header_type?: string | null
          id?: string
          language?: string
          last_synced_at?: string | null
          message_sends_24h?: number | null
          message_sends_total?: number | null
          meta_status?: string
          meta_template_id?: string | null
          notes?: string | null
          quality_score?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          sample_values?: Json | null
          submitted_at?: string | null
          submitted_by?: string | null
          tags?: string[] | null
          template_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      ml_events: {
        Row: {
          created_at: string
          event_category: string
          event_type: string
          id: string
          payload: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          event_category: string
          event_type: string
          id?: string
          payload?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          event_category?: string
          event_type?: string
          id?: string
          payload?: Json
          user_id?: string
        }
        Relationships: []
      }
      ml_training_logs: {
        Row: {
          completed_at: string | null
          error_message: string | null
          id: string
          metrics: Json | null
          model_name: string
          model_version: string
          started_at: string
          status: string
          training_data_size: number | null
          training_type: string
          triggered_by: string | null
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          metrics?: Json | null
          model_name: string
          model_version: string
          started_at?: string
          status?: string
          training_data_size?: number | null
          training_type?: string
          triggered_by?: string | null
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          metrics?: Json | null
          model_name?: string
          model_version?: string
          started_at?: string
          status?: string
          training_data_size?: number | null
          training_type?: string
          triggered_by?: string | null
        }
        Relationships: []
      }
      model_metrics: {
        Row: {
          created_at: string
          id: string
          metadata: Json | null
          metric_type: string
          metric_value: number
          model_name: string
          model_version: string
          period_end: string
          period_start: string
          sample_size: number
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          metric_type: string
          metric_value: number
          model_name: string
          model_version?: string
          period_end: string
          period_start: string
          sample_size?: number
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          metric_type?: string
          metric_value?: number
          model_name?: string
          model_version?: string
          period_end?: string
          period_start?: string
          sample_size?: number
        }
        Relationships: []
      }
      model_predictions: {
        Row: {
          actual_outcome: Json | null
          confidence: number | null
          created_at: string
          id: string
          input_features: Json | null
          is_correct: boolean | null
          latency_ms: number | null
          model_name: string
          model_version: string
          prediction: Json
          user_id: string
          validated_at: string | null
        }
        Insert: {
          actual_outcome?: Json | null
          confidence?: number | null
          created_at?: string
          id?: string
          input_features?: Json | null
          is_correct?: boolean | null
          latency_ms?: number | null
          model_name: string
          model_version?: string
          prediction: Json
          user_id: string
          validated_at?: string | null
        }
        Update: {
          actual_outcome?: Json | null
          confidence?: number | null
          created_at?: string
          id?: string
          input_features?: Json | null
          is_correct?: boolean | null
          latency_ms?: number | null
          model_name?: string
          model_version?: string
          prediction?: Json
          user_id?: string
          validated_at?: string | null
        }
        Relationships: []
      }
      model_selections: {
        Row: {
          active_model: string
          candidate_models: Json
          created_at: string
          id: string
          last_evaluated_at: string | null
          model_domain: string
          performance_history: Json
          user_id: string
        }
        Insert: {
          active_model: string
          candidate_models?: Json
          created_at?: string
          id?: string
          last_evaluated_at?: string | null
          model_domain: string
          performance_history?: Json
          user_id: string
        }
        Update: {
          active_model?: string
          candidate_models?: Json
          created_at?: string
          id?: string
          last_evaluated_at?: string | null
          model_domain?: string
          performance_history?: Json
          user_id?: string
        }
        Relationships: []
      }
      moderation_actions: {
        Row: {
          action_type: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          is_automatic: boolean
          reason: string | null
          related_flag_id: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          is_automatic?: boolean
          reason?: string | null
          related_flag_id?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          is_automatic?: boolean
          reason?: string | null
          related_flag_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_actions_related_flag_id_fkey"
            columns: ["related_flag_id"]
            isOneToOne: false
            referencedRelation: "content_flags"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_rules: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          rule_key: string
          rule_type: string
          rule_value: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          rule_key: string
          rule_type: string
          rule_value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          rule_key?: string
          rule_type?: string
          rule_value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      notification_history: {
        Row: {
          body: string | null
          created_at: string
          id: string
          read: boolean
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          read?: boolean
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          read?: boolean
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      plan_feature_gates: {
        Row: {
          created_at: string
          feature_category: string
          feature_key: string
          feature_label: string
          free_enabled: boolean
          id: string
          pro_enabled: boolean
          sort_order: number
          ultra_enabled: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          feature_category?: string
          feature_key: string
          feature_label: string
          free_enabled?: boolean
          id?: string
          pro_enabled?: boolean
          sort_order?: number
          ultra_enabled?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          feature_category?: string
          feature_key?: string
          feature_label?: string
          free_enabled?: boolean
          id?: string
          pro_enabled?: boolean
          sort_order?: number
          ultra_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      plan_quality_logs: {
        Row: {
          created_at: string
          id: string
          overall_completion_rate: number | null
          plan_id: string | null
          rl_signals: Json
          sessions_completed: number | null
          sessions_total: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          overall_completion_rate?: number | null
          plan_id?: string | null
          rl_signals?: Json
          sessions_completed?: number | null
          sessions_total?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          overall_completion_rate?: number | null
          plan_id?: string | null
          rl_signals?: Json
          sessions_completed?: number | null
          sessions_total?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_quality_logs_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "study_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_sessions: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          day_date: string | null
          day_focus: string | null
          day_index: number
          day_name: string
          duration_minutes: number
          id: string
          mode: string
          plan_id: string
          reason: string | null
          subject: string
          topic: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          day_date?: string | null
          day_focus?: string | null
          day_index: number
          day_name: string
          duration_minutes?: number
          id?: string
          mode?: string
          plan_id: string
          reason?: string | null
          subject: string
          topic: string
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          day_date?: string | null
          day_focus?: string | null
          day_index?: number
          day_name?: string
          duration_minutes?: number
          id?: string
          mode?: string
          plan_id?: string
          reason?: string | null
          subject?: string
          topic?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_sessions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "study_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      post_bookmarks: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_bookmarks_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          is_ai_answer: boolean
          is_deleted: boolean
          parent_id: string | null
          post_id: string
          updated_at: string
          upvote_count: number
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_ai_answer?: boolean
          is_deleted?: boolean
          parent_id?: string | null
          post_id: string
          updated_at?: string
          upvote_count?: number
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_ai_answer?: boolean
          is_deleted?: boolean
          parent_id?: string | null
          post_id?: string
          updated_at?: string
          upvote_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reactions: {
        Row: {
          created_at: string
          id: string
          post_id: string
          reaction_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          reaction_type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          reaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_votes: {
        Row: {
          created_at: string
          id: string
          target_id: string
          target_type: string
          user_id: string
          vote_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          target_id: string
          target_type?: string
          user_id: string
          vote_type?: string
        }
        Update: {
          created_at?: string
          id?: string
          target_id?: string
          target_type?: string
          user_id?: string
          vote_type?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          auto_use_streak_freeze: boolean
          avatar_url: string | null
          ban_reason: string | null
          banned_at: string | null
          created_at: string
          daily_study_goal_minutes: number
          display_name: string | null
          email_notifications_enabled: boolean
          email_study_reminders: boolean
          email_weekly_reports: boolean
          exam_date: string | null
          exam_type: string | null
          id: string
          is_banned: boolean
          last_brain_update_at: string | null
          opt_in_leaderboard: boolean
          push_notification_prefs: Json
          study_preferences: Json | null
          updated_at: string
          weekly_focus_goal_minutes: number
          weekly_report_day: number
          weekly_report_hour: number
          whatsapp_number: string | null
          whatsapp_opted_in: boolean | null
        }
        Insert: {
          auto_use_streak_freeze?: boolean
          avatar_url?: string | null
          ban_reason?: string | null
          banned_at?: string | null
          created_at?: string
          daily_study_goal_minutes?: number
          display_name?: string | null
          email_notifications_enabled?: boolean
          email_study_reminders?: boolean
          email_weekly_reports?: boolean
          exam_date?: string | null
          exam_type?: string | null
          id: string
          is_banned?: boolean
          last_brain_update_at?: string | null
          opt_in_leaderboard?: boolean
          push_notification_prefs?: Json
          study_preferences?: Json | null
          updated_at?: string
          weekly_focus_goal_minutes?: number
          weekly_report_day?: number
          weekly_report_hour?: number
          whatsapp_number?: string | null
          whatsapp_opted_in?: boolean | null
        }
        Update: {
          auto_use_streak_freeze?: boolean
          avatar_url?: string | null
          ban_reason?: string | null
          banned_at?: string | null
          created_at?: string
          daily_study_goal_minutes?: number
          display_name?: string | null
          email_notifications_enabled?: boolean
          email_study_reminders?: boolean
          email_weekly_reports?: boolean
          exam_date?: string | null
          exam_type?: string | null
          id?: string
          is_banned?: boolean
          last_brain_update_at?: string | null
          opt_in_leaderboard?: boolean
          push_notification_prefs?: Json
          study_preferences?: Json | null
          updated_at?: string
          weekly_focus_goal_minutes?: number
          weekly_report_day?: number
          weekly_report_hour?: number
          whatsapp_number?: string | null
          whatsapp_opted_in?: boolean | null
        }
        Relationships: []
      }
      push_notification_logs: {
        Row: {
          ai_generated: boolean | null
          body: string | null
          clicked_at: string | null
          created_at: string
          data: Json | null
          delivered_count: number | null
          device_count: number | null
          error_message: string | null
          id: string
          opened_at: string | null
          status: string
          template_id: string | null
          title: string
          trigger_key: string | null
          user_id: string
        }
        Insert: {
          ai_generated?: boolean | null
          body?: string | null
          clicked_at?: string | null
          created_at?: string
          data?: Json | null
          delivered_count?: number | null
          device_count?: number | null
          error_message?: string | null
          id?: string
          opened_at?: string | null
          status?: string
          template_id?: string | null
          title: string
          trigger_key?: string | null
          user_id: string
        }
        Update: {
          ai_generated?: boolean | null
          body?: string | null
          clicked_at?: string | null
          created_at?: string
          data?: Json | null
          delivered_count?: number | null
          device_count?: number | null
          error_message?: string | null
          id?: string
          opened_at?: string | null
          status?: string
          template_id?: string | null
          title?: string
          trigger_key?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_notification_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "push_notification_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      push_notification_queue: {
        Row: {
          body: string
          clicked_at: string | null
          created_at: string
          data: Json | null
          delivered_at: string | null
          error_message: string | null
          id: string
          max_retries: number | null
          opened_at: string | null
          priority: string
          retry_count: number | null
          scheduled_at: string
          sent_at: string | null
          status: string
          template_id: string | null
          title: string
          trigger_key: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          clicked_at?: string | null
          created_at?: string
          data?: Json | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          max_retries?: number | null
          opened_at?: string | null
          priority?: string
          retry_count?: number | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          template_id?: string | null
          title: string
          trigger_key?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          clicked_at?: string | null
          created_at?: string
          data?: Json | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          max_retries?: number | null
          opened_at?: string | null
          priority?: string
          retry_count?: number | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          template_id?: string | null
          title?: string
          trigger_key?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_notification_queue_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "push_notification_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      push_notification_templates: {
        Row: {
          body_template: string
          category: string
          created_at: string
          created_by: string
          icon: string | null
          id: string
          is_active: boolean
          name: string
          priority: string
          title_template: string
          updated_at: string
          use_ai_personalization: boolean
          variables: string[] | null
        }
        Insert: {
          body_template: string
          category?: string
          created_at?: string
          created_by: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          priority?: string
          title_template: string
          updated_at?: string
          use_ai_personalization?: boolean
          variables?: string[] | null
        }
        Update: {
          body_template?: string
          category?: string
          created_at?: string
          created_by?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          priority?: string
          title_template?: string
          updated_at?: string
          use_ai_personalization?: boolean
          variables?: string[] | null
        }
        Relationships: []
      }
      push_notification_triggers: {
        Row: {
          category: string
          conditions: Json
          cooldown_minutes: number | null
          created_at: string
          description: string | null
          display_name: string
          id: string
          is_enabled: boolean
          priority: string
          schedule_config: Json | null
          schedule_type: string
          target_audience: Json
          template_id: string | null
          total_clicked: number | null
          total_opened: number | null
          total_sent: number | null
          trigger_key: string
          updated_at: string
          use_ai_content: boolean
        }
        Insert: {
          category?: string
          conditions?: Json
          cooldown_minutes?: number | null
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          is_enabled?: boolean
          priority?: string
          schedule_config?: Json | null
          schedule_type?: string
          target_audience?: Json
          template_id?: string | null
          total_clicked?: number | null
          total_opened?: number | null
          total_sent?: number | null
          trigger_key: string
          updated_at?: string
          use_ai_content?: boolean
        }
        Update: {
          category?: string
          conditions?: Json
          cooldown_minutes?: number | null
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          is_enabled?: boolean
          priority?: string
          schedule_config?: Json | null
          schedule_type?: string
          target_audience?: Json
          template_id?: string | null
          total_clicked?: number | null
          total_opened?: number | null
          total_sent?: number | null
          trigger_key?: string
          updated_at?: string
          use_ai_content?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "push_notification_triggers_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "push_notification_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      question_performance: {
        Row: {
          correct_index: number
          created_at: string
          explanation: string | null
          id: string
          last_seen_at: string
          last_wrong_at: string | null
          options: Json | null
          question_hash: string
          question_text: string
          times_seen: number
          times_wrong: number
          user_id: string
        }
        Insert: {
          correct_index: number
          created_at?: string
          explanation?: string | null
          id?: string
          last_seen_at?: string
          last_wrong_at?: string | null
          options?: Json | null
          question_hash: string
          question_text: string
          times_seen?: number
          times_wrong?: number
          user_id: string
        }
        Update: {
          correct_index?: number
          created_at?: string
          explanation?: string | null
          id?: string
          last_seen_at?: string
          last_wrong_at?: string | null
          options?: Json | null
          question_hash?: string
          question_text?: string
          times_seen?: number
          times_wrong?: number
          user_id?: string
        }
        Relationships: []
      }
      rank_predictions: {
        Row: {
          factors: Json | null
          id: string
          percentile: number | null
          predicted_rank: number
          recorded_at: string
          user_id: string
        }
        Insert: {
          factors?: Json | null
          id?: string
          percentile?: number | null
          predicted_rank: number
          recorded_at?: string
          user_id: string
        }
        Update: {
          factors?: Json | null
          id?: string
          percentile?: number | null
          predicted_rank?: number
          recorded_at?: string
          user_id?: string
        }
        Relationships: []
      }
      razorpay_config: {
        Row: {
          id: string
          live_key_id: string | null
          live_key_secret: string | null
          mode: string
          test_key_id: string | null
          test_key_secret: string | null
          updated_at: string
          updated_by: string | null
          webhook_secret: string | null
        }
        Insert: {
          id?: string
          live_key_id?: string | null
          live_key_secret?: string | null
          mode?: string
          test_key_id?: string | null
          test_key_secret?: string | null
          updated_at?: string
          updated_by?: string | null
          webhook_secret?: string | null
        }
        Update: {
          id?: string
          live_key_id?: string | null
          live_key_secret?: string | null
          mode?: string
          test_key_id?: string | null
          test_key_secret?: string | null
          updated_at?: string
          updated_by?: string | null
          webhook_secret?: string | null
        }
        Relationships: []
      }
      razorpay_webhook_events: {
        Row: {
          amount: number | null
          created_at: string
          currency: string | null
          error_message: string | null
          event_type: string
          id: string
          order_id: string | null
          payload: Json | null
          payment_id: string | null
          processed: boolean | null
          status: string | null
          subscription_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          order_id?: string | null
          payload?: Json | null
          payment_id?: string | null
          processed?: boolean | null
          status?: string | null
          subscription_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          order_id?: string | null
          payload?: Json | null
          payment_id?: string | null
          processed?: boolean | null
          status?: string | null
          subscription_id?: string | null
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          category: string
          enabled: boolean
          id: string
          permission_key: string
          permission_label: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          category: string
          enabled?: boolean
          id?: string
          permission_key: string
          permission_label: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          category?: string
          enabled?: boolean
          id?: string
          permission_key?: string
          permission_label?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      seo_ai_suggestions: {
        Row: {
          created_at: string
          id: string
          page_id: string | null
          page_url: string
          status: string
          suggested_keywords: string[] | null
          suggested_meta_description: string | null
          suggested_meta_title: string | null
          suggested_schema: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          page_id?: string | null
          page_url: string
          status?: string
          suggested_keywords?: string[] | null
          suggested_meta_description?: string | null
          suggested_meta_title?: string | null
          suggested_schema?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          page_id?: string | null
          page_url?: string
          status?: string
          suggested_keywords?: string[] | null
          suggested_meta_description?: string | null
          suggested_meta_title?: string | null
          suggested_schema?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "seo_ai_suggestions_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "seo_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_analytics: {
        Row: {
          clicks: number
          id: string
          impressions: number
          last_updated: string
          page_url: string
          ranking_position: number | null
        }
        Insert: {
          clicks?: number
          id?: string
          impressions?: number
          last_updated?: string
          page_url: string
          ranking_position?: number | null
        }
        Update: {
          clicks?: number
          id?: string
          impressions?: number
          last_updated?: string
          page_url?: string
          ranking_position?: number | null
        }
        Relationships: []
      }
      seo_keywords: {
        Row: {
          created_at: string
          id: string
          keyword: string
          priority: string
          search_volume: number | null
          target_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          keyword: string
          priority?: string
          search_volume?: number | null
          target_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          keyword?: string
          priority?: string
          search_volume?: number | null
          target_url?: string | null
        }
        Relationships: []
      }
      seo_pages: {
        Row: {
          canonical_url: string | null
          created_at: string
          id: string
          meta_description: string | null
          meta_keywords: string[] | null
          meta_title: string | null
          og_description: string | null
          og_image: string | null
          og_title: string | null
          page_type: string
          page_url: string
          robots_follow: boolean
          robots_index: boolean
          schema_markup_json: Json | null
          seo_score: number | null
          twitter_description: string | null
          twitter_image: string | null
          twitter_title: string | null
          updated_at: string
        }
        Insert: {
          canonical_url?: string | null
          created_at?: string
          id?: string
          meta_description?: string | null
          meta_keywords?: string[] | null
          meta_title?: string | null
          og_description?: string | null
          og_image?: string | null
          og_title?: string | null
          page_type?: string
          page_url: string
          robots_follow?: boolean
          robots_index?: boolean
          schema_markup_json?: Json | null
          seo_score?: number | null
          twitter_description?: string | null
          twitter_image?: string | null
          twitter_title?: string | null
          updated_at?: string
        }
        Update: {
          canonical_url?: string | null
          created_at?: string
          id?: string
          meta_description?: string | null
          meta_keywords?: string[] | null
          meta_title?: string | null
          og_description?: string | null
          og_image?: string | null
          og_title?: string | null
          page_type?: string
          page_url?: string
          robots_follow?: boolean
          robots_index?: boolean
          schema_markup_json?: Json | null
          seo_score?: number | null
          twitter_description?: string | null
          twitter_image?: string | null
          twitter_title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      seo_redirects: {
        Row: {
          created_at: string
          destination_url: string
          id: string
          is_active: boolean
          redirect_type: string
          source_url: string
        }
        Insert: {
          created_at?: string
          destination_url: string
          id?: string
          is_active?: boolean
          redirect_type?: string
          source_url: string
        }
        Update: {
          created_at?: string
          destination_url?: string
          id?: string
          is_active?: boolean
          redirect_type?: string
          source_url?: string
        }
        Relationships: []
      }
      seo_sitemap: {
        Row: {
          change_frequency: string
          id: string
          last_modified: string
          page_url: string
          priority: number
        }
        Insert: {
          change_frequency?: string
          id?: string
          last_modified?: string
          page_url: string
          priority?: number
        }
        Update: {
          change_frequency?: string
          id?: string
          last_modified?: string
          page_url?: string
          priority?: number
        }
        Relationships: []
      }
      streak_freezes: {
        Row: {
          created_at: string
          earned_at: string
          id: string
          used_date: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          earned_at?: string
          id?: string
          used_date?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          earned_at?: string
          id?: string
          used_date?: string | null
          user_id?: string
        }
        Relationships: []
      }
      study_logs: {
        Row: {
          confidence_level: string | null
          created_at: string
          duration_minutes: number
          id: string
          notes: string | null
          study_mode: string | null
          subject_id: string | null
          topic_id: string | null
          user_id: string
        }
        Insert: {
          confidence_level?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          notes?: string | null
          study_mode?: string | null
          subject_id?: string | null
          topic_id?: string | null
          user_id: string
        }
        Update: {
          confidence_level?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          notes?: string | null
          study_mode?: string | null
          subject_id?: string | null
          topic_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_logs_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_logs_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      study_plans: {
        Row: {
          created_at: string
          id: string
          summary: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          summary: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          summary?: string
          user_id?: string
        }
        Relationships: []
      }
      subjects: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          billing_period: string
          created_at: string
          currency: string
          description: string | null
          features: Json
          id: string
          is_active: boolean
          is_popular: boolean
          name: string
          plan_key: string
          price: number
          razorpay_plan_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          billing_period?: string
          created_at?: string
          currency?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          is_popular?: boolean
          name: string
          plan_key: string
          price?: number
          razorpay_plan_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          billing_period?: string
          created_at?: string
          currency?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          is_popular?: boolean
          name?: string
          plan_key?: string
          price?: number
          razorpay_plan_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      topics: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          last_revision_date: string | null
          marks_impact_weight: number | null
          memory_strength: number
          name: string
          next_predicted_drop_date: string | null
          subject_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          last_revision_date?: string | null
          marks_impact_weight?: number | null
          memory_strength?: number
          name: string
          next_predicted_drop_date?: string | null
          subject_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          last_revision_date?: string | null
          marks_impact_weight?: number | null
          memory_strength?: number
          name?: string
          next_predicted_drop_date?: string | null
          subject_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topics_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_chat_limits: {
        Row: {
          chat_enabled: boolean
          created_at: string
          daily_message_limit: number
          estimated_cost: number
          id: string
          last_message_at: string | null
          limit_reset_at: string
          messages_used_today: number
          notes: string | null
          total_messages_sent: number
          total_tokens_used: number
          updated_at: string
          user_id: string
        }
        Insert: {
          chat_enabled?: boolean
          created_at?: string
          daily_message_limit?: number
          estimated_cost?: number
          id?: string
          last_message_at?: string | null
          limit_reset_at?: string
          messages_used_today?: number
          notes?: string | null
          total_messages_sent?: number
          total_tokens_used?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          chat_enabled?: boolean
          created_at?: string
          daily_message_limit?: number
          estimated_cost?: number
          id?: string
          last_message_at?: string | null
          limit_reset_at?: string
          messages_used_today?: number
          notes?: string | null
          total_messages_sent?: number
          total_tokens_used?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_cognitive_embeddings: {
        Row: {
          cluster_id: string | null
          cognitive_fingerprint: string | null
          computed_at: string
          created_at: string
          dimensions: number
          embedding: Json
          embedding_version: number
          feature_labels: Json
          id: string
          similarity_group: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cluster_id?: string | null
          cognitive_fingerprint?: string | null
          computed_at?: string
          created_at?: string
          dimensions?: number
          embedding?: Json
          embedding_version?: number
          feature_labels?: Json
          id?: string
          similarity_group?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cluster_id?: string | null
          cognitive_fingerprint?: string | null
          computed_at?: string
          created_at?: string
          dimensions?: number
          embedding?: Json
          embedding_version?: number
          feature_labels?: Json
          id?: string
          similarity_group?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_features: {
        Row: {
          app_open_frequency: number | null
          avg_revision_frequency: number | null
          avg_session_duration_minutes: number | null
          avg_time_since_revision_hours: number | null
          burnout_risk_score: number | null
          computed_at: string
          consecutive_long_sessions: number | null
          created_at: string
          engagement_score: number | null
          fatigue_indicator: number | null
          hours_studied_last_24h: number | null
          hours_studied_last_7d: number | null
          id: string
          knowledge_stability: number | null
          learning_velocity: number | null
          memory_decay_slope: number | null
          rank_trajectory_slope: number | null
          recall_success_rate: number | null
          response_latency_score: number | null
          study_consistency_score: number | null
          subject_strength_score: number | null
          user_id: string
        }
        Insert: {
          app_open_frequency?: number | null
          avg_revision_frequency?: number | null
          avg_session_duration_minutes?: number | null
          avg_time_since_revision_hours?: number | null
          burnout_risk_score?: number | null
          computed_at?: string
          consecutive_long_sessions?: number | null
          created_at?: string
          engagement_score?: number | null
          fatigue_indicator?: number | null
          hours_studied_last_24h?: number | null
          hours_studied_last_7d?: number | null
          id?: string
          knowledge_stability?: number | null
          learning_velocity?: number | null
          memory_decay_slope?: number | null
          rank_trajectory_slope?: number | null
          recall_success_rate?: number | null
          response_latency_score?: number | null
          study_consistency_score?: number | null
          subject_strength_score?: number | null
          user_id: string
        }
        Update: {
          app_open_frequency?: number | null
          avg_revision_frequency?: number | null
          avg_session_duration_minutes?: number | null
          avg_time_since_revision_hours?: number | null
          burnout_risk_score?: number | null
          computed_at?: string
          consecutive_long_sessions?: number | null
          created_at?: string
          engagement_score?: number | null
          fatigue_indicator?: number | null
          hours_studied_last_24h?: number | null
          hours_studied_last_7d?: number | null
          id?: string
          knowledge_stability?: number | null
          learning_velocity?: number | null
          memory_decay_slope?: number | null
          rank_trajectory_slope?: number | null
          recall_success_rate?: number | null
          response_latency_score?: number | null
          study_consistency_score?: number | null
          subject_strength_score?: number | null
          user_id?: string
        }
        Relationships: []
      }
      user_moderation_profiles: {
        Row: {
          current_penalty: string | null
          id: string
          is_banned: boolean
          is_restricted: boolean
          last_violation_at: string | null
          total_flags: number
          total_violations: number
          total_warnings: number
          updated_at: string
          user_id: string
        }
        Insert: {
          current_penalty?: string | null
          id?: string
          is_banned?: boolean
          is_restricted?: boolean
          last_violation_at?: string | null
          total_flags?: number
          total_violations?: number
          total_warnings?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          current_penalty?: string | null
          id?: string
          is_banned?: boolean
          is_restricted?: boolean
          last_violation_at?: string | null
          total_flags?: number
          total_violations?: number
          total_warnings?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_reputation: {
        Row: {
          answer_score: number
          answers_count: number
          best_answers_count: number
          created_at: string
          id: string
          level: string
          post_score: number
          posts_count: number
          total_score: number
          updated_at: string
          upvote_score: number
          user_id: string
        }
        Insert: {
          answer_score?: number
          answers_count?: number
          best_answers_count?: number
          created_at?: string
          id?: string
          level?: string
          post_score?: number
          posts_count?: number
          total_score?: number
          updated_at?: string
          upvote_score?: number
          user_id: string
        }
        Update: {
          answer_score?: number
          answers_count?: number
          best_answers_count?: number
          created_at?: string
          id?: string
          level?: string
          post_score?: number
          posts_count?: number
          total_score?: number
          updated_at?: string
          upvote_score?: number
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          amount: number | null
          created_at: string
          currency: string | null
          expires_at: string | null
          id: string
          plan_id: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_signature: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          expires_at?: string | null
          id?: string
          plan_id?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          expires_at?: string | null
          id?: string
          plan_id?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          category: string | null
          content: string | null
          created_at: string
          delivered_at: string | null
          direction: string
          error_code: string | null
          error_message: string | null
          id: string
          media_url: string | null
          message_type: string
          read_at: string | null
          status: string
          template_name: string | null
          template_params: Json | null
          to_number: string
          twilio_sid: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          category?: string | null
          content?: string | null
          created_at?: string
          delivered_at?: string | null
          direction?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          media_url?: string | null
          message_type?: string
          read_at?: string | null
          status?: string
          template_name?: string | null
          template_params?: Json | null
          to_number: string
          twilio_sid?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          category?: string | null
          content?: string | null
          created_at?: string
          delivered_at?: string | null
          direction?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          media_url?: string | null
          message_type?: string
          read_at?: string | null
          status?: string
          template_name?: string | null
          template_params?: Json | null
          to_number?: string
          twilio_sid?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          body_template: string
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string
          variables: string[] | null
        }
        Insert: {
          body_template: string
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string
          variables?: string[] | null
        }
        Update: {
          body_template?: string
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
          variables?: string[] | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_freeze_gift: { Args: { gift_id: string }; Returns: undefined }
      has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_api_usage: {
        Args: { p_service_name: string }
        Returns: undefined
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      reset_monthly_api_usage: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "admin"
        | "ai_admin"
        | "support_admin"
        | "finance_admin"
        | "api_admin"
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
  public: {
    Enums: {
      app_role: [
        "super_admin",
        "admin",
        "ai_admin",
        "support_admin",
        "finance_admin",
        "api_admin",
      ],
    },
  },
} as const
