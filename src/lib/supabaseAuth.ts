import { supabase } from '../ops/lib/supabase';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { hashPassword, verifyPassword } from './authService';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  office: string;
  country: string;
  team: string;
  isSuperAdmin?: boolean;
}

export class SupabaseAuthService {
  private static instance: SupabaseAuthService;
  private currentSession: Session | null = null;

  static getInstance(): SupabaseAuthService {
    if (!SupabaseAuthService.instance) {
      SupabaseAuthService.instance = new SupabaseAuthService();
    }
    return SupabaseAuthService.instance;
  }

  getSession() {
    return this.currentSession;
  }

  async init() {
    const { data: { session } } = await supabase.auth.getSession();
    this.currentSession = session;

    supabase.auth.onAuthStateChange((_event, session) => {
      this.currentSession = session;
    });
  }

  async signInWithEmailPassword(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: password.trim(),
    });

    if (error) throw error;
    this.currentSession = data.session;
    return data;
  }

  async signUpWithEmailPassword(email: string, password: string, metadata: Record<string, any>) {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password: password.trim(),
      options: {
        data: metadata,
      },
    });

    if (error) throw error;
    return data;
  }

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    this.currentSession = null;
  }

  async updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) throw error;
  }

  async updateUserProfile(metadata: Partial<AuthUser>) {
    const { data, error } = await supabase.auth.updateUser({
      data: metadata,
    });

    if (error) throw error;
    return data;
  }

  getCurrentUser(): SupabaseUser | null {
    return this.currentSession?.user ?? null;
  }

  isAuthenticated(): boolean {
    return this.currentSession !== null;
  }
}

export const supabaseAuth = SupabaseAuthService.getInstance();
