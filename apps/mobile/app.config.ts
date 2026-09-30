import type { ConfigContext, ExpoConfig } from 'expo/config';
import { brand, themeColors } from '@wardrobe/theme';

type Variant = 'development' | 'preview' | 'production';

export default ({ config }: ConfigContext): ExpoConfig => {
  const variant = (process.env.WARDROBE_APP_VARIANT ?? 'development') as Variant;
  if (!['development', 'preview', 'production'].includes(variant)) throw new Error('Invalid WARDROBE_APP_VARIANT.');
  // These defaults have not been registered in either app store.
  const suffix = variant === 'production' ? '' : variant === 'preview' ? '.preview' : '.dev';
  const androidPackage = process.env.WARDROBE_ANDROID_PACKAGE ?? `uz.wardrobestore.app${suffix}`;
  const iosBundleIdentifier = process.env.WARDROBE_IOS_BUNDLE_IDENTIFIER ?? `uz.wardrobestore.app${suffix}`;
  for (const id of [androidPackage, iosBundleIdentifier]) {
    if (!/^[A-Za-z][A-Za-z0-9]*(\.[A-Za-z][A-Za-z0-9]*)+$/.test(id)) throw new Error('Native identifiers must use reverse-domain notation.');
  }
  const projectId = process.env.WARDROBE_EAS_PROJECT_ID;
  if (projectId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) {
    throw new Error('WARDROBE_EAS_PROJECT_ID must be a real Expo project UUID.');
  }
  const scheme = process.env.WARDROBE_APP_SCHEME ?? (variant === 'production' ? 'wardrobe' : `wardrobe-${variant}`);
  if (!/^[a-z][a-z0-9+.-]*$/.test(scheme)) throw new Error('WARDROBE_APP_SCHEME must be a valid URL scheme.');
  return {
    ...config,
    name: variant === 'production' ? brand.name : `${brand.name} ${variant === 'preview' ? 'Preview' : 'Dev'}`,
    slug: 'wardrobe', version: '0.1.0', orientation: 'portrait', platforms: ['ios', 'android'],
    scheme,
    userInterfaceStyle: 'automatic', icon: './assets/icon.png',
    ios: { bundleIdentifier: iosBundleIdentifier, supportsTablet: false, infoPlist: { CFBundleAllowMixedLocalizations: true } },
    android: {
      package: androidPackage,
      adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: themeColors.dark.background },
      // Remote images use application cache, not the shared photo/storage library.
      blockedPermissions: [
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        ...(variant === 'production' ? ['android.permission.SYSTEM_ALERT_WINDOW'] : []),
      ],
    },
    plugins: [
      'expo-router', ['expo-secure-store', { faceIDPermission: false }],
      ['expo-localization', { supportedLocales: { ios: ['uz', 'ru'], android: ['uz', 'ru'] } }],
      ['expo-splash-screen', { image: './assets/splash.png', imageWidth: 112, backgroundColor: themeColors.light.background, dark: { image: './assets/splash.png', backgroundColor: themeColors.dark.background } }],
      ['./plugins/withReleasePermissions.cjs', { enabled: variant === 'production' }],
    ],
    experiments: { typedRoutes: true },
    extra: { appVariant: variant, identityStatus: 'provisional-unregistered', ...(projectId ? { eas: { projectId } } : {}) },
  };
};
