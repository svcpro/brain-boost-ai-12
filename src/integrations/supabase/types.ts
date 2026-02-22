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
      accelerator_enrollments: {
        Row: {
          ai_strategy: string | null
          created_at: string
          daily_schedule: Json | null
          days_completed: number | null
          end_date: string
          high_probability_topics: Json | null
          id: string
          intensity_level: string | null
          progress_percentage: number | null
          start_date: string
          status: string | null
          target_exam_type: string | null
          updated_at: string
          user_id: string
          weak_topics: Json | null
        }
        Insert: {
          ai_strategy?: string | null
          created_at?: string
          daily_schedule?: Json | null
          days_completed?: number | null
          end_date?: string
          high_probability_topics?: Json | null
          id?: string
          intensity_level?: string | null
          progress_percentage?: number | null
          start_date?: string
          status?: string | null
          target_exam_type?: string | null
          updated_at?: string
          user_id: string
          weak_topics?: Json | null
        }
        Update: {
          ai_strategy?: string | null
          created_at?: string
          daily_schedule?: Json | null
          days_completed?: number | null
          end_date?: string
          high_probability_topics?: Json | null
          id?: string
          intensity_level?: string | null
          progress_percentage?: number | null
          start_date?: string
          status?: string | null
          target_exam_type?: string | null
          updated_at?: string
          user_id?: string
          weak_topics?: Json | null
        }
        Relationships: []
      }
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
      ai_recalibration_logs: {
        Row: {
          changes_summary: string | null
          created_at: string
          id: string
          new_profile: Json | null
          old_profile: Json | null
          recalibration_type: string
          triggered_by: string | null
          user_id: string | null
        }
        Insert: {
          changes_summary?: string | null
          created_at?: string
          id?: string
          new_profile?: Json | null
          old_profile?: Json | null
          recalibration_type?: string
          triggered_by?: string | null
          user_id?: string | null
        }
        Update: {
          changes_summary?: string | null
          created_at?: string
          id?: string
          new_profile?: Json | null
          old_profile?: Json | null
          recalibration_type?: string
          triggered_by?: string | null
          user_id?: string | null
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
      autopilot_config: {
        Row: {
          auto_emergency_enabled: boolean
          auto_mock_optimization_enabled: boolean
          auto_mode_switch_enabled: boolean
          auto_schedule_enabled: boolean
          auto_weekly_report_enabled: boolean
          emergency_drop_threshold: number
          emergency_min_memory_strength: number
          id: string
          intensity_level: string
          is_enabled: boolean
          max_daily_auto_sessions: number
          report_channels: string[]
          report_send_day: number
          report_send_hour: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          auto_emergency_enabled?: boolean
          auto_mock_optimization_enabled?: boolean
          auto_mode_switch_enabled?: boolean
          auto_schedule_enabled?: boolean
          auto_weekly_report_enabled?: boolean
          emergency_drop_threshold?: number
          emergency_min_memory_strength?: number
          id?: string
          intensity_level?: string
          is_enabled?: boolean
          max_daily_auto_sessions?: number
          report_channels?: string[]
          report_send_day?: number
          report_send_hour?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          auto_emergency_enabled?: boolean
          auto_mock_optimization_enabled?: boolean
          auto_mode_switch_enabled?: boolean
          auto_schedule_enabled?: boolean
          auto_weekly_report_enabled?: boolean
          emergency_drop_threshold?: number
          emergency_min_memory_strength?: number
          id?: string
          intensity_level?: string
          is_enabled?: boolean
          max_daily_auto_sessions?: number
          report_channels?: string[]
          report_send_day?: number
          report_send_hour?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      autopilot_sessions: {
        Row: {
          completed_sessions: number
          created_at: string
          emergency_topic_id: string | null
          emergency_triggered: boolean
          id: string
          mode_switches: Json | null
          performance_summary: Json | null
          planned_schedule: Json
          session_date: string
          status: string
          total_sessions: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_sessions?: number
          created_at?: string
          emergency_topic_id?: string | null
          emergency_triggered?: boolean
          id?: string
          mode_switches?: Json | null
          performance_summary?: Json | null
          planned_schedule?: Json
          session_date?: string
          status?: string
          total_sessions?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_sessions?: number
          created_at?: string
          emergency_topic_id?: string | null
          emergency_triggered?: boolean
          id?: string
          mode_switches?: Json | null
          performance_summary?: Json | null
          planned_schedule?: Json
          session_date?: string
          status?: string
          total_sessions?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "autopilot_sessions_emergency_topic_id_fkey"
            columns: ["emergency_topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_analytics: {
        Row: {
          active_students: number | null
          avg_memory_strength: number | null
          avg_score: number | null
          batch_id: string
          computed_at: string
          dropout_risk_count: number | null
          id: string
          institution_id: string
          rank_projection: Json | null
          snapshot_date: string
          stability_heatmap: Json | null
          subject_distribution: Json | null
          top_weak_topics: Json | null
        }
        Insert: {
          active_students?: number | null
          avg_memory_strength?: number | null
          avg_score?: number | null
          batch_id: string
          computed_at?: string
          dropout_risk_count?: number | null
          id?: string
          institution_id: string
          rank_projection?: Json | null
          snapshot_date?: string
          stability_heatmap?: Json | null
          subject_distribution?: Json | null
          top_weak_topics?: Json | null
        }
        Update: {
          active_students?: number | null
          avg_memory_strength?: number | null
          avg_score?: number | null
          batch_id?: string
          computed_at?: string
          dropout_risk_count?: number | null
          id?: string
          institution_id?: string
          rank_projection?: Json | null
          snapshot_date?: string
          stability_heatmap?: Json | null
          subject_distribution?: Json | null
          top_weak_topics?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_analytics_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "institution_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_analytics_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_students: {
        Row: {
          batch_id: string
          enrolled_at: string
          id: string
          is_active: boolean | null
          roll_number: string | null
          student_user_id: string
        }
        Insert: {
          batch_id: string
          enrolled_at?: string
          id?: string
          is_active?: boolean | null
          roll_number?: string | null
          student_user_id: string
        }
        Update: {
          batch_id?: string
          enrolled_at?: string
          id?: string
          is_active?: boolean | null
          roll_number?: string | null
          student_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_students_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "institution_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      behavioral_micro_events: {
        Row: {
          adjustment_details: Json | null
          auto_adjustment_applied: string | null
          context: Json | null
          created_at: string
          event_type: string
          id: string
          session_id: string | null
          severity: number | null
          topic_id: string | null
          user_id: string
        }
        Insert: {
          adjustment_details?: Json | null
          auto_adjustment_applied?: string | null
          context?: Json | null
          created_at?: string
          event_type: string
          id?: string
          session_id?: string | null
          severity?: number | null
          topic_id?: string | null
          user_id: string
        }
        Update: {
          adjustment_details?: Json | null
          auto_adjustment_applied?: string | null
          context?: Json | null
          created_at?: string
          event_type?: string
          id?: string
          session_id?: string | null
          severity?: number | null
          topic_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "behavioral_micro_events_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      behavioral_profiles: {
        Row: {
          best_send_day: number | null
          best_send_hour: number | null
          channel_preference: Json | null
          churn_risk_score: number | null
          created_at: string
          dopamine_strategy: string | null
          engagement_score: number | null
          habit_loop_stage: string | null
          id: string
          last_computed_at: string | null
          motivation_type: string | null
          notification_fatigue_score: number | null
          rank_war_eligible: boolean | null
          silence_mode_active: boolean | null
          stress_level: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          best_send_day?: number | null
          best_send_hour?: number | null
          channel_preference?: Json | null
          churn_risk_score?: number | null
          created_at?: string
          dopamine_strategy?: string | null
          engagement_score?: number | null
          habit_loop_stage?: string | null
          id?: string
          last_computed_at?: string | null
          motivation_type?: string | null
          notification_fatigue_score?: number | null
          rank_war_eligible?: boolean | null
          silence_mode_active?: boolean | null
          stress_level?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          best_send_day?: number | null
          best_send_hour?: number | null
          channel_preference?: Json | null
          churn_risk_score?: number | null
          created_at?: string
          dopamine_strategy?: string | null
          engagement_score?: number | null
          habit_loop_stage?: string | null
          id?: string
          last_computed_at?: string | null
          motivation_type?: string | null
          notification_fatigue_score?: number | null
          rank_war_eligible?: boolean | null
          silence_mode_active?: boolean | null
          stress_level?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      ca_autopilot_config: {
        Row: {
          auto_approve_questions: boolean
          categories: string[]
          exam_types: string[]
          fetch_interval_hours: number
          id: string
          is_enabled: boolean
          last_auto_run_at: string | null
          total_auto_runs: number
          total_events_fetched: number
          total_questions_generated: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          auto_approve_questions?: boolean
          categories?: string[]
          exam_types?: string[]
          fetch_interval_hours?: number
          id?: string
          is_enabled?: boolean
          last_auto_run_at?: string | null
          total_auto_runs?: number
          total_events_fetched?: number
          total_questions_generated?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          auto_approve_questions?: boolean
          categories?: string[]
          exam_types?: string[]
          fetch_interval_hours?: number
          id?: string
          is_enabled?: boolean
          last_auto_run_at?: string | null
          total_auto_runs?: number
          total_events_fetched?: number
          total_questions_generated?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ca_entities: {
        Row: {
          created_at: string
          description: string | null
          entity_type: string
          first_seen_at: string | null
          id: string
          last_seen_at: string | null
          metadata: Json | null
          name: string
          occurrence_count: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          entity_type: string
          first_seen_at?: string | null
          id?: string
          last_seen_at?: string | null
          metadata?: Json | null
          name: string
          occurrence_count?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          entity_type?: string
          first_seen_at?: string | null
          id?: string
          last_seen_at?: string | null
          metadata?: Json | null
          name?: string
          occurrence_count?: number | null
        }
        Relationships: []
      }
      ca_event_entities: {
        Row: {
          context_snippet: string | null
          created_at: string
          entity_id: string
          event_id: string
          id: string
          relevance_score: number | null
        }
        Insert: {
          context_snippet?: string | null
          created_at?: string
          entity_id: string
          event_id: string
          id?: string
          relevance_score?: number | null
        }
        Update: {
          context_snippet?: string | null
          created_at?: string
          entity_id?: string
          event_id?: string
          id?: string
          relevance_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ca_event_entities_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "ca_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ca_event_entities_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "ca_events"
            referencedColumns: ["id"]
          },
        ]
      }
      ca_events: {
        Row: {
          ai_analysis: Json | null
          category: string | null
          created_at: string
          entity_count: number | null
          event_date: string | null
          id: string
          importance_score: number | null
          processing_status: string | null
          question_count: number | null
          raw_content: string | null
          source: string | null
          source_name: string | null
          source_url: string | null
          summary: string | null
          syllabus_link_count: number | null
          title: string
          updated_at: string
        }
        Insert: {
          ai_analysis?: Json | null
          category?: string | null
          created_at?: string
          entity_count?: number | null
          event_date?: string | null
          id?: string
          importance_score?: number | null
          processing_status?: string | null
          question_count?: number | null
          raw_content?: string | null
          source?: string | null
          source_name?: string | null
          source_url?: string | null
          summary?: string | null
          syllabus_link_count?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          ai_analysis?: Json | null
          category?: string | null
          created_at?: string
          entity_count?: number | null
          event_date?: string | null
          id?: string
          importance_score?: number | null
          processing_status?: string | null
          question_count?: number | null
          raw_content?: string | null
          source?: string | null
          source_name?: string | null
          source_url?: string | null
          summary?: string | null
          syllabus_link_count?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      ca_generated_questions: {
        Row: {
          cognitive_level: string | null
          correct_answer: string | null
          created_at: string
          difficulty: string | null
          event_id: string
          exam_type: string | null
          explanation: string | null
          id: string
          marks: number | null
          options: Json | null
          question_text: string
          question_type: string
          status: string | null
        }
        Insert: {
          cognitive_level?: string | null
          correct_answer?: string | null
          created_at?: string
          difficulty?: string | null
          event_id: string
          exam_type?: string | null
          explanation?: string | null
          id?: string
          marks?: number | null
          options?: Json | null
          question_text: string
          question_type: string
          status?: string | null
        }
        Update: {
          cognitive_level?: string | null
          correct_answer?: string | null
          created_at?: string
          difficulty?: string | null
          event_id?: string
          exam_type?: string | null
          explanation?: string | null
          id?: string
          marks?: number | null
          options?: Json | null
          question_text?: string
          question_type?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ca_generated_questions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "ca_events"
            referencedColumns: ["id"]
          },
        ]
      }
      ca_graph_edges: {
        Row: {
          created_at: string
          description: string | null
          edge_type: string
          event_id: string
          id: string
          metadata: Json | null
          target_label: string
          target_ref_id: string | null
          weight: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          edge_type: string
          event_id: string
          id?: string
          metadata?: Json | null
          target_label: string
          target_ref_id?: string | null
          weight?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          edge_type?: string
          event_id?: string
          id?: string
          metadata?: Json | null
          target_label?: string
          target_ref_id?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ca_graph_edges_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "ca_events"
            referencedColumns: ["id"]
          },
        ]
      }
      ca_syllabus_links: {
        Row: {
          created_at: string
          event_id: string
          exam_type: string
          id: string
          micro_topic: string
          pattern_details: string | null
          pattern_detected: boolean | null
          relevance_score: number | null
          subject: string
          topic_id: string | null
          tpi_impact: number | null
        }
        Insert: {
          created_at?: string
          event_id: string
          exam_type: string
          id?: string
          micro_topic: string
          pattern_details?: string | null
          pattern_detected?: boolean | null
          relevance_score?: number | null
          subject: string
          topic_id?: string | null
          tpi_impact?: number | null
        }
        Update: {
          created_at?: string
          event_id?: string
          exam_type?: string
          id?: string
          micro_topic?: string
          pattern_details?: string | null
          pattern_detected?: boolean | null
          relevance_score?: number | null
          subject?: string
          topic_id?: string | null
          tpi_impact?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ca_syllabus_links_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "ca_events"
            referencedColumns: ["id"]
          },
        ]
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
      channel_effectiveness: {
        Row: {
          channel: string
          effectiveness_score: number | null
          id: string
          is_disabled: boolean
          last_failed_at: string | null
          last_successful_at: string | null
          total_clicked: number
          total_ignored: number
          total_opened: number
          total_sent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          channel: string
          effectiveness_score?: number | null
          id?: string
          is_disabled?: boolean
          last_failed_at?: string | null
          last_successful_at?: string | null
          total_clicked?: number
          total_ignored?: number
          total_opened?: number
          total_sent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          effectiveness_score?: number | null
          id?: string
          is_disabled?: boolean
          last_failed_at?: string | null
          last_successful_at?: string | null
          total_clicked?: number
          total_ignored?: number
          total_opened?: number
          total_sent?: number
          updated_at?: string
          user_id?: string
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
      churn_predictions: {
        Row: {
          churn_probability: number
          computed_at: string
          created_at: string
          days_until_predicted_churn: number | null
          id: string
          intervention_channels: string[] | null
          interventions_sent: number
          last_intervention_at: string | null
          resolved: boolean
          resolved_at: string | null
          risk_factors: Json | null
          risk_level: string
          user_id: string
        }
        Insert: {
          churn_probability?: number
          computed_at?: string
          created_at?: string
          days_until_predicted_churn?: number | null
          id?: string
          intervention_channels?: string[] | null
          interventions_sent?: number
          last_intervention_at?: string | null
          resolved?: boolean
          resolved_at?: string | null
          risk_factors?: Json | null
          risk_level?: string
          user_id: string
        }
        Update: {
          churn_probability?: number
          computed_at?: string
          created_at?: string
          days_until_predicted_churn?: number | null
          id?: string
          intervention_channels?: string[] | null
          interventions_sent?: number
          last_intervention_at?: string | null
          resolved?: boolean
          resolved_at?: string | null
          risk_factors?: Json | null
          risk_level?: string
          user_id?: string
        }
        Relationships: []
      }
      cognitive_profiles: {
        Row: {
          accuracy_rate: number | null
          avg_answer_speed_ms: number | null
          conceptual_score: number | null
          created_at: string
          id: string
          last_recalibrated_at: string | null
          learning_style: string
          learning_style_confidence: number | null
          memorizer_score: number | null
          speed_accuracy_tradeoff: string | null
          speed_pattern: string | null
          total_answers_analyzed: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accuracy_rate?: number | null
          avg_answer_speed_ms?: number | null
          conceptual_score?: number | null
          created_at?: string
          id?: string
          last_recalibrated_at?: string | null
          learning_style?: string
          learning_style_confidence?: number | null
          memorizer_score?: number | null
          speed_accuracy_tradeoff?: string | null
          speed_pattern?: string | null
          total_answers_analyzed?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accuracy_rate?: number | null
          avg_answer_speed_ms?: number | null
          conceptual_score?: number | null
          created_at?: string
          id?: string
          last_recalibrated_at?: string | null
          learning_style?: string
          learning_style_confidence?: number | null
          memorizer_score?: number | null
          speed_accuracy_tradeoff?: string | null
          speed_pattern?: string | null
          total_answers_analyzed?: number | null
          updated_at?: string
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
      coming_soon_config: {
        Row: {
          auto_redirect_on_launch: boolean
          countdown_enabled: boolean
          email_capture_enabled: boolean
          hero_text: string | null
          id: string
          is_enabled: boolean
          launch_date: string | null
          sub_text: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          auto_redirect_on_launch?: boolean
          countdown_enabled?: boolean
          email_capture_enabled?: boolean
          hero_text?: string | null
          id?: string
          is_enabled?: boolean
          launch_date?: string | null
          sub_text?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          auto_redirect_on_launch?: boolean
          countdown_enabled?: boolean
          email_capture_enabled?: boolean
          hero_text?: string | null
          id?: string
          is_enabled?: boolean
          launch_date?: string | null
          sub_text?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      coming_soon_emails: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
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
      competitive_intel_config: {
        Row: {
          accelerator_enabled: boolean | null
          id: string
          opponent_sim_enabled: boolean | null
          rank_heatmap_enabled: boolean | null
          trend_engine_enabled: boolean | null
          updated_at: string
          updated_by: string | null
          weakness_engine_enabled: boolean | null
        }
        Insert: {
          accelerator_enabled?: boolean | null
          id?: string
          opponent_sim_enabled?: boolean | null
          rank_heatmap_enabled?: boolean | null
          trend_engine_enabled?: boolean | null
          updated_at?: string
          updated_by?: string | null
          weakness_engine_enabled?: boolean | null
        }
        Update: {
          accelerator_enabled?: boolean | null
          id?: string
          opponent_sim_enabled?: boolean | null
          rank_heatmap_enabled?: boolean | null
          trend_engine_enabled?: boolean | null
          updated_at?: string
          updated_by?: string | null
          weakness_engine_enabled?: boolean | null
        }
        Relationships: []
      }
      confidence_events: {
        Row: {
          boost_message: string | null
          consecutive_wrong: number | null
          created_at: string
          event_type: string
          id: string
          rescue_mode_duration_seconds: number | null
          topic_id: string | null
          user_id: string
        }
        Insert: {
          boost_message?: string | null
          consecutive_wrong?: number | null
          created_at?: string
          event_type?: string
          id?: string
          rescue_mode_duration_seconds?: number | null
          topic_id?: string | null
          user_id: string
        }
        Update: {
          boost_message?: string | null
          consecutive_wrong?: number | null
          created_at?: string
          event_type?: string
          id?: string
          rescue_mode_duration_seconds?: number | null
          topic_id?: string | null
          user_id?: string
        }
        Relationships: []
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
      curriculum_shift_events: {
        Row: {
          affected_subject: string | null
          affected_topic: string | null
          auto_recalibrated: boolean | null
          confidence: number | null
          created_at: string
          detected_at: string
          detection_method: string | null
          exam_type: string
          id: string
          new_weight: number | null
          old_weight: number | null
          recalibration_details: Json | null
          shift_type: string
        }
        Insert: {
          affected_subject?: string | null
          affected_topic?: string | null
          auto_recalibrated?: boolean | null
          confidence?: number | null
          created_at?: string
          detected_at?: string
          detection_method?: string | null
          exam_type: string
          id?: string
          new_weight?: number | null
          old_weight?: number | null
          recalibration_details?: Json | null
          shift_type?: string
        }
        Update: {
          affected_subject?: string | null
          affected_topic?: string | null
          auto_recalibrated?: boolean | null
          confidence?: number | null
          created_at?: string
          detected_at?: string
          detection_method?: string | null
          exam_type?: string
          id?: string
          new_weight?: number | null
          old_weight?: number | null
          recalibration_details?: Json | null
          shift_type?: string
        }
        Relationships: []
      }
      device_sessions: {
        Row: {
          created_at: string | null
          device_id: string
          device_name: string | null
          device_type: string | null
          id: string
          ip_address: string | null
          is_current: boolean | null
          last_active_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_id: string
          device_name?: string | null
          device_type?: string | null
          id?: string
          ip_address?: string | null
          is_current?: boolean | null
          last_active_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_id?: string
          device_name?: string | null
          device_type?: string | null
          id?: string
          ip_address?: string | null
          is_current?: boolean | null
          last_active_at?: string | null
          user_agent?: string | null
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
      edge_function_rate_limits: {
        Row: {
          created_at: string
          function_name: string
          id: string
          request_count: number
          user_id: string
          window_start: string
        }
        Insert: {
          created_at?: string
          function_name: string
          id?: string
          request_count?: number
          user_id: string
          window_start?: string
        }
        Update: {
          created_at?: string
          function_name?: string
          id?: string
          request_count?: number
          user_id?: string
          window_start?: string
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
      event_log: {
        Row: {
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          payload: Json | null
          priority: Database["public"]["Enums"]["notification_priority"]
          processed_at: string | null
          source: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          payload?: Json | null
          priority?: Database["public"]["Enums"]["notification_priority"]
          processed_at?: string | null
          source?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
          priority?: Database["public"]["Enums"]["notification_priority"]
          processed_at?: string | null
          source?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      exam_countdown_config: {
        Row: {
          acceleration_lock_message: string | null
          acceleration_locked_modes: string[]
          acceleration_mode_min_days: number
          acceleration_recommended_mode: string | null
          bypass_plan_keys: string[]
          id: string
          is_enabled: boolean
          lockdown_lock_message: string | null
          lockdown_locked_modes: string[]
          lockdown_mode_min_days: number
          lockdown_recommended_mode: string | null
          normal_locked_modes: string[]
          normal_mode_min_days: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          acceleration_lock_message?: string | null
          acceleration_locked_modes?: string[]
          acceleration_mode_min_days?: number
          acceleration_recommended_mode?: string | null
          bypass_plan_keys?: string[]
          id?: string
          is_enabled?: boolean
          lockdown_lock_message?: string | null
          lockdown_locked_modes?: string[]
          lockdown_mode_min_days?: number
          lockdown_recommended_mode?: string | null
          normal_locked_modes?: string[]
          normal_mode_min_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          acceleration_lock_message?: string | null
          acceleration_locked_modes?: string[]
          acceleration_mode_min_days?: number
          acceleration_recommended_mode?: string | null
          bypass_plan_keys?: string[]
          id?: string
          is_enabled?: boolean
          lockdown_lock_message?: string | null
          lockdown_locked_modes?: string[]
          lockdown_mode_min_days?: number
          lockdown_recommended_mode?: string | null
          normal_locked_modes?: string[]
          normal_mode_min_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      exam_countdown_predictions: {
        Row: {
          acceleration_message: string | null
          ai_reasoning: string | null
          computed_at: string
          confidence_score: number | null
          created_at: string
          exam_date: string
          factors: Json | null
          id: string
          lockdown_message: string | null
          locked_modes_acceleration: string[] | null
          locked_modes_lockdown: string[] | null
          predicted_acceleration_days: number
          predicted_lockdown_days: number
          recommended_mode_acceleration: string | null
          recommended_mode_lockdown: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          acceleration_message?: string | null
          ai_reasoning?: string | null
          computed_at?: string
          confidence_score?: number | null
          created_at?: string
          exam_date: string
          factors?: Json | null
          id?: string
          lockdown_message?: string | null
          locked_modes_acceleration?: string[] | null
          locked_modes_lockdown?: string[] | null
          predicted_acceleration_days?: number
          predicted_lockdown_days?: number
          recommended_mode_acceleration?: string | null
          recommended_mode_lockdown?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          acceleration_message?: string | null
          ai_reasoning?: string | null
          computed_at?: string
          confidence_score?: number | null
          created_at?: string
          exam_date?: string
          factors?: Json | null
          id?: string
          lockdown_message?: string | null
          locked_modes_acceleration?: string[] | null
          locked_modes_lockdown?: string[] | null
          predicted_acceleration_days?: number
          predicted_lockdown_days?: number
          recommended_mode_acceleration?: string | null
          recommended_mode_lockdown?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      exam_datasets: {
        Row: {
          created_at: string
          error_message: string | null
          exam_type: string
          file_type: string | null
          file_url: string | null
          id: string
          processed_at: string | null
          processed_patterns: number | null
          status: string | null
          subject: string | null
          total_questions: number | null
          uploaded_by: string
          year: number
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          exam_type: string
          file_type?: string | null
          file_url?: string | null
          id?: string
          processed_at?: string | null
          processed_patterns?: number | null
          status?: string | null
          subject?: string | null
          total_questions?: number | null
          uploaded_by: string
          year: number
        }
        Update: {
          created_at?: string
          error_message?: string | null
          exam_type?: string
          file_type?: string | null
          file_url?: string | null
          id?: string
          processed_at?: string | null
          processed_patterns?: number | null
          status?: string | null
          subject?: string | null
          total_questions?: number | null
          uploaded_by?: string
          year?: number
        }
        Relationships: []
      }
      exam_evolution_patterns: {
        Row: {
          created_at: string
          difficulty_index: number | null
          exam_type: string
          frequency_score: number | null
          id: string
          pattern_metadata: Json | null
          structural_type: string | null
          subject: string
          topic: string
          updated_at: string
          weight_trend: string | null
          year: number
        }
        Insert: {
          created_at?: string
          difficulty_index?: number | null
          exam_type: string
          frequency_score?: number | null
          id?: string
          pattern_metadata?: Json | null
          structural_type?: string | null
          subject: string
          topic: string
          updated_at?: string
          weight_trend?: string | null
          year: number
        }
        Update: {
          created_at?: string
          difficulty_index?: number | null
          exam_type?: string
          frequency_score?: number | null
          id?: string
          pattern_metadata?: Json | null
          structural_type?: string | null
          subject?: string
          topic?: string
          updated_at?: string
          weight_trend?: string | null
          year?: number
        }
        Relationships: []
      }
      exam_evolution_reports: {
        Row: {
          created_at: string
          declining_topics: Json | null
          difficulty_inflation_rate: number | null
          exam_type: string
          full_report: Json | null
          generated_at: string
          id: string
          period_end: number | null
          period_start: number | null
          report_type: string
          rising_topics: Json | null
          shift_alerts: Json | null
          structural_drift_index: number | null
          topic_rotation_score: number | null
        }
        Insert: {
          created_at?: string
          declining_topics?: Json | null
          difficulty_inflation_rate?: number | null
          exam_type: string
          full_report?: Json | null
          generated_at?: string
          id?: string
          period_end?: number | null
          period_start?: number | null
          report_type?: string
          rising_topics?: Json | null
          shift_alerts?: Json | null
          structural_drift_index?: number | null
          topic_rotation_score?: number | null
        }
        Update: {
          created_at?: string
          declining_topics?: Json | null
          difficulty_inflation_rate?: number | null
          exam_type?: string
          full_report?: Json | null
          generated_at?: string
          id?: string
          period_end?: number | null
          period_start?: number | null
          report_type?: string
          rising_topics?: Json | null
          shift_alerts?: Json | null
          structural_drift_index?: number | null
          topic_rotation_score?: number | null
        }
        Relationships: []
      }
      exam_intel_alerts: {
        Row: {
          alert_type: string
          created_at: string
          exam_type: string
          id: string
          is_pushed: boolean | null
          is_read: boolean | null
          message: string
          new_score: number | null
          old_score: number | null
          severity: string
          subject: string | null
          topic: string
          user_id: string
        }
        Insert: {
          alert_type?: string
          created_at?: string
          exam_type: string
          id?: string
          is_pushed?: boolean | null
          is_read?: boolean | null
          message: string
          new_score?: number | null
          old_score?: number | null
          severity?: string
          subject?: string | null
          topic: string
          user_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          exam_type?: string
          id?: string
          is_pushed?: boolean | null
          is_read?: boolean | null
          message?: string
          new_score?: number | null
          old_score?: number | null
          severity?: string
          subject?: string | null
          topic?: string
          user_id?: string
        }
        Relationships: []
      }
      exam_intel_pipeline_runs: {
        Row: {
          alerts_created: number | null
          completed_at: string | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          exam_type: string
          id: string
          pipeline_stage: string
          predictions_generated: number | null
          started_at: string
          status: string
          student_briefs_updated: number | null
          topics_analyzed: number | null
        }
        Insert: {
          alerts_created?: number | null
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          exam_type: string
          id?: string
          pipeline_stage: string
          predictions_generated?: number | null
          started_at?: string
          status?: string
          student_briefs_updated?: number | null
          topics_analyzed?: number | null
        }
        Update: {
          alerts_created?: number | null
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          exam_type?: string
          id?: string
          pipeline_stage?: string
          predictions_generated?: number | null
          started_at?: string
          status?: string
          student_briefs_updated?: number | null
          topics_analyzed?: number | null
        }
        Relationships: []
      }
      exam_intel_practice_questions: {
        Row: {
          cognitive_type: string | null
          correct_answer: number
          correct_rate: number | null
          created_at: string
          difficulty_level: string | null
          exam_type: string
          explanation: string | null
          id: string
          is_active: boolean | null
          options: Json
          probability_score: number | null
          question_text: string
          source: string | null
          subject: string
          times_served: number | null
          topic: string
        }
        Insert: {
          cognitive_type?: string | null
          correct_answer?: number
          correct_rate?: number | null
          created_at?: string
          difficulty_level?: string | null
          exam_type: string
          explanation?: string | null
          id?: string
          is_active?: boolean | null
          options?: Json
          probability_score?: number | null
          question_text: string
          source?: string | null
          subject: string
          times_served?: number | null
          topic: string
        }
        Update: {
          cognitive_type?: string | null
          correct_answer?: number
          correct_rate?: number | null
          created_at?: string
          difficulty_level?: string | null
          exam_type?: string
          explanation?: string | null
          id?: string
          is_active?: boolean | null
          options?: Json
          probability_score?: number | null
          question_text?: string
          source?: string | null
          subject?: string
          times_served?: number | null
          topic?: string
        }
        Relationships: []
      }
      exam_intel_student_briefs: {
        Row: {
          ai_strategy_summary: string | null
          computed_at: string
          created_at: string
          exam_type: string
          id: string
          opportunity_topics: Json | null
          overall_readiness_score: number | null
          predicted_hot_topics: Json | null
          recommended_actions: Json | null
          risk_topics: Json | null
          updated_at: string
          user_id: string
          weakness_overlap: Json | null
        }
        Insert: {
          ai_strategy_summary?: string | null
          computed_at?: string
          created_at?: string
          exam_type: string
          id?: string
          opportunity_topics?: Json | null
          overall_readiness_score?: number | null
          predicted_hot_topics?: Json | null
          recommended_actions?: Json | null
          risk_topics?: Json | null
          updated_at?: string
          user_id: string
          weakness_overlap?: Json | null
        }
        Update: {
          ai_strategy_summary?: string | null
          computed_at?: string
          created_at?: string
          exam_type?: string
          id?: string
          opportunity_topics?: Json | null
          overall_readiness_score?: number | null
          predicted_hot_topics?: Json | null
          recommended_actions?: Json | null
          risk_topics?: Json | null
          updated_at?: string
          user_id?: string
          weakness_overlap?: Json | null
        }
        Relationships: []
      }
      exam_intel_topic_scores: {
        Row: {
          ai_confidence: number | null
          ca_boost_score: number | null
          composite_score: number | null
          computed_at: string
          consecutive_appearances: number | null
          created_at: string
          exam_type: string
          historical_frequency: number | null
          id: string
          last_appeared_year: number | null
          predicted_marks_weight: number | null
          probability_score: number
          subject: string
          topic: string
          topic_id: string | null
          trend_direction: string
          updated_at: string
        }
        Insert: {
          ai_confidence?: number | null
          ca_boost_score?: number | null
          composite_score?: number | null
          computed_at?: string
          consecutive_appearances?: number | null
          created_at?: string
          exam_type: string
          historical_frequency?: number | null
          id?: string
          last_appeared_year?: number | null
          predicted_marks_weight?: number | null
          probability_score?: number
          subject: string
          topic: string
          topic_id?: string | null
          trend_direction?: string
          updated_at?: string
        }
        Update: {
          ai_confidence?: number | null
          ca_boost_score?: number | null
          composite_score?: number | null
          computed_at?: string
          consecutive_appearances?: number | null
          created_at?: string
          exam_type?: string
          historical_frequency?: number | null
          id?: string
          last_appeared_year?: number | null
          predicted_marks_weight?: number | null
          probability_score?: number
          subject?: string
          topic?: string
          topic_id?: string | null
          trend_direction?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_intel_topic_scores_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
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
      exam_trend_patterns: {
        Row: {
          created_at: string
          created_by: string | null
          difficulty_distribution: Json | null
          exam_type: string
          frequency_count: number | null
          id: string
          predicted_probability: number | null
          source: string | null
          subject: string
          topic: string
          updated_at: string
          year: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          difficulty_distribution?: Json | null
          exam_type: string
          frequency_count?: number | null
          id?: string
          predicted_probability?: number | null
          source?: string | null
          subject: string
          topic: string
          updated_at?: string
          year?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          difficulty_distribution?: Json | null
          exam_type?: string
          frequency_count?: number | null
          id?: string
          predicted_probability?: number | null
          source?: string | null
          subject?: string
          topic?: string
          updated_at?: string
          year?: number | null
        }
        Relationships: []
      }
      faculty_assignments: {
        Row: {
          assigned_at: string
          batch_id: string
          faculty_user_id: string
          id: string
          institution_id: string
          is_primary: boolean | null
          subject: string | null
        }
        Insert: {
          assigned_at?: string
          batch_id: string
          faculty_user_id: string
          id?: string
          institution_id: string
          is_primary?: boolean | null
          subject?: string | null
        }
        Update: {
          assigned_at?: string
          batch_id?: string
          faculty_user_id?: string
          id?: string
          institution_id?: string
          is_primary?: boolean | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "faculty_assignments_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "institution_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faculty_assignments_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      fatigue_config: {
        Row: {
          auto_language_suggestion: boolean | null
          break_suggestion_cooldown_minutes: number | null
          confidence_boost_enabled: boolean | null
          delay_threshold_ms: number | null
          id: string
          mistake_cluster_threshold: number | null
          rescue_mode_wrong_threshold: number | null
          session_max_minutes: number | null
          updated_at: string
          updated_by: string | null
          weekly_recalibration_enabled: boolean | null
        }
        Insert: {
          auto_language_suggestion?: boolean | null
          break_suggestion_cooldown_minutes?: number | null
          confidence_boost_enabled?: boolean | null
          delay_threshold_ms?: number | null
          id?: string
          mistake_cluster_threshold?: number | null
          rescue_mode_wrong_threshold?: number | null
          session_max_minutes?: number | null
          updated_at?: string
          updated_by?: string | null
          weekly_recalibration_enabled?: boolean | null
        }
        Update: {
          auto_language_suggestion?: boolean | null
          break_suggestion_cooldown_minutes?: number | null
          confidence_boost_enabled?: boolean | null
          delay_threshold_ms?: number | null
          id?: string
          mistake_cluster_threshold?: number | null
          rescue_mode_wrong_threshold?: number | null
          session_max_minutes?: number | null
          updated_at?: string
          updated_by?: string | null
          weekly_recalibration_enabled?: boolean | null
        }
        Relationships: []
      }
      fatigue_events: {
        Row: {
          created_at: string
          event_type: string
          fatigue_score: number | null
          id: string
          mistake_cluster_count: number | null
          response_delay_avg_ms: number | null
          session_duration_minutes: number | null
          trigger_reason: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type?: string
          fatigue_score?: number | null
          id?: string
          mistake_cluster_count?: number | null
          response_delay_avg_ms?: number | null
          session_duration_minutes?: number | null
          trigger_reason?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          fatigue_score?: number | null
          id?: string
          mistake_cluster_count?: number | null
          response_delay_avg_ms?: number | null
          session_duration_minutes?: number | null
          trigger_reason?: string | null
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
      generated_exam_questions: {
        Row: {
          approved_by: string | null
          cognitive_type: string | null
          correct_answer: number | null
          created_at: string
          difficulty_level: string | null
          dna_cluster_id: string | null
          exam_type: string
          explanation: string | null
          generation_metadata: Json | null
          generation_model: string | null
          id: string
          is_approved: boolean | null
          micro_concept_id: string | null
          options: Json | null
          predicted_probability: number | null
          quality_score: number | null
          question_text: string
          subject: string
          topic: string
        }
        Insert: {
          approved_by?: string | null
          cognitive_type?: string | null
          correct_answer?: number | null
          created_at?: string
          difficulty_level?: string | null
          dna_cluster_id?: string | null
          exam_type: string
          explanation?: string | null
          generation_metadata?: Json | null
          generation_model?: string | null
          id?: string
          is_approved?: boolean | null
          micro_concept_id?: string | null
          options?: Json | null
          predicted_probability?: number | null
          quality_score?: number | null
          question_text: string
          subject: string
          topic: string
        }
        Update: {
          approved_by?: string | null
          cognitive_type?: string | null
          correct_answer?: number | null
          created_at?: string
          difficulty_level?: string | null
          dna_cluster_id?: string | null
          exam_type?: string
          explanation?: string | null
          generation_metadata?: Json | null
          generation_model?: string | null
          id?: string
          is_approved?: boolean | null
          micro_concept_id?: string | null
          options?: Json | null
          predicted_probability?: number | null
          quality_score?: number | null
          question_text?: string
          subject?: string
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_exam_questions_dna_cluster_id_fkey"
            columns: ["dna_cluster_id"]
            isOneToOne: false
            referencedRelation: "question_dna_clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_exam_questions_micro_concept_id_fkey"
            columns: ["micro_concept_id"]
            isOneToOne: false
            referencedRelation: "micro_concepts"
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
      growth_analytics: {
        Row: {
          churn_reduction: number | null
          click_rate: number | null
          conversion_rate: number | null
          created_at: string
          dau: number | null
          id: string
          metric_date: string
          notifications_opened: number | null
          notifications_sent: number | null
          open_rate: number | null
          referral_count: number | null
          retention_rate: number | null
          revenue_uplift: number | null
          segment_key: string | null
        }
        Insert: {
          churn_reduction?: number | null
          click_rate?: number | null
          conversion_rate?: number | null
          created_at?: string
          dau?: number | null
          id?: string
          metric_date?: string
          notifications_opened?: number | null
          notifications_sent?: number | null
          open_rate?: number | null
          referral_count?: number | null
          retention_rate?: number | null
          revenue_uplift?: number | null
          segment_key?: string | null
        }
        Update: {
          churn_reduction?: number | null
          click_rate?: number | null
          conversion_rate?: number | null
          created_at?: string
          dau?: number | null
          id?: string
          metric_date?: string
          notifications_opened?: number | null
          notifications_sent?: number | null
          open_rate?: number | null
          referral_count?: number | null
          retention_rate?: number | null
          revenue_uplift?: number | null
          segment_key?: string | null
        }
        Relationships: []
      }
      growth_journeys: {
        Row: {
          completed_at: string | null
          created_at: string
          current_step: number
          id: string
          journey_key: string
          last_step_at: string | null
          started_at: string
          status: string
          step_history: Json | null
          total_steps: number
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_step?: number
          id?: string
          journey_key?: string
          last_step_at?: string | null
          started_at?: string
          status?: string
          step_history?: Json | null
          total_steps?: number
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_step?: number
          id?: string
          journey_key?: string
          last_step_at?: string | null
          started_at?: string
          status?: string
          step_history?: Json | null
          total_steps?: number
          user_id?: string
        }
        Relationships: []
      }
      growth_trigger_log: {
        Row: {
          channel: string | null
          created_at: string
          id: string
          outcome: string | null
          trigger_data: Json | null
          trigger_type: string
          user_id: string
        }
        Insert: {
          channel?: string | null
          created_at?: string
          id?: string
          outcome?: string | null
          trigger_data?: Json | null
          trigger_type: string
          user_id: string
        }
        Update: {
          channel?: string | null
          created_at?: string
          id?: string
          outcome?: string | null
          trigger_data?: Json | null
          trigger_type?: string
          user_id?: string
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
      institution_api_keys: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          institution_id: string
          is_active: boolean | null
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          permissions: string[] | null
          rate_limit_per_minute: number | null
          usage_count: number | null
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          institution_id: string
          is_active?: boolean | null
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          permissions?: string[] | null
          rate_limit_per_minute?: number | null
          usage_count?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          institution_id?: string
          is_active?: boolean | null
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          permissions?: string[] | null
          rate_limit_per_minute?: number | null
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "institution_api_keys_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      institution_audit_logs: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          details: Json | null
          id: string
          institution_id: string
          ip_address: string | null
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_user_id: string
          created_at?: string
          details?: Json | null
          id?: string
          institution_id: string
          ip_address?: string | null
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          institution_id?: string
          ip_address?: string | null
          target_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "institution_audit_logs_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      institution_batches: {
        Row: {
          academic_year: string | null
          created_at: string
          created_by: string
          description: string | null
          end_date: string | null
          id: string
          institution_id: string
          is_active: boolean | null
          max_students: number | null
          name: string
          start_date: string | null
          updated_at: string
        }
        Insert: {
          academic_year?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          end_date?: string | null
          id?: string
          institution_id: string
          is_active?: boolean | null
          max_students?: number | null
          name: string
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          academic_year?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string | null
          id?: string
          institution_id?: string
          is_active?: boolean | null
          max_students?: number | null
          name?: string
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "institution_batches_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      institution_invoices: {
        Row: {
          amount: number
          billing_period_end: string | null
          billing_period_start: string | null
          created_at: string
          currency: string
          id: string
          institution_id: string
          invoice_number: string
          license_id: string | null
          paid_at: string | null
          razorpay_payment_id: string | null
          status: string
          student_count: number
        }
        Insert: {
          amount: number
          billing_period_end?: string | null
          billing_period_start?: string | null
          created_at?: string
          currency?: string
          id?: string
          institution_id: string
          invoice_number: string
          license_id?: string | null
          paid_at?: string | null
          razorpay_payment_id?: string | null
          status?: string
          student_count?: number
        }
        Update: {
          amount?: number
          billing_period_end?: string | null
          billing_period_start?: string | null
          created_at?: string
          currency?: string
          id?: string
          institution_id?: string
          invoice_number?: string
          license_id?: string | null
          paid_at?: string | null
          razorpay_payment_id?: string | null
          status?: string
          student_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "institution_invoices_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institution_invoices_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "institution_licenses"
            referencedColumns: ["id"]
          },
        ]
      }
      institution_licenses: {
        Row: {
          auto_renew: boolean | null
          billing_cycle: string
          created_at: string
          expires_at: string | null
          id: string
          institution_id: string
          max_students: number
          plan_name: string
          price_per_student: number
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          auto_renew?: boolean | null
          billing_cycle?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          institution_id: string
          max_students?: number
          plan_name?: string
          price_per_student?: number
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          auto_renew?: boolean | null
          billing_cycle?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          institution_id?: string
          max_students?: number
          plan_name?: string
          price_per_student?: number
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "institution_licenses_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      institution_members: {
        Row: {
          id: string
          institution_id: string
          is_active: boolean | null
          joined_at: string | null
          metadata: Json | null
          role: string
          user_id: string
        }
        Insert: {
          id?: string
          institution_id: string
          is_active?: boolean | null
          joined_at?: string | null
          metadata?: Json | null
          role?: string
          user_id: string
        }
        Update: {
          id?: string
          institution_id?: string
          is_active?: boolean | null
          joined_at?: string | null
          metadata?: Json | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "institution_members_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      institutions: {
        Row: {
          admin_user_id: string
          branch: string | null
          city: string | null
          created_at: string | null
          domain: string | null
          id: string
          is_active: boolean | null
          license_expires_at: string | null
          license_status: string | null
          logo_url: string | null
          max_students: number | null
          name: string
          primary_color: string | null
          secondary_color: string | null
          settings: Json | null
          slug: string
          student_count: number | null
          teacher_count: number | null
          type: string
          updated_at: string | null
        }
        Insert: {
          admin_user_id: string
          branch?: string | null
          city?: string | null
          created_at?: string | null
          domain?: string | null
          id?: string
          is_active?: boolean | null
          license_expires_at?: string | null
          license_status?: string | null
          logo_url?: string | null
          max_students?: number | null
          name: string
          primary_color?: string | null
          secondary_color?: string | null
          settings?: Json | null
          slug: string
          student_count?: number | null
          teacher_count?: number | null
          type?: string
          updated_at?: string | null
        }
        Update: {
          admin_user_id?: string
          branch?: string | null
          city?: string | null
          created_at?: string | null
          domain?: string | null
          id?: string
          is_active?: boolean | null
          license_expires_at?: string | null
          license_status?: string | null
          logo_url?: string | null
          max_students?: number | null
          name?: string
          primary_color?: string | null
          secondary_color?: string | null
          settings?: Json | null
          slug?: string
          student_count?: number | null
          teacher_count?: number | null
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      language_performance: {
        Row: {
          accuracy_rate: number | null
          avg_response_time_ms: number | null
          correct_answers: number | null
          created_at: string
          id: string
          improvement_pct: number | null
          language: string
          period_end: string | null
          period_start: string | null
          total_questions: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accuracy_rate?: number | null
          avg_response_time_ms?: number | null
          correct_answers?: number | null
          created_at?: string
          id?: string
          improvement_pct?: number | null
          language?: string
          period_end?: string | null
          period_start?: string | null
          total_questions?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accuracy_rate?: number | null
          avg_response_time_ms?: number | null
          correct_answers?: number | null
          created_at?: string
          id?: string
          improvement_pct?: number | null
          language?: string
          period_end?: string | null
          period_start?: string | null
          total_questions?: number | null
          updated_at?: string
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
      micro_concepts: {
        Row: {
          created_at: string
          exam_type: string
          historical_frequency: number | null
          id: string
          importance_weight: number | null
          injected_to_memory: boolean | null
          injected_to_revision: boolean | null
          last_appeared_year: number | null
          metadata: Json | null
          micro_concept: string
          probability_score: number | null
          subject: string
          topic: string
          trend_direction: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          exam_type: string
          historical_frequency?: number | null
          id?: string
          importance_weight?: number | null
          injected_to_memory?: boolean | null
          injected_to_revision?: boolean | null
          last_appeared_year?: number | null
          metadata?: Json | null
          micro_concept: string
          probability_score?: number | null
          subject: string
          topic: string
          trend_direction?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          exam_type?: string
          historical_frequency?: number | null
          id?: string
          importance_weight?: number | null
          injected_to_memory?: boolean | null
          injected_to_revision?: boolean | null
          last_appeared_year?: number | null
          metadata?: Json | null
          micro_concept?: string
          probability_score?: number | null
          subject?: string
          topic?: string
          trend_direction?: string | null
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
      model_recalibration_logs: {
        Row: {
          accuracy_delta: number | null
          ai_reasoning: string | null
          completed_at: string | null
          created_at: string
          id: string
          model_name: string
          new_accuracy: number | null
          parameters_changed: Json | null
          previous_accuracy: number | null
          recalibration_type: string
          started_at: string | null
          status: string | null
          training_data_size: number | null
          user_count_affected: number | null
        }
        Insert: {
          accuracy_delta?: number | null
          ai_reasoning?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          model_name: string
          new_accuracy?: number | null
          parameters_changed?: Json | null
          previous_accuracy?: number | null
          recalibration_type: string
          started_at?: string | null
          status?: string | null
          training_data_size?: number | null
          user_count_affected?: number | null
        }
        Update: {
          accuracy_delta?: number | null
          ai_reasoning?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          model_name?: string
          new_accuracy?: number | null
          parameters_changed?: Json | null
          previous_accuracy?: number | null
          recalibration_type?: string
          started_at?: string | null
          status?: string | null
          training_data_size?: number | null
          user_count_affected?: number | null
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
      notification_ab_tests: {
        Row: {
          created_at: string
          created_by: string | null
          event_type: string
          id: string
          is_active: boolean
          updated_at: string
          variant_a_clicked: number
          variant_a_opened: number
          variant_a_sent: number
          variant_a_template: string
          variant_b_clicked: number
          variant_b_opened: number
          variant_b_sent: number
          variant_b_template: string
          winner: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_type: string
          id?: string
          is_active?: boolean
          updated_at?: string
          variant_a_clicked?: number
          variant_a_opened?: number
          variant_a_sent?: number
          variant_a_template: string
          variant_b_clicked?: number
          variant_b_opened?: number
          variant_b_sent?: number
          variant_b_template: string
          winner?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_type?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          variant_a_clicked?: number
          variant_a_opened?: number
          variant_a_sent?: number
          variant_a_template?: string
          variant_b_clicked?: number
          variant_b_opened?: number
          variant_b_sent?: number
          variant_b_template?: string
          winner?: string | null
        }
        Relationships: []
      }
      notification_analytics: {
        Row: {
          avg_decision_ms: number | null
          channel_breakdown: Json | null
          churn_prevented: number | null
          created_at: string
          date: string
          dopamine_strategy_breakdown: Json | null
          engagement_lift_pct: number | null
          id: string
          retention_lift_pct: number | null
          total_bundled: number | null
          total_clicked: number | null
          total_escalated: number | null
          total_opened: number | null
          total_sent: number | null
          total_suppressed: number | null
        }
        Insert: {
          avg_decision_ms?: number | null
          channel_breakdown?: Json | null
          churn_prevented?: number | null
          created_at?: string
          date?: string
          dopamine_strategy_breakdown?: Json | null
          engagement_lift_pct?: number | null
          id?: string
          retention_lift_pct?: number | null
          total_bundled?: number | null
          total_clicked?: number | null
          total_escalated?: number | null
          total_opened?: number | null
          total_sent?: number | null
          total_suppressed?: number | null
        }
        Update: {
          avg_decision_ms?: number | null
          channel_breakdown?: Json | null
          churn_prevented?: number | null
          created_at?: string
          date?: string
          dopamine_strategy_breakdown?: Json | null
          engagement_lift_pct?: number | null
          id?: string
          retention_lift_pct?: number | null
          total_bundled?: number | null
          total_clicked?: number | null
          total_escalated?: number | null
          total_opened?: number | null
          total_sent?: number | null
          total_suppressed?: number | null
        }
        Relationships: []
      }
      notification_bundles: {
        Row: {
          bundle_type: string
          channel: string
          created_at: string
          id: string
          item_count: number
          items: Json
          scheduled_at: string
          sent_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          bundle_type?: string
          channel?: string
          created_at?: string
          id?: string
          item_count?: number
          items?: Json
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          bundle_type?: string
          channel?: string
          created_at?: string
          id?: string
          item_count?: number
          items?: Json
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_delivery_log: {
        Row: {
          body: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          delivered_at: string | null
          error_message: string | null
          event_id: string | null
          fallback_channel:
            | Database["public"]["Enums"]["notification_channel"]
            | null
          id: string
          max_retries: number
          priority: Database["public"]["Enums"]["notification_priority"]
          retry_count: number
          status: Database["public"]["Enums"]["delivery_status"]
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          event_id?: string | null
          fallback_channel?:
            | Database["public"]["Enums"]["notification_channel"]
            | null
          id?: string
          max_retries?: number
          priority?: Database["public"]["Enums"]["notification_priority"]
          retry_count?: number
          status?: Database["public"]["Enums"]["delivery_status"]
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          event_id?: string | null
          fallback_channel?:
            | Database["public"]["Enums"]["notification_channel"]
            | null
          id?: string
          max_retries?: number
          priority?: Database["public"]["Enums"]["notification_priority"]
          retry_count?: number
          status?: Database["public"]["Enums"]["delivery_status"]
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_delivery_log_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_log"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_escalations: {
        Row: {
          created_at: string
          current_escalation_level: number
          escalation_channels: string[] | null
          event_type: string
          id: string
          ignore_count: number
          last_escalated_at: string | null
          resolved: boolean
          resolved_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_escalation_level?: number
          escalation_channels?: string[] | null
          event_type: string
          id?: string
          ignore_count?: number
          last_escalated_at?: string | null
          resolved?: boolean
          resolved_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_escalation_level?: number
          escalation_channels?: string[] | null
          event_type?: string
          id?: string
          ignore_count?: number
          last_escalated_at?: string | null
          resolved?: boolean
          resolved_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_history: {
        Row: {
          action_url: string | null
          body: string | null
          created_at: string
          id: string
          priority: string
          read: boolean
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          action_url?: string | null
          body?: string | null
          created_at?: string
          id?: string
          priority?: string
          read?: boolean
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          action_url?: string | null
          body?: string | null
          created_at?: string
          id?: string
          priority?: string
          read?: boolean
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notification_segments: {
        Row: {
          assigned_at: string
          expires_at: string | null
          id: string
          metadata: Json | null
          segment_key: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          segment_key: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          segment_key?: string
          user_id?: string
        }
        Relationships: []
      }
      omnichannel_rules: {
        Row: {
          ab_test_id: string | null
          bundleable: boolean
          category: string
          channels: Database["public"]["Enums"]["notification_channel"][]
          condition_expression: Json | null
          cooldown_minutes: number
          created_at: string
          delay_seconds: number
          display_name: string
          escalation_enabled: boolean
          event_type: string
          fallback_channels:
            | Database["public"]["Enums"]["notification_channel"][]
            | null
          id: string
          is_enabled: boolean
          last_triggered_at: string | null
          max_escalation_level: number
          priority: Database["public"]["Enums"]["notification_priority"]
          retry_count: number
          smart_silence_enabled: boolean
          total_delivered: number
          total_failed: number
          total_triggered: number
          updated_at: string
          use_dopamine_copy: boolean
          use_smart_timing: boolean
        }
        Insert: {
          ab_test_id?: string | null
          bundleable?: boolean
          category?: string
          channels?: Database["public"]["Enums"]["notification_channel"][]
          condition_expression?: Json | null
          cooldown_minutes?: number
          created_at?: string
          delay_seconds?: number
          display_name: string
          escalation_enabled?: boolean
          event_type: string
          fallback_channels?:
            | Database["public"]["Enums"]["notification_channel"][]
            | null
          id?: string
          is_enabled?: boolean
          last_triggered_at?: string | null
          max_escalation_level?: number
          priority?: Database["public"]["Enums"]["notification_priority"]
          retry_count?: number
          smart_silence_enabled?: boolean
          total_delivered?: number
          total_failed?: number
          total_triggered?: number
          updated_at?: string
          use_dopamine_copy?: boolean
          use_smart_timing?: boolean
        }
        Update: {
          ab_test_id?: string | null
          bundleable?: boolean
          category?: string
          channels?: Database["public"]["Enums"]["notification_channel"][]
          condition_expression?: Json | null
          cooldown_minutes?: number
          created_at?: string
          delay_seconds?: number
          display_name?: string
          escalation_enabled?: boolean
          event_type?: string
          fallback_channels?:
            | Database["public"]["Enums"]["notification_channel"][]
            | null
          id?: string
          is_enabled?: boolean
          last_triggered_at?: string | null
          max_escalation_level?: number
          priority?: Database["public"]["Enums"]["notification_priority"]
          retry_count?: number
          smart_silence_enabled?: boolean
          total_delivered?: number
          total_failed?: number
          total_triggered?: number
          updated_at?: string
          use_dopamine_copy?: boolean
          use_smart_timing?: boolean
        }
        Relationships: []
      }
      opponent_simulation_config: {
        Row: {
          competitor_accuracy_range: Json | null
          difficulty_escalation_rate: number | null
          exam_type: string
          id: string
          is_enabled: boolean | null
          pressure_level: string | null
          time_pressure_multiplier: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          competitor_accuracy_range?: Json | null
          difficulty_escalation_rate?: number | null
          exam_type?: string
          id?: string
          is_enabled?: boolean | null
          pressure_level?: string | null
          time_pressure_multiplier?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          competitor_accuracy_range?: Json | null
          difficulty_escalation_rate?: number | null
          exam_type?: string
          id?: string
          is_enabled?: boolean | null
          pressure_level?: string | null
          time_pressure_multiplier?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      pattern_evolution_logs: {
        Row: {
          affected_topics: string[] | null
          created_at: string
          description: string
          detected_at: string
          detection_type: string
          exam_type: string
          id: string
          new_value: Json | null
          old_value: Json | null
          recommendation: string | null
          severity: string | null
          subject: string | null
        }
        Insert: {
          affected_topics?: string[] | null
          created_at?: string
          description: string
          detected_at?: string
          detection_type: string
          exam_type: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          recommendation?: string | null
          severity?: string | null
          subject?: string | null
        }
        Update: {
          affected_topics?: string[] | null
          created_at?: string
          description?: string
          detected_at?: string
          detection_type?: string
          exam_type?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          recommendation?: string | null
          severity?: string | null
          subject?: string | null
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
      practice_progress: {
        Row: {
          id: string
          is_correct: boolean | null
          practiced_at: string
          question_id: string
          question_source: string
          selected_answer: number | null
          time_taken_seconds: number | null
          user_id: string
        }
        Insert: {
          id?: string
          is_correct?: boolean | null
          practiced_at?: string
          question_id: string
          question_source?: string
          selected_answer?: number | null
          time_taken_seconds?: number | null
          user_id: string
        }
        Update: {
          id?: string
          is_correct?: boolean | null
          practiced_at?: string
          question_id?: string
          question_source?: string
          selected_answer?: number | null
          time_taken_seconds?: number | null
          user_id?: string
        }
        Relationships: []
      }
      practice_set_submissions: {
        Row: {
          answers: Json | null
          feedback: Json | null
          graded_at: string | null
          id: string
          practice_set_id: string
          score: number | null
          student_id: string
          submitted_at: string | null
          time_spent_minutes: number | null
        }
        Insert: {
          answers?: Json | null
          feedback?: Json | null
          graded_at?: string | null
          id?: string
          practice_set_id: string
          score?: number | null
          student_id: string
          submitted_at?: string | null
          time_spent_minutes?: number | null
        }
        Update: {
          answers?: Json | null
          feedback?: Json | null
          graded_at?: string | null
          id?: string
          practice_set_id?: string
          score?: number | null
          student_id?: string
          submitted_at?: string | null
          time_spent_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "practice_set_submissions_practice_set_id_fkey"
            columns: ["practice_set_id"]
            isOneToOne: false
            referencedRelation: "teacher_practice_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      precision_scores: {
        Row: {
          ai_reasoning: string | null
          behavioral_timing_score: number | null
          computed_at: string
          confidence_interval_high: number | null
          confidence_interval_low: number | null
          created_at: string
          error_clustering_score: number | null
          forgetting_curve_factor: number | null
          id: string
          performance_trend_score: number | null
          retrieval_strength_index: number | null
          topic_weight_importance: number | null
          unified_precision_score: number | null
          user_id: string
        }
        Insert: {
          ai_reasoning?: string | null
          behavioral_timing_score?: number | null
          computed_at?: string
          confidence_interval_high?: number | null
          confidence_interval_low?: number | null
          created_at?: string
          error_clustering_score?: number | null
          forgetting_curve_factor?: number | null
          id?: string
          performance_trend_score?: number | null
          retrieval_strength_index?: number | null
          topic_weight_importance?: number | null
          unified_precision_score?: number | null
          user_id: string
        }
        Update: {
          ai_reasoning?: string | null
          behavioral_timing_score?: number | null
          computed_at?: string
          confidence_interval_high?: number | null
          confidence_interval_low?: number | null
          created_at?: string
          error_clustering_score?: number | null
          forgetting_curve_factor?: number | null
          id?: string
          performance_trend_score?: number | null
          retrieval_strength_index?: number | null
          topic_weight_importance?: number | null
          unified_precision_score?: number | null
          user_id?: string
        }
        Relationships: []
      }
      predicted_questions: {
        Row: {
          correct_answer: number
          created_at: string
          difficulty: string
          exam_type: string
          explanation: string | null
          id: string
          options: Json
          probability_level: string
          probability_score: number
          question: string
          subject: string
          topic: string | null
          trend_weight: number | null
        }
        Insert: {
          correct_answer: number
          created_at?: string
          difficulty?: string
          exam_type: string
          explanation?: string | null
          id?: string
          options?: Json
          probability_level?: string
          probability_score?: number
          question: string
          subject: string
          topic?: string | null
          trend_weight?: number | null
        }
        Update: {
          correct_answer?: number
          created_at?: string
          difficulty?: string
          exam_type?: string
          explanation?: string | null
          id?: string
          options?: Json
          probability_level?: string
          probability_score?: number
          question?: string
          subject?: string
          topic?: string | null
          trend_weight?: number | null
        }
        Relationships: []
      }
      prediction_confidence_bands: {
        Row: {
          computed_at: string
          confidence_level: number | null
          created_at: string
          data_points_used: number | null
          exam_type: string
          id: string
          lower_bound: number | null
          model_version: string | null
          point_estimate: number | null
          prediction_type: string
          risk_adjustment: number | null
          upper_bound: number | null
          user_id: string
          volatility_score: number | null
        }
        Insert: {
          computed_at?: string
          confidence_level?: number | null
          created_at?: string
          data_points_used?: number | null
          exam_type: string
          id?: string
          lower_bound?: number | null
          model_version?: string | null
          point_estimate?: number | null
          prediction_type: string
          risk_adjustment?: number | null
          upper_bound?: number | null
          user_id: string
          volatility_score?: number | null
        }
        Update: {
          computed_at?: string
          confidence_level?: number | null
          created_at?: string
          data_points_used?: number | null
          exam_type?: string
          id?: string
          lower_bound?: number | null
          model_version?: string | null
          point_estimate?: number | null
          prediction_type?: string
          risk_adjustment?: number | null
          upper_bound?: number | null
          user_id?: string
          volatility_score?: number | null
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
          email: string | null
          email_notifications_enabled: boolean
          email_study_reminders: boolean
          email_weekly_reports: boolean
          exam_date: string | null
          exam_type: string | null
          id: string
          is_banned: boolean
          last_brain_update_at: string | null
          opt_in_leaderboard: boolean
          phone: string | null
          push_notification_prefs: Json
          push_notifications_enabled: boolean
          study_preferences: Json | null
          updated_at: string
          voice_notifications_enabled: boolean
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
          email?: string | null
          email_notifications_enabled?: boolean
          email_study_reminders?: boolean
          email_weekly_reports?: boolean
          exam_date?: string | null
          exam_type?: string | null
          id: string
          is_banned?: boolean
          last_brain_update_at?: string | null
          opt_in_leaderboard?: boolean
          phone?: string | null
          push_notification_prefs?: Json
          push_notifications_enabled?: boolean
          study_preferences?: Json | null
          updated_at?: string
          voice_notifications_enabled?: boolean
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
          email?: string | null
          email_notifications_enabled?: boolean
          email_study_reminders?: boolean
          email_weekly_reports?: boolean
          exam_date?: string | null
          exam_type?: string | null
          id?: string
          is_banned?: boolean
          last_brain_update_at?: string | null
          opt_in_leaderboard?: boolean
          phone?: string | null
          push_notification_prefs?: Json
          push_notifications_enabled?: boolean
          study_preferences?: Json | null
          updated_at?: string
          voice_notifications_enabled?: boolean
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
      question_bank: {
        Row: {
          correct_answer: number
          created_at: string
          difficulty: string
          exam_type: string
          explanation: string | null
          id: string
          options: Json
          previous_year_tag: string | null
          question: string
          subject: string
          topic: string | null
          year: number
        }
        Insert: {
          correct_answer: number
          created_at?: string
          difficulty?: string
          exam_type: string
          explanation?: string | null
          id?: string
          options?: Json
          previous_year_tag?: string | null
          question: string
          subject: string
          topic?: string | null
          year: number
        }
        Update: {
          correct_answer?: number
          created_at?: string
          difficulty?: string
          exam_type?: string
          explanation?: string | null
          id?: string
          options?: Json
          previous_year_tag?: string | null
          question?: string
          subject?: string
          topic?: string | null
          year?: number
        }
        Relationships: []
      }
      question_bank_tags: {
        Row: {
          created_at: string
          id: string
          question_id: string
          tag: string
          tagged_by: string
        }
        Insert: {
          created_at?: string
          id?: string
          question_id: string
          tag: string
          tagged_by: string
        }
        Update: {
          created_at?: string
          id?: string
          question_id?: string
          tag?: string
          tagged_by?: string
        }
        Relationships: []
      }
      question_dna_clusters: {
        Row: {
          archetype: string | null
          centroid_embedding: Json | null
          cluster_label: string
          cluster_size: number | null
          cognitive_features: Json | null
          concept_layers: Json | null
          created_at: string
          exam_type: string
          growth_rate: number | null
          id: string
          is_rising: boolean | null
          sample_question_ids: Json | null
          updated_at: string
        }
        Insert: {
          archetype?: string | null
          centroid_embedding?: Json | null
          cluster_label: string
          cluster_size?: number | null
          cognitive_features?: Json | null
          concept_layers?: Json | null
          created_at?: string
          exam_type: string
          growth_rate?: number | null
          id?: string
          is_rising?: boolean | null
          sample_question_ids?: Json | null
          updated_at?: string
        }
        Update: {
          archetype?: string | null
          centroid_embedding?: Json | null
          cluster_label?: string
          cluster_size?: number | null
          cognitive_features?: Json | null
          concept_layers?: Json | null
          created_at?: string
          exam_type?: string
          growth_rate?: number | null
          id?: string
          is_rising?: boolean | null
          sample_question_ids?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      question_mining_results: {
        Row: {
          created_at: string
          difficulty_level: string | null
          exam_type: string
          id: string
          marks: number | null
          metadata: Json | null
          pattern_tags: string[] | null
          question_text: string | null
          question_type: string | null
          semantic_cluster: string | null
          similarity_score: number | null
          source_paper: string | null
          subject: string
          subtopic: string | null
          taxonomy_id: string | null
          topic: string
          year: number
        }
        Insert: {
          created_at?: string
          difficulty_level?: string | null
          exam_type: string
          id?: string
          marks?: number | null
          metadata?: Json | null
          pattern_tags?: string[] | null
          question_text?: string | null
          question_type?: string | null
          semantic_cluster?: string | null
          similarity_score?: number | null
          source_paper?: string | null
          subject: string
          subtopic?: string | null
          taxonomy_id?: string | null
          topic: string
          year: number
        }
        Update: {
          created_at?: string
          difficulty_level?: string | null
          exam_type?: string
          id?: string
          marks?: number | null
          metadata?: Json | null
          pattern_tags?: string[] | null
          question_text?: string | null
          question_type?: string | null
          semantic_cluster?: string | null
          similarity_score?: number | null
          source_paper?: string | null
          subject?: string
          subtopic?: string | null
          taxonomy_id?: string | null
          topic?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "question_mining_results_taxonomy_id_fkey"
            columns: ["taxonomy_id"]
            isOneToOne: false
            referencedRelation: "syllabus_taxonomies"
            referencedColumns: ["id"]
          },
        ]
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
      rank_heatmap_snapshots: {
        Row: {
          blended_percentile: number | null
          computed_at: string
          created_at: string
          exam_type: string
          id: string
          internal_rank_score: number | null
          percentile: number
          simulated_national_score: number | null
          subject_breakdown: Json | null
          total_internal_users: number | null
          user_id: string
        }
        Insert: {
          blended_percentile?: number | null
          computed_at?: string
          created_at?: string
          exam_type?: string
          id?: string
          internal_rank_score?: number | null
          percentile?: number
          simulated_national_score?: number | null
          subject_breakdown?: Json | null
          total_internal_users?: number | null
          user_id: string
        }
        Update: {
          blended_percentile?: number | null
          computed_at?: string
          created_at?: string
          exam_type?: string
          id?: string
          internal_rank_score?: number | null
          percentile?: number
          simulated_national_score?: number | null
          subject_breakdown?: Json | null
          total_internal_users?: number | null
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
      rank_predictions_v2: {
        Row: {
          ai_reasoning: string | null
          computed_at: string
          confidence_interval_high: number | null
          confidence_interval_low: number | null
          consistency_coefficient: number | null
          created_at: string
          factors_breakdown: Json | null
          high_weight_topic_factor: number | null
          id: string
          model_version: string | null
          percentile_estimation: number | null
          predicted_rank: number | null
          rank_band_high: number | null
          rank_band_low: number | null
          user_id: string
          volatility_index: number | null
        }
        Insert: {
          ai_reasoning?: string | null
          computed_at?: string
          confidence_interval_high?: number | null
          confidence_interval_low?: number | null
          consistency_coefficient?: number | null
          created_at?: string
          factors_breakdown?: Json | null
          high_weight_topic_factor?: number | null
          id?: string
          model_version?: string | null
          percentile_estimation?: number | null
          predicted_rank?: number | null
          rank_band_high?: number | null
          rank_band_low?: number | null
          user_id: string
          volatility_index?: number | null
        }
        Update: {
          ai_reasoning?: string | null
          computed_at?: string
          confidence_interval_high?: number | null
          confidence_interval_low?: number | null
          consistency_coefficient?: number | null
          created_at?: string
          factors_breakdown?: Json | null
          high_weight_topic_factor?: number | null
          id?: string
          model_version?: string | null
          percentile_estimation?: number | null
          predicted_rank?: number | null
          rank_band_high?: number | null
          rank_band_low?: number | null
          user_id?: string
          volatility_index?: number | null
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
      stq_engine_config: {
        Row: {
          auto_retrain_enabled: boolean | null
          engine_enabled: boolean | null
          id: string
          last_retrained_at: string | null
          memory_injection_enabled: boolean | null
          mock_integration_enabled: boolean | null
          model_version: string | null
          pattern_detection_enabled: boolean | null
          question_mining_enabled: boolean | null
          retrain_interval_days: number | null
          sureshot_integration_enabled: boolean | null
          syllabus_parser_enabled: boolean | null
          tpi_engine_enabled: boolean | null
          tpi_high_threshold: number | null
          tpi_low_threshold: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          auto_retrain_enabled?: boolean | null
          engine_enabled?: boolean | null
          id?: string
          last_retrained_at?: string | null
          memory_injection_enabled?: boolean | null
          mock_integration_enabled?: boolean | null
          model_version?: string | null
          pattern_detection_enabled?: boolean | null
          question_mining_enabled?: boolean | null
          retrain_interval_days?: number | null
          sureshot_integration_enabled?: boolean | null
          syllabus_parser_enabled?: boolean | null
          tpi_engine_enabled?: boolean | null
          tpi_high_threshold?: number | null
          tpi_low_threshold?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          auto_retrain_enabled?: boolean | null
          engine_enabled?: boolean | null
          id?: string
          last_retrained_at?: string | null
          memory_injection_enabled?: boolean | null
          mock_integration_enabled?: boolean | null
          model_version?: string | null
          pattern_detection_enabled?: boolean | null
          question_mining_enabled?: boolean | null
          retrain_interval_days?: number | null
          sureshot_integration_enabled?: boolean | null
          syllabus_parser_enabled?: boolean | null
          tpi_engine_enabled?: boolean | null
          tpi_high_threshold?: number | null
          tpi_low_threshold?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      stq_training_logs: {
        Row: {
          accuracy_after: number | null
          accuracy_before: number | null
          created_at: string
          data_points_processed: number | null
          duration_ms: number | null
          error_message: string | null
          exam_types_trained: string[] | null
          id: string
          model_version: string
          status: string | null
          training_type: string | null
          triggered_by: string | null
        }
        Insert: {
          accuracy_after?: number | null
          accuracy_before?: number | null
          created_at?: string
          data_points_processed?: number | null
          duration_ms?: number | null
          error_message?: string | null
          exam_types_trained?: string[] | null
          id?: string
          model_version: string
          status?: string | null
          training_type?: string | null
          triggered_by?: string | null
        }
        Update: {
          accuracy_after?: number | null
          accuracy_before?: number | null
          created_at?: string
          data_points_processed?: number | null
          duration_ms?: number | null
          error_message?: string | null
          exam_types_trained?: string[] | null
          id?: string
          model_version?: string
          status?: string | null
          training_type?: string | null
          triggered_by?: string | null
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
      study_pod_members: {
        Row: {
          id: string
          joined_at: string
          pod_id: string
          role: string | null
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          pod_id: string
          role?: string | null
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          pod_id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_pod_members_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "study_pods"
            referencedColumns: ["id"]
          },
        ]
      }
      study_pod_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_ai_message: boolean | null
          pod_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_ai_message?: boolean | null
          pod_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_ai_message?: boolean | null
          pod_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_pod_messages_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "study_pods"
            referencedColumns: ["id"]
          },
        ]
      }
      study_pods: {
        Row: {
          ai_matching_criteria: Json | null
          created_at: string
          created_by: string | null
          description: string | null
          difficulty_level: string | null
          exam_type: string | null
          id: string
          is_active: boolean | null
          is_ai_created: boolean | null
          max_members: number | null
          name: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          ai_matching_criteria?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          difficulty_level?: string | null
          exam_type?: string | null
          id?: string
          is_active?: boolean | null
          is_ai_created?: boolean | null
          max_members?: number | null
          name: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          ai_matching_criteria?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          difficulty_level?: string | null
          exam_type?: string | null
          id?: string
          is_active?: boolean | null
          is_ai_created?: boolean | null
          max_members?: number | null
          name?: string
          subject?: string | null
          updated_at?: string
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
          trial_days: number | null
          updated_at: string
          yearly_price: number | null
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
          trial_days?: number | null
          updated_at?: string
          yearly_price?: number | null
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
          trial_days?: number | null
          updated_at?: string
          yearly_price?: number | null
        }
        Relationships: []
      }
      sureshot_admin_config: {
        Row: {
          calm_mode_enabled: boolean
          dataset_size: number
          display_threshold: number
          exam_mode_enabled: boolean
          id: string
          last_retrain_at: string | null
          model_version: string
          prediction_accuracy: number | null
          prediction_max_score: number
          prediction_min_score: number
          rapid_mode_enabled: boolean
          retrain_interval_days: number
          show_research_button: boolean
          updated_at: string
          updated_by: string | null
          weight_difficulty_alignment: number
          weight_examiner_behavior: number
          weight_historical_frequency: number
          weight_semantic_similarity: number
          weight_time_series: number
          weight_trend_momentum: number
        }
        Insert: {
          calm_mode_enabled?: boolean
          dataset_size?: number
          display_threshold?: number
          exam_mode_enabled?: boolean
          id?: string
          last_retrain_at?: string | null
          model_version?: string
          prediction_accuracy?: number | null
          prediction_max_score?: number
          prediction_min_score?: number
          rapid_mode_enabled?: boolean
          retrain_interval_days?: number
          show_research_button?: boolean
          updated_at?: string
          updated_by?: string | null
          weight_difficulty_alignment?: number
          weight_examiner_behavior?: number
          weight_historical_frequency?: number
          weight_semantic_similarity?: number
          weight_time_series?: number
          weight_trend_momentum?: number
        }
        Update: {
          calm_mode_enabled?: boolean
          dataset_size?: number
          display_threshold?: number
          exam_mode_enabled?: boolean
          id?: string
          last_retrain_at?: string | null
          model_version?: string
          prediction_accuracy?: number | null
          prediction_max_score?: number
          prediction_min_score?: number
          rapid_mode_enabled?: boolean
          retrain_interval_days?: number
          show_research_button?: boolean
          updated_at?: string
          updated_by?: string | null
          weight_difficulty_alignment?: number
          weight_examiner_behavior?: number
          weight_historical_frequency?: number
          weight_semantic_similarity?: number
          weight_time_series?: number
          weight_trend_momentum?: number
        }
        Relationships: []
      }
      sureshot_prediction_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
        }
        Relationships: []
      }
      syllabus_taxonomies: {
        Row: {
          created_at: string
          exam_type: string
          hierarchy_level: number
          id: string
          metadata: Json | null
          normalized_name: string
          parent_id: string | null
          source: string | null
          subject: string
          subtopic: string | null
          topic: string
          updated_at: string
          weightage_pct: number | null
        }
        Insert: {
          created_at?: string
          exam_type?: string
          hierarchy_level?: number
          id?: string
          metadata?: Json | null
          normalized_name: string
          parent_id?: string | null
          source?: string | null
          subject: string
          subtopic?: string | null
          topic: string
          updated_at?: string
          weightage_pct?: number | null
        }
        Update: {
          created_at?: string
          exam_type?: string
          hierarchy_level?: number
          id?: string
          metadata?: Json | null
          normalized_name?: string
          parent_id?: string | null
          source?: string | null
          subject?: string
          subtopic?: string | null
          topic?: string
          updated_at?: string
          weightage_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "syllabus_taxonomies_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "syllabus_taxonomies"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_practice_sets: {
        Row: {
          ai_generated: boolean | null
          assigned_to: string[] | null
          avg_score: number | null
          completion_count: number | null
          created_at: string | null
          difficulty: string | null
          due_date: string | null
          id: string
          institution_id: string | null
          question_count: number | null
          questions: Json | null
          status: string | null
          subject: string
          teacher_id: string
          title: string
          topics: string[] | null
          updated_at: string | null
        }
        Insert: {
          ai_generated?: boolean | null
          assigned_to?: string[] | null
          avg_score?: number | null
          completion_count?: number | null
          created_at?: string | null
          difficulty?: string | null
          due_date?: string | null
          id?: string
          institution_id?: string | null
          question_count?: number | null
          questions?: Json | null
          status?: string | null
          subject: string
          teacher_id: string
          title: string
          topics?: string[] | null
          updated_at?: string | null
        }
        Update: {
          ai_generated?: boolean | null
          assigned_to?: string[] | null
          avg_score?: number | null
          completion_count?: number | null
          created_at?: string | null
          difficulty?: string | null
          due_date?: string | null
          id?: string
          institution_id?: string | null
          question_count?: number | null
          questions?: Json | null
          status?: string | null
          subject?: string
          teacher_id?: string
          title?: string
          topics?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_practice_sets_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_decay_models: {
        Row: {
          ai_reasoning: string | null
          avg_answer_latency_ms: number | null
          computed_at: string
          computed_decay_rate: number | null
          created_at: string
          error_severity_score: number | null
          id: string
          initial_mastery: number | null
          next_optimal_review: string | null
          predicted_retention: number | null
          recall_strength: number | null
          time_gap_hours: number | null
          topic_id: string | null
          user_id: string
        }
        Insert: {
          ai_reasoning?: string | null
          avg_answer_latency_ms?: number | null
          computed_at?: string
          computed_decay_rate?: number | null
          created_at?: string
          error_severity_score?: number | null
          id?: string
          initial_mastery?: number | null
          next_optimal_review?: string | null
          predicted_retention?: number | null
          recall_strength?: number | null
          time_gap_hours?: number | null
          topic_id?: string | null
          user_id: string
        }
        Update: {
          ai_reasoning?: string | null
          avg_answer_latency_ms?: number | null
          computed_at?: string
          computed_decay_rate?: number | null
          created_at?: string
          error_severity_score?: number | null
          id?: string
          initial_mastery?: number | null
          next_optimal_review?: string | null
          predicted_retention?: number | null
          recall_strength?: number | null
          time_gap_hours?: number | null
          topic_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topic_decay_models_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_probability_index: {
        Row: {
          appearance_years: number[] | null
          computed_at: string
          confidence: number | null
          created_at: string
          data_points_used: number | null
          difficulty_score: number | null
          exam_type: string
          frequency_score: number | null
          id: string
          last_appeared_year: number | null
          model_version: string | null
          prediction_year: number
          recency_score: number | null
          subject: string
          subtopic: string | null
          taxonomy_id: string | null
          topic: string
          tpi_score: number
          trend_momentum_score: number | null
          updated_at: string
          volatility_score: number | null
        }
        Insert: {
          appearance_years?: number[] | null
          computed_at?: string
          confidence?: number | null
          created_at?: string
          data_points_used?: number | null
          difficulty_score?: number | null
          exam_type: string
          frequency_score?: number | null
          id?: string
          last_appeared_year?: number | null
          model_version?: string | null
          prediction_year?: number
          recency_score?: number | null
          subject: string
          subtopic?: string | null
          taxonomy_id?: string | null
          topic: string
          tpi_score?: number
          trend_momentum_score?: number | null
          updated_at?: string
          volatility_score?: number | null
        }
        Update: {
          appearance_years?: number[] | null
          computed_at?: string
          confidence?: number | null
          created_at?: string
          data_points_used?: number | null
          difficulty_score?: number | null
          exam_type?: string
          frequency_score?: number | null
          id?: string
          last_appeared_year?: number | null
          model_version?: string | null
          prediction_year?: number
          recency_score?: number | null
          subject?: string
          subtopic?: string | null
          taxonomy_id?: string | null
          topic?: string
          tpi_score?: number
          trend_momentum_score?: number | null
          updated_at?: string
          volatility_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "topic_probability_index_taxonomy_id_fkey"
            columns: ["taxonomy_id"]
            isOneToOne: false
            referencedRelation: "syllabus_taxonomies"
            referencedColumns: ["id"]
          },
        ]
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
      user_autopilot_preferences: {
        Row: {
          autopilot_enabled: boolean
          created_at: string
          id: string
          max_sessions_per_day: number | null
          preferred_intensity: string | null
          quiet_hours_end: number | null
          quiet_hours_start: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          autopilot_enabled?: boolean
          created_at?: string
          id?: string
          max_sessions_per_day?: number | null
          preferred_intensity?: string | null
          quiet_hours_end?: number | null
          quiet_hours_start?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          autopilot_enabled?: boolean
          created_at?: string
          id?: string
          max_sessions_per_day?: number | null
          preferred_intensity?: string | null
          quiet_hours_end?: number | null
          quiet_hours_start?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      user_engagement_patterns: {
        Row: {
          avg_response_time_seconds: number | null
          click_rate: number | null
          day_of_week: number
          engagement_count: number
          engagement_type: string
          hour_of_day: number
          id: string
          last_engaged_at: string | null
          open_rate: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_response_time_seconds?: number | null
          click_rate?: number | null
          day_of_week: number
          engagement_count?: number
          engagement_type?: string
          hour_of_day: number
          id?: string
          last_engaged_at?: string | null
          open_rate?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_response_time_seconds?: number | null
          click_rate?: number | null
          day_of_week?: number
          engagement_count?: number
          engagement_type?: string
          hour_of_day?: number
          id?: string
          last_engaged_at?: string | null
          open_rate?: number | null
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
      user_settings: {
        Row: {
          created_at: string
          id: string
          preferred_language: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          preferred_language?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          preferred_language?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          amount: number | null
          billing_cycle: string | null
          created_at: string
          currency: string | null
          expires_at: string | null
          id: string
          is_trial: boolean | null
          plan_id: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_signature: string | null
          status: string
          trial_end_date: string | null
          trial_start_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          billing_cycle?: string | null
          created_at?: string
          currency?: string | null
          expires_at?: string | null
          id?: string
          is_trial?: boolean | null
          plan_id?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          status?: string
          trial_end_date?: string | null
          trial_start_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number | null
          billing_cycle?: string | null
          created_at?: string
          currency?: string | null
          expires_at?: string | null
          id?: string
          is_trial?: boolean | null
          plan_id?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          status?: string
          trial_end_date?: string | null
          trial_start_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      voice_notification_logs: {
        Row: {
          ai_generated: boolean
          context: Json | null
          created_at: string
          error_message: string | null
          id: string
          language: string
          played_at: string | null
          status: string
          template_id: string | null
          tone: string
          trigger_key: string | null
          user_id: string
          voice_id: string | null
          voice_text: string
        }
        Insert: {
          ai_generated?: boolean
          context?: Json | null
          created_at?: string
          error_message?: string | null
          id?: string
          language?: string
          played_at?: string | null
          status?: string
          template_id?: string | null
          tone?: string
          trigger_key?: string | null
          user_id: string
          voice_id?: string | null
          voice_text: string
        }
        Update: {
          ai_generated?: boolean
          context?: Json | null
          created_at?: string
          error_message?: string | null
          id?: string
          language?: string
          played_at?: string | null
          status?: string
          template_id?: string | null
          tone?: string
          trigger_key?: string | null
          user_id?: string
          voice_id?: string | null
          voice_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_notification_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "voice_notification_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_notification_queue: {
        Row: {
          context: Json | null
          created_at: string
          error_message: string | null
          id: string
          max_retries: number
          retry_count: number
          scheduled_at: string
          status: string
          template_id: string | null
          trigger_key: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          context?: Json | null
          created_at?: string
          error_message?: string | null
          id?: string
          max_retries?: number
          retry_count?: number
          scheduled_at?: string
          status?: string
          template_id?: string | null
          trigger_key?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          context?: Json | null
          created_at?: string
          error_message?: string | null
          id?: string
          max_retries?: number
          retry_count?: number
          scheduled_at?: string
          status?: string
          template_id?: string | null
          trigger_key?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_notification_queue_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "voice_notification_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_notification_templates: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          language: string
          name: string
          tone: string
          updated_at: string
          variables: string[] | null
          voice_id: string | null
          voice_text: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          language?: string
          name: string
          tone?: string
          updated_at?: string
          variables?: string[] | null
          voice_id?: string | null
          voice_text: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          language?: string
          name?: string
          tone?: string
          updated_at?: string
          variables?: string[] | null
          voice_id?: string | null
          voice_text?: string
        }
        Relationships: []
      }
      voice_notification_triggers: {
        Row: {
          category: string
          conditions: Json | null
          cooldown_minutes: number
          created_at: string
          default_language: string
          default_tone: string
          description: string | null
          display_name: string
          id: string
          is_enabled: boolean
          priority: string
          template_id: string | null
          trigger_key: string
          updated_at: string
          use_ai_content: boolean
        }
        Insert: {
          category?: string
          conditions?: Json | null
          cooldown_minutes?: number
          created_at?: string
          default_language?: string
          default_tone?: string
          description?: string | null
          display_name: string
          id?: string
          is_enabled?: boolean
          priority?: string
          template_id?: string | null
          trigger_key: string
          updated_at?: string
          use_ai_content?: boolean
        }
        Update: {
          category?: string
          conditions?: Json | null
          cooldown_minutes?: number
          created_at?: string
          default_language?: string
          default_tone?: string
          description?: string | null
          display_name?: string
          id?: string
          is_enabled?: boolean
          priority?: string
          template_id?: string | null
          trigger_key?: string
          updated_at?: string
          use_ai_content?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "voice_notification_triggers_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "voice_notification_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      weakness_predictions: {
        Row: {
          ai_reasoning: string | null
          computed_at: string
          created_at: string
          failure_probability: number
          id: string
          reinforcement_date: string | null
          reinforcement_scheduled: boolean | null
          risk_factors: Json | null
          topic_id: string | null
          topic_name: string
          user_id: string
        }
        Insert: {
          ai_reasoning?: string | null
          computed_at?: string
          created_at?: string
          failure_probability?: number
          id?: string
          reinforcement_date?: string | null
          reinforcement_scheduled?: boolean | null
          risk_factors?: Json | null
          topic_id?: string | null
          topic_name: string
          user_id: string
        }
        Update: {
          ai_reasoning?: string | null
          computed_at?: string
          created_at?: string
          failure_probability?: number
          id?: string
          reinforcement_date?: string | null
          reinforcement_scheduled?: boolean | null
          risk_factors?: Json | null
          topic_id?: string | null
          topic_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "weakness_predictions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_deliveries: {
        Row: {
          delivered_at: string | null
          event_type: string
          id: string
          latency_ms: number | null
          payload: Json
          response_body: string | null
          status_code: number | null
          webhook_id: string
        }
        Insert: {
          delivered_at?: string | null
          event_type: string
          id?: string
          latency_ms?: number | null
          payload: Json
          response_body?: string | null
          status_code?: number | null
          webhook_id: string
        }
        Update: {
          delivered_at?: string | null
          event_type?: string
          id?: string
          latency_ms?: number | null
          payload?: Json
          response_body?: string | null
          status_code?: number | null
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhook_endpoints"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_endpoints: {
        Row: {
          api_key_id: string | null
          created_at: string | null
          events: string[]
          failure_count: number | null
          id: string
          institution_id: string | null
          is_active: boolean | null
          last_status_code: number | null
          last_triggered_at: string | null
          secret: string
          updated_at: string | null
          url: string
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string | null
          events?: string[]
          failure_count?: number | null
          id?: string
          institution_id?: string | null
          is_active?: boolean | null
          last_status_code?: number | null
          last_triggered_at?: string | null
          secret: string
          updated_at?: string | null
          url: string
        }
        Update: {
          api_key_id?: string | null
          created_at?: string | null
          events?: string[]
          failure_count?: number | null
          id?: string
          institution_id?: string | null
          is_active?: boolean | null
          last_status_code?: number | null
          last_triggered_at?: string | null
          secret?: string
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_endpoints_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_endpoints_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_cost_tracking: {
        Row: {
          category: string | null
          cost_per_message: number | null
          created_at: string
          currency: string | null
          date: string
          id: string
          messages_delivered: number | null
          messages_failed: number | null
          messages_read: number | null
          messages_sent: number | null
          provider: string | null
          total_cost: number | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          cost_per_message?: number | null
          created_at?: string
          currency?: string | null
          date?: string
          id?: string
          messages_delivered?: number | null
          messages_failed?: number | null
          messages_read?: number | null
          messages_sent?: number | null
          provider?: string | null
          total_cost?: number | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          cost_per_message?: number | null
          created_at?: string
          currency?: string | null
          date?: string
          id?: string
          messages_delivered?: number | null
          messages_failed?: number | null
          messages_read?: number | null
          messages_sent?: number | null
          provider?: string | null
          total_cost?: number | null
          updated_at?: string
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
      whatsapp_queue: {
        Row: {
          category: string | null
          created_at: string
          error_message: string | null
          id: string
          max_retries: number | null
          media_url: string | null
          message_body: string
          priority: string
          retry_count: number | null
          scheduled_at: string
          sent_at: string | null
          status: string
          template_name: string | null
          template_params: Json | null
          to_number: string
          trigger_key: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          max_retries?: number | null
          media_url?: string | null
          message_body: string
          priority?: string
          retry_count?: number | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          template_name?: string | null
          template_params?: Json | null
          to_number: string
          trigger_key?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          max_retries?: number | null
          media_url?: string | null
          message_body?: string
          priority?: string
          retry_count?: number | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          template_name?: string | null
          template_params?: Json | null
          to_number?: string
          trigger_key?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
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
          twilio_content_sid: string | null
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
          twilio_content_sid?: string | null
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
          twilio_content_sid?: string | null
          updated_at?: string
          variables?: string[] | null
        }
        Relationships: []
      }
      whatsapp_triggers: {
        Row: {
          category: string
          conditions: Json
          cooldown_minutes: number | null
          created_at: string
          description: string | null
          display_name: string
          id: string
          is_enabled: boolean
          last_triggered_at: string | null
          meta_template_id: string | null
          priority: string
          schedule_cron: string | null
          schedule_type: string
          target_filter: Json | null
          template_name: string | null
          total_delivered: number | null
          total_failed: number | null
          total_sent: number | null
          trigger_key: string
          updated_at: string
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
          last_triggered_at?: string | null
          meta_template_id?: string | null
          priority?: string
          schedule_cron?: string | null
          schedule_type?: string
          target_filter?: Json | null
          template_name?: string | null
          total_delivered?: number | null
          total_failed?: number | null
          total_sent?: number | null
          trigger_key: string
          updated_at?: string
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
          last_triggered_at?: string | null
          meta_template_id?: string | null
          priority?: string
          schedule_cron?: string | null
          schedule_type?: string
          target_filter?: Json | null
          template_name?: string | null
          total_delivered?: number | null
          total_failed?: number | null
          total_sent?: number | null
          trigger_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      whitelabel_branding: {
        Row: {
          accent_color: string | null
          app_title: string | null
          created_at: string
          custom_css: string | null
          email_logo_url: string | null
          email_reply_to: string | null
          email_sender_address: string | null
          email_sender_name: string | null
          favicon_url: string | null
          font_family: string | null
          id: string
          institution_id: string
          logo_dark_url: string | null
          logo_url: string | null
          primary_color: string
          privacy_url: string | null
          secondary_color: string
          support_email: string | null
          support_url: string | null
          tagline: string | null
          terms_url: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          app_title?: string | null
          created_at?: string
          custom_css?: string | null
          email_logo_url?: string | null
          email_reply_to?: string | null
          email_sender_address?: string | null
          email_sender_name?: string | null
          favicon_url?: string | null
          font_family?: string | null
          id?: string
          institution_id: string
          logo_dark_url?: string | null
          logo_url?: string | null
          primary_color?: string
          privacy_url?: string | null
          secondary_color?: string
          support_email?: string | null
          support_url?: string | null
          tagline?: string | null
          terms_url?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          app_title?: string | null
          created_at?: string
          custom_css?: string | null
          email_logo_url?: string | null
          email_reply_to?: string | null
          email_sender_address?: string | null
          email_sender_name?: string | null
          favicon_url?: string | null
          font_family?: string | null
          id?: string
          institution_id?: string
          logo_dark_url?: string | null
          logo_url?: string | null
          primary_color?: string
          privacy_url?: string | null
          secondary_color?: string
          support_email?: string | null
          support_url?: string | null
          tagline?: string | null
          terms_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whitelabel_branding_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: true
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      whitelabel_contracts: {
        Row: {
          annual_fee: number | null
          auto_renew: boolean | null
          billing_cycle: string
          contract_number: string
          contract_type: string
          created_at: string
          expires_at: string | null
          id: string
          institution_id: string
          monthly_fee: number
          notes: string | null
          setup_fee: number | null
          signed_at: string | null
          signed_by: string | null
          sla_support_response_hours: number | null
          sla_tier: string | null
          sla_uptime_guarantee: number | null
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          annual_fee?: number | null
          auto_renew?: boolean | null
          billing_cycle?: string
          contract_number: string
          contract_type?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          institution_id: string
          monthly_fee?: number
          notes?: string | null
          setup_fee?: number | null
          signed_at?: string | null
          signed_by?: string | null
          sla_support_response_hours?: number | null
          sla_tier?: string | null
          sla_uptime_guarantee?: number | null
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          annual_fee?: number | null
          auto_renew?: boolean | null
          billing_cycle?: string
          contract_number?: string
          contract_type?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          institution_id?: string
          monthly_fee?: number
          notes?: string | null
          setup_fee?: number | null
          signed_at?: string | null
          signed_by?: string | null
          sla_support_response_hours?: number | null
          sla_tier?: string | null
          sla_uptime_guarantee?: number | null
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whitelabel_contracts_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      whitelabel_domains: {
        Row: {
          created_at: string
          domain: string
          domain_type: string
          id: string
          institution_id: string
          is_primary: boolean | null
          ssl_status: string | null
          subdomain: string | null
          updated_at: string
          verification_status: string
          verification_token: string | null
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          domain: string
          domain_type?: string
          id?: string
          institution_id: string
          is_primary?: boolean | null
          ssl_status?: string | null
          subdomain?: string | null
          updated_at?: string
          verification_status?: string
          verification_token?: string | null
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          domain?: string
          domain_type?: string
          id?: string
          institution_id?: string
          is_primary?: boolean | null
          ssl_status?: string | null
          subdomain?: string | null
          updated_at?: string
          verification_status?: string
          verification_token?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whitelabel_domains_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      whitelabel_features: {
        Row: {
          category: string
          config: Json | null
          created_at: string
          feature_key: string
          feature_label: string
          id: string
          institution_id: string
          is_enabled: boolean
          updated_at: string
        }
        Insert: {
          category?: string
          config?: Json | null
          created_at?: string
          feature_key: string
          feature_label: string
          id?: string
          institution_id: string
          is_enabled?: boolean
          updated_at?: string
        }
        Update: {
          category?: string
          config?: Json | null
          created_at?: string
          feature_key?: string
          feature_label?: string
          id?: string
          institution_id?: string
          is_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whitelabel_features_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_freeze_gift: { Args: { gift_id: string }; Returns: undefined }
      cleanup_rate_limits: { Args: never; Returns: undefined }
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
      delivery_status:
        | "pending"
        | "processing"
        | "delivered"
        | "failed"
        | "skipped"
        | "opted_out"
      notification_channel: "push" | "whatsapp" | "email" | "voice" | "in_app"
      notification_priority: "critical" | "high" | "medium" | "low"
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
      delivery_status: [
        "pending",
        "processing",
        "delivered",
        "failed",
        "skipped",
        "opted_out",
      ],
      notification_channel: ["push", "whatsapp", "email", "voice", "in_app"],
      notification_priority: ["critical", "high", "medium", "low"],
    },
  },
} as const
