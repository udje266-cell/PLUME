import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.plume.app',
  appName: 'PLUME',
  webDir: 'dist',
  // Évite que le contenu passe sous l'encoche / la barre d'état (safe areas).
  // L'app étant une web-app, on garde le WebView en plein écran mais on gère le
  // padding via CSS env(safe-area-inset-*).
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#0E0E14',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0E0E14',
    },
  },
};

export default config;
