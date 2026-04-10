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
          referring_doctor_id: string;
          target_doctor_id: string | null;
          target_specialty_id: string | null;
          reason: string;
          clinical_summary: string;
          referral_notes: string;
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
          referring_doctor_id: string;
          target_doctor_id?: string | null;
          target_specialty_id?: string | null;
          reason: string;
          clinical_summary?: string;
          referral_notes?: string;
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
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Partial<Database['public']['Tables']['appointments']['Row']>;
        Update: Partial<Database['public']['Tables']['appointments']['Row']>;
      };
      consultations: {
        Row: {
          id: string;
          appointment_id: string;
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




