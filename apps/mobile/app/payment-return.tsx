import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { RequireAuth } from '../components/RequireAuth';
import { Button, Screen, StateView } from '../components/ui';
import { paymentOrderId, paymentReturnPath } from '../features/links/deep-links';
import { OrderDetail } from './orders/[id]';

// URLs choose only a validated identifier. Payment state is read from the
// owner-scoped API; paid/status/token fields never enter a payment mutation.
export default function PaymentReturnScreen() {
  const params = useLocalSearchParams<{ orderId?: string | string[]; id?: string | string[] }>();
  const router = useRouter();
  const { t } = useTranslation('commerce');
  const id = paymentOrderId(params);
  const returnTo = paymentReturnPath(params);
  if (!id || !returnTo) return <Screen>
    <StateView kind="error" title={t('invalidOrder')} />
    <Button title={t('orders')} onPress={() => router.replace('/orders')} />
  </Screen>;
  return <RequireAuth returnTo={returnTo}><OrderDetail id={id} returned /></RequireAuth>;
}