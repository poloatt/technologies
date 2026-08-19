/** Configuración centralizada PWA — fuente única para UI compartida (manifests viven en cada app). */

export const PWA_DISMISS_KEY = 'attadia_pwa_install_dismissed';

/** Metadatos por app para banners, preferencias y taskbar. */
export const PWA_APPS = {
  caja: { label: 'Caja', themeColor: '#16a34a' },
  foco: { label: 'Foco', themeColor: '#2563eb' },
  pulso: { label: 'Pulso', themeColor: '#dc2626' },
};

export function getPwaAppMeta(appKey) {
  return PWA_APPS[appKey] || {};
}
