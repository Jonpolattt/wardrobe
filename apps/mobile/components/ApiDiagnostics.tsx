import { useState, useSyncExternalStore } from 'react';
import { ScrollView } from 'react-native';
import { API_DIAGNOSTIC_VERSION, readApiTrace, subscribeApiTrace } from '../services/api-diagnostics';
import { configuredApiUrl } from '../services/api';
import { publicEndpoint } from '../services/api-diagnostics';
import { Body, Button, Card } from './ui';

/** Temporary development aid for testing a physical device without an inspector. */
export function ApiDiagnostics() {
  const [open, setOpen] = useState(false);
  const events = useSyncExternalStore(subscribeApiTrace, readApiTrace, readApiTrace);
  if (!__DEV__) return null;
  return <Card>
    <Button title={`API diagnostics · ${API_DIAGNOSTIC_VERSION}`} variant="secondary" onPress={() => setOpen(!open)} />
    {open && <ScrollView style={{ maxHeight: 180 }}>
      <Body selectable style={{ fontSize: 11 }}>{`Endpoint: ${publicEndpoint(configuredApiUrl)}\n${events.map(event => JSON.stringify(event)).join('\n')}`}</Body>
    </ScrollView>}
  </Card>;
}
