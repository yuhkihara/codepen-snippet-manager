export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      snippets: {
        Row: {
          id: string
          owner_id: string
          title: string
          description: string | null
          html: string
          css: string | null
          js: string | null
          is_public: boolean
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          owner_id: string
          title: string
          description?: string | null
          html: string
          css?: string | null
          js?: string | null
          is_public?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          owner_id?: string
          title?: string
          description?: string | null
          html?: string
          css?: string | null
          js?: string | null
          is_public?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      revisions: {
        Row: {
          id: string
          snippet_id: string
          version: number
          html: string
          css: string | null
          js: string | null
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          snippet_id: string
          version: number
          html: string
          css?: string | null
          js?: string | null
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          snippet_id?: string
          version?: number
          html?: string
          css?: string | null
          js?: string | null
          note?: string | null
          created_at?: string
        }
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
  }
}
