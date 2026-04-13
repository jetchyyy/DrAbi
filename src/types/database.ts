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
      clinic_settings: {
        Row: {
          id: string;
          clinic_name: string;
          legal_name: string;
          short_code: string;
          address: string;
          contact_number: string;
          email: string;
          website: string;
          logo_url: string | null;
          primary_color: string;
          accent_color: string;
          booking_lead_days: number;
          booking_cancellation_hours: number;
          appointment_slot_minutes: number;
          operating_hours: Json;
          system_enabled: boolean;
          system_message: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['clinic_settings']['Row']>;
        Update: Partial<Database['public']['Tables']['clinic_settings']['Row']>;
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          role: string;
          phone: string | null;
          title: string | null;
          security_pin_hash: string | null;
          pin_updated_at: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          role?: string;
          phone?: string | null;
          title?: string | null;
          security_pin_hash?: string | null;
          pin_updated_at?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      specialties: {
        Row: {
          id: string;
          name: string;
          description: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Partial<Database['public']['Tables']['specialties']['Row']>;
        Update: Partial<Database['public']['Tables']['specialties']['Row']>;
      };
      services: {
        Row: {
          id: string;
          service_type: string;
          name: string;
          description: string;
          price: number;
          duration_minutes: number;
          specialty_id: string | null;
          is_bookable: boolean;
          delivery_mode: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Partial<Database['public']['Tables']['services']['Row']>;
        Update: Partial<Database['public']['Tables']['services']['Row']>;
      };
      doctors: {
        Row: {
          id: string;
          profile_id: string;
          license_number: string | null;
          license_expiry: string | null;
          bir_number: string | null;
          prc_id_path: string | null;
          consultation_fee: number;
          follow_up_fee: number;
          specialty_id: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Partial<Database['public']['Tables']['doctors']['Row']>;
        Update: Partial<Database['public']['Tables']['doctors']['Row']>;
      };
      doctor_availability: {
        Row: {
          id: string;
          doctor_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          slot_minutes: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['doctor_availability']['Row']>;
        Update: Partial<Database['public']['Tables']['doctor_availability']['Row']>;
      };
      patients: {
        Row: {
          id: string;
          user_id: string | null;
          qr_code: string;
          intake_source: string;
          visit_status: string;
          first_name: string;
          last_name: string;
          sex: string;
          birth_date: string;
          mobile_number: string | null;
          email: string | null;
          address: string | null;
          blood_type: string | null;
          allergies: string;
          medical_history: string;
          emergency_contact_name: string | null;
          emergency_contact_phone: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          user_id?: string | null;
          qr_code?: string;
          intake_source?: string;
          visit_status?: string;
          first_name: string;
          last_name: string;
          sex: string;
          birth_date: string;
          mobile_number?: string | null;
          email?: string | null;
          address?: string | null;
          blood_type?: string | null;
          allergies?: string;
          medical_history?: string;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
        };
        Update: Partial<Database['public']['Tables']['patients']['Insert']>;
      };
      bookings: {
        Row: {
          id: string;
          patient_id: string;
          service_id: string;
          doctor_id: string | null;
          preferred_date: string;
          preferred_time: string;
          status: string;
          intake_notes: string;
          fee_type: string;
          fee_amount: number;
          receipt_code: string | null;
          payment_status: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          patient_id: string;
          service_id: string;
          doctor_id?: string | null;
          preferred_date: string;
          preferred_time: string;
          status?: string;
          intake_notes?: string;
          fee_type?: string;
          fee_amount?: number;
          receipt_code?: string | null;
          payment_status?: string;
        };
        Update: Partial<Database['public']['Tables']['bookings']['Insert']>;
      };
      referrals: {
        Row: {
          id: string;
          patient_id: string;
          appointment_id: string | null;
          source_appointment_id: string | null;
          source_consultation_id: string | null;
          referring_doctor_id: string;
          referring_generalist_id: string | null;
          target_doctor_id: string | null;
          assigned_specialist_id: string | null;
          target_specialty_id: string | null;
          appointment_date: string | null;
          appointment_time: string | null;
          reason: string;
          clinical_summary: string;
          referral_notes: string;
          generalist_notes: string;
          practice_location: Json;
          specialist_schedule_id: string | null;
          status: string;
          specialist_findings: string;
          specialist_recommendations: string;
          referred_at: string;
          specialist_visited_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          patient_id: string;
          appointment_id?: string | null;
          source_appointment_id?: string | null;
          source_consultation_id?: string | null;
          referring_doctor_id: string;
          referring_generalist_id?: string | null;
          target_doctor_id?: string | null;
          assigned_specialist_id?: string | null;
          target_specialty_id?: string | null;
          appointment_date?: string | null;
          appointment_time?: string | null;
          reason: string;
          clinical_summary?: string;
          referral_notes?: string;
          generalist_notes?: string;
          practice_location?: Json;
          specialist_schedule_id?: string | null;
          status?: string;
          specialist_findings?: string;
          specialist_recommendations?: string;
          referred_at?: string;
          specialist_visited_at?: string | null;
          completed_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['referrals']['Insert']>;
      };
      appointments: {
        Row: {
          id: string;
          patient_id: string;
          doctor_id: string | null;
          specialty_id: string | null;
          service_id: string | null;
          booking_id: string | null;
          scheduled_at: string;
          status: string;
          source: string;
          visit_type: string;
          reason: string;
          notes: string;
          teleconsultation_platform: string | null;
          teleconsultation_url: string | null;
          teleconsultation_access_instructions: string | null;
          consultation_id: string | null;
          related_referral_id: string | null;
          completed_by: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Partial<Database['public']['Tables']['appointments']['Row']>;
        Update: Partial<Database['public']['Tables']['appointments']['Row']>;
      };
      specialist_schedules: {
        Row: {
          id: string;
          specialist_id: string;
          recurrence: Json;
          slot_template: Json;
          is_active: boolean;
          valid_from: string | null;
          practice_location: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['specialist_schedules']['Row']>;
        Update: Partial<Database['public']['Tables']['specialist_schedules']['Row']>;
      };
      specialist_appointments: {
        Row: {
          id: string;
          specialist_id: string;
          schedule_id: string | null;
          referral_id: string | null;
          patient_id: string;
          slot_date: string;
          slot_time: string;
          is_booked: boolean;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['specialist_appointments']['Row']>;
        Update: Partial<Database['public']['Tables']['specialist_appointments']['Row']>;
      };
      chat_threads: {
        Row: {
          id: string;
          participant_a: string;
          participant_b: string;
          thread_key: string;
          type: string;
          linked_appointment_id: string | null;
          linked_referral_id: string | null;
          last_message_text: string | null;
          last_message_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['chat_threads']['Row']>;
        Update: Partial<Database['public']['Tables']['chat_threads']['Row']>;
      };
      messages: {
        Row: {
          id: string;
          thread_id: string;
          sender_id: string;
          text: string;
          sent_at: string;
          read_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['messages']['Row']>;
        Update: Partial<Database['public']['Tables']['messages']['Row']>;
      };
      thread_unread: {
        Row: {
          thread_id: string;
          user_id: string;
          unread_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['thread_unread']['Row']>;
        Update: Partial<Database['public']['Tables']['thread_unread']['Row']>;
      };
      consultation_types: {
        Row: {
          id: string;
          code: string;
          name: string;
          description: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['consultation_types']['Row']>;
        Update: Partial<Database['public']['Tables']['consultation_types']['Row']>;
      };
      consultations: {
        Row: {
          id: string;
          appointment_id: string | null;
          patient_id: string;
          doctor_id: string;
          consultation_type: string | null;
          consultation_date: string | null;
          consultation_time: string | null;
          provider_name: string | null;
          clinical_summary: string | null;
          diagnosis: string | null;
          present_illness_history: string | null;
          review_of_symptoms: string | null;
          allergies: string | null;
          vitals: string | null;
          treatment_plan: string | null;
          medications: string | null;
          lab_results: string | null;
          differential_diagnosis: string | null;
          subjective: string;
          objective: string;
          assessment: string;
          plan: string;
          outcome: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['consultations']['Row']>;
        Update: Partial<Database['public']['Tables']['consultations']['Row']>;
      };
      patient_medical_history_entries: {
        Row: {
          id: string;
          patient_id: string;
          consultation_id: string | null;
          appointment_id: string | null;
          provider_id: string | null;
          history_text: string;
          findings_text: string;
          diagnoses_text: string;
          treatment_summary_text: string;
          soap_notes_text: string;
          supplementary_docs_text: string;
          actor: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['patient_medical_history_entries']['Row']>;
        Update: Partial<Database['public']['Tables']['patient_medical_history_entries']['Row']>;
      };
      medical_services_transactions: {
        Row: {
          id: string;
          consultation_id: string | null;
          appointment_id: string | null;
          patient_id: string;
          provider_id: string | null;
          consultation_type: string;
          amount: number;
          actor: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['medical_services_transactions']['Row']>;
        Update: Partial<Database['public']['Tables']['medical_services_transactions']['Row']>;
      };
      prescriptions: {
        Row: {
          id: string;
          consultation_id: string;
          patient_id: string;
          medication: string;
          dosage: string;
          instructions: string;
          prescription_name: string | null;
          instruction: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['prescriptions']['Row']>;
        Update: Partial<Database['public']['Tables']['prescriptions']['Row']>;
      };
    };
  };
}




