import { useState } from 'react';
import { Gauge } from 'lucide-react';
import { definePanel, defineWidget, useTopic, type PanelProps } from '@miti/sdk';

function Count({ client, config }: PanelProps<{ topic: string }>) {
  const { data } = useTopic(client, config.topic);
  const [clicks, setClicks] = useState(0);
  return (
    <button onClick={() => setClicks(clicks + 1)}>
      {clicks} {JSON.stringify(data)}
    </button>
  );
}

export default defineWidget({
  panels: [
    definePanel({
      type: 'test.fixture/count',
      label: 'Count',
      icon: Gauge,
      defaultConfig: () => ({ topic: '/count' }),
      component: Count,
    }),
  ],
});
