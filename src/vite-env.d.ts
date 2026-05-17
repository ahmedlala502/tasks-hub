/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_MASTER_ADMIN_EMAIL?: string;
  readonly VITE_MASTER_ADMIN_PASSWORD?: string;
  readonly VITE_STREAMLIT_DASHBOARD_URL?: string;
  readonly VITE_DROPBOX_REPORT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
