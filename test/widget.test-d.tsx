// Compiles only if index.d.ts lets a widget use every part of the SDK the way the docs show.
import { useState } from 'react';
import {
  API_VERSION,
  ColorField,
  definePanel,
  defineWidget,
  ImageCanvas,
  NumberField,
  PanelSettings,
  PanelStatus,
  SelectField,
  SettingsSection,
  SliderField,
  TextField,
  ToggleField,
  TopicInput,
  TreeField,
  TreeSection,
  usePanelVisible,
  useTF,
  useTopic,
  type ImageFrame,
  type MitiClient,
  type PanelProps,
} from '@miti/sdk';

const version: 1 = API_VERSION;

interface Config {
  topic: string;
  mode: 'a' | 'b';
  gain: number;
  color: string;
  on: boolean;
}

function Everything({ client, topics, config, updateConfig, setConfig }: PanelProps<Config>) {
  const { data, lastUpdate } = useTopic<{ data: number }>(
    client,
    config.topic,
    'std_msgs/msg/Float64',
    {
      throttleRate: 100,
      maxRate: 10,
    }
  );
  const { tfTree } = useTF({ client, tfTopics: ['/tf'] });
  const visible = usePanelVisible();
  const [answer, setAnswer] = useState<unknown>(null);
  const call = (c: MitiClient) => c.callService('/robot/enable', {}).then(setAnswer);
  const draw = (context: CanvasRenderingContext2D, frame: ImageFrame) =>
    context.strokeRect(0, 0, frame.width / 2, frame.height / 2);
  return (
    <div>
      <p>
        {data?.data} {lastUpdate?.toISOString()} {tfTree.frames.size} {String(visible)}
        {String(answer)}
      </p>
      <button onClick={() => client && call(client)}>Enable</button>
      <button onClick={() => client?.publish('/cmd', { data: 'go' })}>Go</button>
      <ImageCanvas client={client} topic="/camera/image" maxFps={5} draw={draw} redraw={data} />
      <PanelStatus>{config.mode}</PanelStatus>
      <PanelSettings>
        <TreeSection title="General" keywords="topic">
          <TreeField label="Topic">
            <TopicInput
              value={config.topic}
              topics={topics}
              onCommit={(topic) => updateConfig({ topic })}
            />
          </TreeField>
          <SelectField
            label="Mode"
            value={config.mode}
            options={[
              { value: 'a', label: 'A' },
              { value: 'b', label: 'B' },
            ]}
            onChange={(mode) => updateConfig({ mode })}
          />
          <NumberField
            label="Gain"
            value={config.gain}
            onCommit={(gain) => updateConfig({ gain })}
          />
          <SliderField
            label="Gain"
            value={config.gain}
            min={0}
            max={1}
            onChange={(gain) => updateConfig({ gain })}
          />
          <ColorField
            label="Color"
            value={config.color}
            onChange={(color) => updateConfig({ color })}
          />
          <ToggleField label="On" value={config.on} onChange={(on) => updateConfig({ on })} />
          <TextField
            label="Raw"
            value={config.topic}
            onCommit={(topic) => setConfig({ ...config, topic })}
          />
        </TreeSection>
        <SettingsSection title="More">{version}</SettingsSection>
      </PanelSettings>
    </div>
  );
}

export default defineWidget({
  panels: [
    definePanel<Config>({
      type: 'test.everything/everything',
      label: 'Everything',
      defaultConfig: () => ({ topic: '/x', mode: 'a', gain: 0.5, color: '#2fb4c4', on: true }),
      normalizeConfig: (stored) => stored as Config,
      component: Everything,
    }),
  ],
});
