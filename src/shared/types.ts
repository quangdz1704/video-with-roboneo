export type KeyStatus = "active" | "paused";
export type ProjectStatus =
  | "draft"
  | "running"
  | "waiting_reply"
  | "completed"
  | "failed"
  | "cancelled";
export type JobStep =
  | "checking_cli"
  | "validating_token"
  | "creating_room"
  | "sending_prompt"
  | "polling"
  | "waiting_reply"
  | "downloading"
  | "completed"
  | "failed"
  | "cancelled";
export type GenerationMode =
  | "motion_reference"
  | "text_to_image"
  | "text_to_video"
  | "image_to_video";

export interface ApiKeyRecord {
  id: string;
  label: string;
  apiKey: string;
  status: KeyStatus;
  usedCount: number;
  lastUsedAt?: string;
  note?: string;
  creditBalance?: string;
  creditLoadedAt?: string;
  creditError?: string;
}

export type MaskedApiKey = Omit<ApiKeyRecord, "apiKey"> & { maskedKey: string };

export interface PromptPack {
  mainPrompt: string;
  negativePrompt: string;
  motionReferencePrompt: string;
  characterConsistencyPrompt: string;
  tiktokOptimizationPrompt: string;
  caption: string;
  hashtags: string[];
  variations: string[];
  finalPrompt: string;
}

export interface ProjectAssets {
  characterImage?: string;
  secondImage?: string;
  referenceVideo?: string;
}

export type ChatAttachmentKind = "image" | "video" | "file";

export interface ChatAttachment {
  id: string;
  kind: ChatAttachmentKind;
  path?: string;
  url?: string;
  name: string;
}

export interface StoredChatMessage {
  id: string;
  projectId: string;
  roomId?: string;
  role: "user" | "assistant" | "system";
  content: string;
  attachments: ChatAttachment[];
  raw?: unknown;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  mode: GenerationMode;
  brief: string;
  mood: string;
  duration: number;
  language: "en" | "vi";
  aspectRatio: string;
  resolution: string;
  apiKeyId?: string;
  assets: ProjectAssets;
  promptPack?: PromptPack;
  finalPrompt?: string;
  roomId?: string;
  status: ProjectStatus;
  outputFiles: string[];
  createdAt: string;
  updatedAt: string;
  error?: string;
  lastSeq?: number;
  remoteHistory?: RemoteHistoryDetail;
  pendingReply?: {
    requestId: string;
    message?: string;
    options?: string[];
  };
}

export interface RemoteHistoryRoom {
  roomId: string;
  title: string;
  type?: string;
  coverUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  raw: Record<string, unknown>;
}

export interface RemoteHistoryDetail {
  roomId: string;
  title?: string;
  maxSeq?: number;
  lastSeq?: number;
  nextAction?: string;
  message?: string;
  artifacts?: unknown[];
  raw: Record<string, unknown>;
}

export interface RemoteHistoryResult {
  rooms: RemoteHistoryRoom[];
  totalCount?: number;
  bottomDesc?: string;
  message: string;
}

export interface AppSettings {
  cliPath: string;
  outputFolder: string;
  pollIntervalMs: number;
  defaultLanguage: "en" | "vi";
  defaultDuration: number;
  defaultAspectRatio: string;
  defaultResolution: string;
}

export interface LogEntry {
  id: string;
  projectId: string;
  timestamp: string;
  stream: "system" | "stdout" | "stderr";
  message: string;
  step?: JobStep;
}

export interface JobState {
  projectId: string;
  step: JobStep;
  running: boolean;
  roomId?: string;
  lastSeq: number;
  error?: string;
}

export interface AssetSelection {
  kind: "image" | "video";
  projectId: string;
  slot: keyof ProjectAssets;
}

export interface ChatAttachmentSelection {
  kind: ChatAttachmentKind;
  projectId: string;
}

export interface SendChatInput {
  projectId: string;
  message: string;
  attachmentPaths?: string[];
}

export interface SaveApiKeyInput {
  id?: string;
  label: string;
  apiKey?: string;
  status: KeyStatus;
  note?: string;
}

export interface RoboNeoBridge {
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<AppSettings>;
  listProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | null>;
  createProject(input: Partial<Project>): Promise<Project>;
  updateProject(project: Project): Promise<Project>;
  deleteProject(id: string): Promise<void>;
  selectAsset(input: AssetSelection): Promise<string | null>;
  selectChatAttachment(
    input: ChatAttachmentSelection,
  ): Promise<ChatAttachment | null>;
  listKeys(): Promise<MaskedApiKey[]>;
  saveKey(input: SaveApiKeyInput): Promise<MaskedApiKey[]>;
  deleteKey(id: string): Promise<MaskedApiKey[]>;
  validateKey(id: string): Promise<{ ok: boolean; message: string }>;
  loadKeyCredit(
    id: string,
  ): Promise<{
    ok: boolean;
    balance?: string;
    message: string;
    keys: MaskedApiKey[];
  }>;
  listRemoteHistory(keyId?: string): Promise<RemoteHistoryResult>;
  importRemoteHistoryRoom(roomId: string, keyId?: string): Promise<Project>;
  saveKeyToConfig(id: string): Promise<{ ok: boolean; message: string }>;
  checkEnvironment(): Promise<{
    node: { ok: boolean; version?: string };
    cli: { ok: boolean; version?: string; installCommand: string };
  }>;
  runProject(projectId: string): Promise<void>;
  continueProject(projectId: string): Promise<void>;
  sendChatMessage(input: SendChatInput): Promise<void>;
  cancelProject(projectId: string): Promise<void>;
  replyToProject(projectId: string, reply: string): Promise<void>;
  openOutputFolder(projectId: string): Promise<void>;
  openPath(path: string): Promise<void>;
  getProjectLogs(projectId: string): Promise<LogEntry[]>;
  getProjectChatMessages(projectId: string): Promise<StoredChatMessage[]>;
  onLog(callback: (entry: LogEntry) => void): () => void;
  onChatMessage(callback: (message: StoredChatMessage) => void): () => void;
  onJobState(callback: (state: JobState) => void): () => void;
  onProjectUpdated(callback: (project: Project) => void): () => void;
}
