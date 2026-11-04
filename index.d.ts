/**
 * @miti/sdk: what MITI gives a widget's panels, widget API version 1.
 *
 * A widget imports these by name. `miti-widget build` turns each import into a read of the copy
 * MITI runs (its React, hooks and components), so this package holds only their types: running it
 * outside MITI does nothing useful. Within API version 1 everything here keeps working; new things
 * are only added. MITI's own implementation is checked against this file (scripts/check-miti.mjs).
 */
import type { ComponentType, ReactElement, ReactNode } from 'react';

/** The widget API this package describes; a widget declares it as `miti.apiVersion`. */
export declare const API_VERSION: 1;

// ─── The robot connection ────────────────────────────────────────────────────────────────────────

/** A topic the bridge offers. */
export interface TopicInfo {
  topic: string;
  /** Message type, e.g. `sensor_msgs/msg/Image`. */
  type: string;
}

export type MessageCallback = (message: unknown) => void;

export interface SubscribeOptions {
  /** Deliver at most this many messages per second; extras are dropped before decoding. */
  maxRate?: number;
  /** Deliver at most one message per this many ms, the newest. */
  throttleMs?: number;
}

/** The connection to the bridge that a panel is given. */
export interface MitiClient {
  /** Call `callback` with each decoded message of `topic`; prefer `useTopic` in components. */
  subscribe(
    topic: string,
    callback: MessageCallback,
    type?: string,
    options?: SubscribeOptions
  ): void;
  unsubscribe(topic: string, callback?: MessageCallback): void;
  /** Declare a topic to publish on, e.g. `('/cmd', 'std_msgs/msg/String')`. */
  advertise(topic: string, type: string): void;
  /** Publish a message as a plain object; needs the bridge's `clientPublish` capability. */
  publish(topic: string, message: unknown): void;
  /** Call a service; resolves with its response, rejects after 5 s or when it is missing. */
  callService(name: string, request?: unknown): Promise<unknown>;
  /** Read a parameter named `/node.parameter`. */
  getParameter(name: string): Promise<unknown>;
  /** The robot's clock in seconds, when the bridge reports it. */
  getServerTime(): number | null;
  /** E.g. `clientPublish`, `services`, `parameters`. */
  hasCapability(capability: string): boolean;
  getTopics(): TopicInfo[];
  /** Returns a function that stops the callback. */
  onTopicsChanged(callback: (topics: TopicInfo[]) => void): () => void;
  isConnected(): boolean;
}

// ─── Panels and widgets ──────────────────────────────────────────────────────────────────────────

/** What MITI gives a panel's component. */
export interface PanelProps<Config = unknown> {
  /** The panel's id in the layout. */
  id: string;
  /** The panel's settings, as `normalizeConfig` returns them from the saved layout. */
  config: Config;
  /** Merge changes into the settings; they are saved with the layout. */
  updateConfig: (patch: Partial<Config>) => void;
  /** Replace the settings. */
  setConfig: (config: Config) => void;
  /** The connection to the bridge, or null while MITI is not connected. */
  client: MitiClient | null;
  topics: TopicInfo[];
  topicsLoading: boolean;
  refreshTopics: () => void;
}

/** A kind of panel, offered in MITI's Add panel menu. */
export interface PanelDefinition<Config = unknown> {
  /** Saved in layouts, so it never changes: the widget's id, a slash and a name. */
  type: string;
  /** Shown in Add panel and as a new panel's title. */
  label: string;
  description?: string;
  icon?: ComponentType<{ className?: string }>;
  /** Settings of a new panel. */
  defaultConfig?: () => Config;
  /** Settings from a saved layout, which may come from an older version or be missing. */
  normalizeConfig?: (stored: unknown) => Config;
  component: ComponentType<PanelProps<Config>>;
}

/** What a widget's module exports as default. */
export interface WidgetDefinition {
  // Each panel's settings type is checked where it is written with definePanel.
  panels: PanelDefinition<any>[];
}

/** Types a panel's settings from its `defaultConfig`, `normalizeConfig` and component. */
export declare function definePanel<Config>(
  panel: PanelDefinition<Config>
): PanelDefinition<Config>;

export declare function defineWidget(widget: WidgetDefinition): WidgetDefinition;

// ─── Data from the robot ─────────────────────────────────────────────────────────────────────────

export interface TopicOptions {
  /** Minimum ms between re-renders; messages in between are dropped except the newest. */
  throttleRate?: number;
  /** Decode at most this many messages per second; the bridge still sends every one. */
  maxRate?: number;
}

