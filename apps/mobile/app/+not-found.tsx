import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Screen, StateView } from '../components/ui';
export default function NotFoundScreen() {
  const { t } = useTranslation('common');
  return <Screen><StateView kind="empty" title={t('notFoundTitle')} message={t('notFoundMessage')} />
    <Button title={t('backHome')} onPress={() => router.replace('/')} /></Screen>;
}
