import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { commonResources } from './common';
import { authResources } from '../features/auth/translations';
import { commerceResources } from '../features/commerce/translations';
import { catalogResources } from '../features/catalog/translations';
import { usePreferences } from '../store/preferences';
void i18n.use(initReactI18next).init({
  resources: {
    uz: { common: commonResources.uz, auth: authResources.uz, commerce: commerceResources.uz, catalog: catalogResources.uz },
    ru: { common: commonResources.ru, auth: authResources.ru, commerce: commerceResources.ru, catalog: catalogResources.ru },
  },
  lng: usePreferences.getState().locale, fallbackLng: 'uz', supportedLngs: ['uz', 'ru'],
  defaultNS: 'common', ns: ['common', 'auth', 'commerce', 'catalog'], initAsync: false,
  interpolation: { escapeValue: false }, returnNull: false, react: { useSuspense: false },
});
export default i18n;
