import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const { VITE_GA_MEASUREMENT_ID = '' } = loadEnv(mode, process.cwd(), 'VITE_GA_MEASUREMENT_ID');
  const configuredId = VITE_GA_MEASUREMENT_ID.trim();
  // Restrict HTML substitution to a GA4 ID, never arbitrary environment content.
  const measurementId = /^G-[A-Z0-9]+$/.test(configuredId) ? configuredId : 'G-XXXXXXXXXX';

  return {
    plugins: [react()],
    envPrefix: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_GA_MEASUREMENT_ID'],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''),
      'import.meta.env.VITE_GA_MEASUREMENT_ID': JSON.stringify(measurementId),
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
    },
    preview: {
      host: '0.0.0.0',
      port: 3000,
    },
  };
});