/**
 * The newest message of a topic. MITI unsubscribes when the panel closes; while the panel is
 * hidden (another panel expanded) only the newest message is kept.
 */
export declare function useTopic<T = unknown>(
  client: MitiClient | null,
  topic: string,
  messageType?: string,
  options?: TopicOptions
): { data: T | null; lastUpdate: Date | null };

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface Transform {
  translation: Vector3;
  rotation: Quaternion;
}

export interface TFFrame {
  name: string;
  parent: string | null;
  /** Relative to `parent`. */
  transform: Transform;
  /** When it was received, in ms. */
  timestamp: number;
  children: string[];
  isStatic?: boolean;
  history?: { time: number; transform: Transform }[];
}

export interface TFTree {
  frames: Map<string, TFFrame>;
  rootFrame: string | null;
}

export interface UseTFOptions {
  client: MitiClient | null;
  /** Drop frames not updated for this many ms; default 30000. */
  maxAge?: number;
  enabled?: boolean;
  /** Default `/tf` and `/tf_static`. */
  tfTopics?: string[];
  staticTopics?: string[];
}

export declare function useTF(options: UseTFOptions): { tfTree: TFTree; isLoading: boolean };

/** False while the panel is covered, e.g. by another panel expanded to fill the workspace. */
export declare function usePanelVisible(): boolean;

export interface Stamp {
  sec?: number;
  nanosec?: number;
  secs?: number;
  nsecs?: number;
  nsec?: number;
}

export interface Header {
  frame_id: string;
  stamp?: Stamp;
}

/** The image `ImageCanvas` shows, as its `draw` callback receives it. */
export interface ImageFrame {
  width: number;
  height: number;
  header: Header;
}

export interface ImageCanvasProps {
  client: MitiClient | null;
  /** A `sensor_msgs/Image` or `sensor_msgs/CompressedImage` topic. */
  topic: string;
  /** Frames per second to receive at most; the bridge still sends every frame. */
  maxFps?: number;
  /** Paints over each frame, in the image's own pixel coordinates. */
  draw?: (context: CanvasRenderingContext2D, frame: ImageFrame) => void;
  /** Anything that should repaint the overlay when it changes, e.g. the latest detections. */
  redraw?: unknown;
}

/** The newest frame of an image topic, fitted to the panel. */
export declare function ImageCanvas(props: ImageCanvasProps): ReactElement;

// ─── Settings and status ─────────────────────────────────────────────────────────────────────────

/** Shows its children in MITI's sidebar while the panel is selected. */
export declare function PanelSettings(props: { children: ReactNode }): ReactElement | null;

/** Shows its children in the panel's tab, e.g. a rate or a state. */
export declare function PanelStatus(props: { children: ReactNode }): ReactElement | null;

/** A group of settings that opens and closes, hidden when the settings search does not match. */
export declare function SettingsSection(props: {
  title: string;
  keywords?: string;
  children: ReactNode;
}): ReactElement;

/** A group of settings laid out like MITI's own panels. */
export declare function TreeSection(props: {
  title: string;
  /** Words the settings search matches besides the title. */
  keywords?: string;
  defaultOpen?: boolean;
  /** Shows an eye toggle when given. */
  visible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
  error?: string;
  children?: ReactNode;
}): ReactElement;

/** One row: a label and any control. */
export declare function TreeField(props: {
  label: string;
  error?: string;
  children: ReactNode;
}): ReactElement;

/** Reports its value on Enter or when it loses focus. */
export declare function TextField(props: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  placeholder?: string;
  error?: string;
}): ReactElement;

/** Reports its value on Enter or when it loses focus, clamped to `min` and `max`. */
export declare function NumberField(props: {
  label: string;
  value: number;
  onCommit: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  error?: string;
}): ReactElement;

export declare function ToggleField(props: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  error?: string;
}): ReactElement;

export declare function SelectField<T extends string>(props: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  error?: string;
}): ReactElement;

export declare function ColorField(props: {
  label: string;
  /** `#rrggbb`, or `#rrggbbaa` with alpha. */
  value: string;
  onChange: (value: string) => void;
  /** When given, the color can be cleared. */
  emptyLabel?: string;
  error?: string;
}): ReactElement;

export declare function SliderField(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}): ReactElement;

/** A topic field that suggests the bridge's topics and reports only complete names. */
export declare function TopicInput(props: {
  value: string;
  onCommit: (topic: string) => void;
  topics?: TopicInfo[];
  /** Message type(s) the panel shows; limits the suggestions and flags other types. */
  messageType?: string | string[];
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
}): ReactElement;
