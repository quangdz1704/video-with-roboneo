import { readdir } from "node:fs/promises";
import path from "node:path";
import { shell, type BrowserWindow } from "electron";
import { createHash } from "node:crypto";
import type {
  ApiKeyRecord,
  JobState,
  JobStep,
  LogEntry,
  Project,
  RemoteHistoryDetail,
  RemoteHistoryResult,
  RemoteHistoryRoom,
} from "../../shared/types";
import { LocalProjectStorage } from "../storage/localProjectStorage";
import { ProcessManager, type CommandResult } from "./processManager";

type HistoryPayload = Record<string, unknown> & {
  next_action?: unknown;
  max_seq?: number;
  last_seq?: number;
  artifacts?: unknown[];
  request_id?: string;
  last_request_id?: string;
  message?: string;
  recharge_url?: string;
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function findArray(value: unknown, keys: string[]): unknown[] | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  for (const key of keys) {
    const candidate = record[key];
    if (Array.isArray(candidate)) return candidate;
  }
  for (const child of Object.values(record)) {
    const match = findArray(child, keys);
    if (match) return match;
  }
  return undefined;
}

function findNumber(value: unknown, keys: string[]): number | undefined {
  const raw = findStringOrNumber(value, keys);
  if (raw === undefined) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function tokenFingerprint(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 10);
}

function tokenDebugInfo(token: string): string {
  const trimmed = token.trim();
  const prefix = trimmed.startsWith("_v2")
    ? "_v2…"
    : trimmed.slice(0, Math.min(4, trimmed.length)) + "…";
  const suffix = trimmed.slice(-4);
  return [
    `prefix=${prefix}`,
    `suffix=…${suffix}`,
    `length=${token.length}`,
    `trimmedLength=${trimmed.length}`,
    `fingerprint=${tokenFingerprint(token)}`,
    `hasWhitespace=${token !== trimmed}`,
  ].join(" ");
}

function parseJson(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const lines = trimmed.split(/\r?\n/).reverse();
    for (const line of lines) {
      try {
        return JSON.parse(line);
      } catch {
        continue;
      }
    }
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start)
      return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("RoboNeo CLI did not return valid JSON");
  }
}

function findString(value: unknown, keys: string[]): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  for (const key of keys)
    if (typeof record[key] === "string") return record[key] as string;
  for (const child of Object.values(record)) {
    const match = findString(child, keys);
    if (match) return match;
  }
  return undefined;
}

function findStringOrNumber(value: unknown, keys: string[]): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "string" || typeof candidate === "number")
      return String(candidate);
  }
  for (const child of Object.values(record)) {
    const match = findStringOrNumber(child, keys);
    if (match) return match;
  }
  return undefined;
}

function historyPayload(value: Record<string, unknown>): HistoryPayload {
  const candidates = [value.data, value.result, value];
  return (candidates.find((item) => item && typeof item === "object") ||
    value) as HistoryPayload;
}

function nextAction(payload: HistoryPayload): {
  action: string;
  rechargeUrl?: string;
  message?: string;
} {
  const raw = payload.next_action;
  if (typeof raw === "string") return { action: raw.toLowerCase() };
  if (raw && typeof raw === "object") {
    const actionRecord = raw as Record<string, unknown>;
    const extra = actionRecord.extra as Record<string, unknown> | undefined;
    const recharge = extra?.recharge as Record<string, unknown> | undefined;
    const items = Array.isArray(actionRecord.items) ? actionRecord.items : [];
    const itemMessage = items
      .map((item) =>
        item && typeof item === "object"
          ? (item as Record<string, unknown>).content
          : undefined,
      )
      .find((content): content is string => typeof content === "string");
    return {
      action: String(actionRecord.action || "poll").toLowerCase(),
      rechargeUrl: typeof recharge?.url === "string" ? recharge.url : undefined,
      message:
        typeof recharge?.content === "string" ? recharge.content : itemMessage,
    };
  }
  return {
    action: String(
      findString(payload, ["action", "next_action"]) || "poll",
    ).toLowerCase(),
  };
}

function normalizeHistoryRoom(value: unknown): RemoteHistoryRoom | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  const roomId = findStringOrNumber(record, [
    "room_id",
    "roomId",
    "id",
    "room",
  ]);
  if (!roomId) return undefined;
  const title =
    findStringOrNumber(record, ["title", "name", "room_title", "summary"]) ||
    `RoboNeo room ${roomId}`;
  return {
    roomId,
    title,
    type: findStringOrNumber(record, ["room_type", "type", "mode"]),
    coverUrl: findStringOrNumber(record, [
      "cover_url",
      "coverUrl",
      "thumbnail",
      "image_url",
      "url",
    ]),
    createdAt: findStringOrNumber(record, [
      "created_at",
      "create_time",
      "createdAt",
    ]),
    updatedAt: findStringOrNumber(record, [
      "updated_at",
      "update_time",
      "updatedAt",
      "last_time",
    ]),
    raw: record,
  };
}

function normalizeHistoryDetail(
  roomId: string,
  value: Record<string, unknown>,
): RemoteHistoryDetail {
  const payload = historyPayload(value);
  const next = nextAction(payload);
  return {
    roomId,
    title: findStringOrNumber(payload, ["title", "name", "room_title"]),
    maxSeq: findNumber(payload, ["max_seq", "last_seq"]),
    lastSeq: findNumber(payload, ["last_seq", "max_seq"]),
    nextAction: next.action,
    message: next.message || findStringOrNumber(payload, ["message", "msg"]),
    artifacts: Array.isArray(payload.artifacts) ? payload.artifacts : undefined,
    raw: payload,
  };
}

function creditFromUserInfo(value: Record<string, unknown>): string | undefined {
  return findStringOrNumber(value, [
    "total_amount",
    "amount",
    "effective_amount",
    "available_amount",
    "balance",
  ]);
}

export class RoboNeoRunner {
  private cancelled = new Set<string>();

  constructor(
    private storage: LocalProjectStorage,
    private processes: ProcessManager,
    private getWindow: () => BrowserWindow | null,
  ) {}

  private send(channel: string, payload: unknown): void {
    this.getWindow()?.webContents.send(channel, payload);
  }

  private log(
    projectId: string,
    message: string,
    stream: LogEntry["stream"] = "system",
    step?: JobStep,
  ): void {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random()}`,
      projectId,
      timestamp: new Date().toISOString(),
      stream,
      message,
      step,
    };
    this.send("roboneo:log", entry);
  }

  private state(
    projectId: string,
    step: JobStep,
    running: boolean,
    roomId?: string,
    lastSeq = 0,
    error?: string,
  ): void {
    const state: JobState = {
      projectId,
      step,
      running,
      roomId,
      lastSeq,
      error,
    };
    this.send("roboneo:job-state", state);
  }

  private async command(
    projectId: string,
    args: string[],
    token?: string,
    step?: JobStep,
  ): Promise<CommandResult> {
    const settings = await this.storage.getSettings();
    const safeArgs = args.map((arg) =>
      token && arg === token ? "••••••••" : arg,
    );
    if (token) {
      // const debugInfo = tokenDebugInfo(token);
      // logger.info(
      //   "cli:auth",
      //   `job=${projectId}`,
      //   `command=${args[0]}`,
      //   debugInfo,
      // );
      // this.log(
      //   projectId,
      //   `[auth] Injecting ROBONEO_ACCESS_KEY (${debugInfo})`,
      //   "system",
      //   step,
      // );
      // if (token.trim().startsWith("_v2")) {
      //   this.log(
      //     projectId,
      //     "[auth] Warning: this looks like a Meitu web-session Access-Token (_v2…). RoboNeo CLI may require a different CLI-compatible access key.",
      //     "system",
      //     step,
      //   );
      // }
    }
    this.log(
      projectId,
      `$ ${settings.cliPath} ${safeArgs.map((arg) => JSON.stringify(arg)).join(" ")}`,
      "system",
      step,
    );
    const result = await this.processes.run(
      projectId,
      settings.cliPath,
      args,
      { ...process.env, ...(token ? { ROBONEO_ACCESS_KEY: token } : {}) },
      (stream, chunk) =>
        this.log(
          projectId,
          token ? chunk.replaceAll(token, "••••••••") : chunk,
          stream,
          step,
        ),
    );
    if (result.code !== 0) {
      const output = result.stderr.trim() || result.stdout.trim();
      if (output) {
        try {
          const payload = parseJson(output);
          throw new Error(
            findString(payload, ["error_msg", "error", "message"]) || output,
          );
        } catch (error) {
          if (
            error instanceof Error &&
            error.message !== "RoboNeo CLI did not return valid JSON"
          )
            throw error;
        }
      }
      throw new Error(`RoboNeo exited with code ${result.code}`);
    }
    return result;
  }

  private async getRunKey(id?: string): Promise<ApiKeyRecord | null> {
    if (id) return this.storage.getKey(id);
    const keys = await this.storage.listKeys();
    const active = keys.find((key) => key.status === "active") || keys[0];
    return active ? this.storage.getKey(active.id) : null;
  }

  async checkEnvironment(): Promise<{
    node: { ok: boolean; version?: string };
    cli: { ok: boolean; version?: string; installCommand: string };
  }> {
    const settings = await this.storage.getSettings();
    const node = {
      ok: Boolean(process.versions.node),
      version: process.versions.node,
    };
    try {
      const result = await this.processes.run(
        "environment-check",
        settings.cliPath,
        ["--version"],
        process.env,
      );
      return {
        node,
        cli: {
          ok: result.code === 0,
          version: (result.stdout || result.stderr).trim(),
          installCommand: "npm install -g roboneo-cli",
        },
      };
    } catch {
      return {
        node,
        cli: { ok: false, installCommand: "npm install -g roboneo-cli" },
      };
    }
  }

  async validateKey(id: string): Promise<{ ok: boolean; message: string }> {
    const key = await this.storage.getKey(id);
    if (!key) return { ok: false, message: "API key not found" };
    let cliMessage = "CLI: valid";
    let cliValid = true;
    try {
      await this.command(
        `key-validation-${id}`,
        ["user-info"],
        key.apiKey,
        "validating_token",
      );
    } catch (error) {
      cliValid = false;
      const message = error instanceof Error ? error.message : String(error);
      cliMessage = `CLI: ${message}${/invalid or expired/i.test(message) ? " The saved value is expired or is not a CLI-compatible ROBONEO_ACCESS_KEY." : ""}`;
    }
    return {
      ok: cliValid,
      message: cliMessage,
    };
  }

  async loadKeyCredit(id: string): Promise<{
    ok: boolean;
    balance?: string;
    message: string;
    keys: Awaited<ReturnType<LocalProjectStorage["listKeys"]>>;
  }> {
    const key = await this.storage.getKey(id);
    if (!key)
      return {
        ok: false,
        message: "API key not found",
        keys: await this.storage.listKeys(),
      };
    try {
      const result = await this.command(
        `key-credit-${id}`,
        ["user-info"],
        key.apiKey,
        "validating_token",
      );
      const balance = creditFromUserInfo(parseJson(result.stdout));
      if (!balance) throw new Error("RoboNeo CLI user-info did not return total_amount");
      const keys = await this.storage.saveKeyCredit(id, balance);
      return {
        ok: true,
        balance,
        message: `Balance: ${balance} carrots`,
        keys,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        message,
        keys: await this.storage.saveKeyCreditError(id, message),
      };
    }
  }

  async listRemoteHistory(keyId?: string): Promise<RemoteHistoryResult> {
    const key = await this.getRunKey(keyId);
    if (!key || key.status !== "active") {
      return {
        rooms: [],
        message: "Select an active RoboNeo API key before loading history",
      };
    }
    const result = await this.command(
      "remote-history",
      ["history"],
      key.apiKey,
      "polling",
    );
    const payload = parseJson(result.stdout);
    const list = findArray(payload, ["list", "rooms", "records", "items"]) || [];
    const rooms = list
      .map(normalizeHistoryRoom)
      .filter((room): room is RemoteHistoryRoom => Boolean(room));
    return {
      rooms,
      totalCount: findNumber(payload, ["total_count", "totalCount", "total"]),
      bottomDesc: findStringOrNumber(payload, ["bottom_desc", "bottomDesc"]),
      message: `Loaded ${rooms.length} RoboNeo history room(s)`,
    };
  }

  async importRemoteHistoryRoom(
    roomId: string,
    keyId?: string,
  ): Promise<Project> {
    const key = await this.getRunKey(keyId);
    if (!key || key.status !== "active")
      throw new Error("Select an active RoboNeo API key before importing history");
    const existing = await this.storage.findProjectByRoomId(roomId);
    const result = await this.command(
      `remote-history-detail-${roomId}`,
      ["history-detail", "-r", roomId],
      key.apiKey,
      "polling",
    );
    const detail = normalizeHistoryDetail(roomId, parseJson(result.stdout));
    const name = detail.title || existing?.name || `RoboNeo room ${roomId}`;
    const next: Project = existing
      ? {
          ...existing,
          name,
          apiKeyId: key.id,
          roomId,
          status: detail.nextAction === "reply" ? "waiting_reply" : existing.status,
          lastSeq: detail.maxSeq ?? existing.lastSeq,
          remoteHistory: detail,
        }
      : {
          id: `${Date.now()}-${roomId}`.replace(/[^a-zA-Z0-9-]/g, "-"),
          name,
          mode: "text_to_video",
          brief: detail.message || "",
          mood: "Imported from RoboNeo history",
          duration: 8,
          language: "en",
          aspectRatio: "9:16",
          resolution: "1080x1920",
          apiKeyId: key.id,
          assets: {},
          finalPrompt: detail.message || "",
          roomId,
          status: detail.nextAction === "done" ? "completed" : detail.nextAction === "reply" ? "waiting_reply" : "running",
          outputFiles: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastSeq: detail.maxSeq,
          remoteHistory: detail,
        };
    const saved = existing
      ? await this.updateProject(next)
      : await this.storage.createProject(next);
    this.send("roboneo:project-updated", saved);
    return saved;
  }

  async saveKeyToConfig(id: string): Promise<{ ok: boolean; message: string }> {
    const key = await this.storage.getKey(id);
    if (!key) return { ok: false, message: "API key not found" };
    try {
      await this.command(
        "save-key-config",
        ["config", "access_token", key.apiKey],
        key.apiKey,
      );
      return { ok: true, message: "Saved to RoboNeo CLI config" };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async run(projectId: string): Promise<void> {
    this.cancelled.delete(projectId);
    let project = await this.storage.getProject(projectId);
    if (!project) throw new Error("Project not found");
    const key = project.apiKeyId
      ? await this.storage.getKey(project.apiKeyId)
      : null;
    if (!key || key.status !== "active")
      throw new Error("Select an active RoboNeo API key");
    this.log(
      projectId,
      `[auth] Selected key label="${key.label}" id=${key.id} ${tokenDebugInfo(key.apiKey)}`,
      "system",
      "validating_token",
    );
    const mode = project.mode || "motion_reference";
    if (
      mode === "motion_reference" &&
      (!project.assets.characterImage || !project.assets.referenceVideo)
    ) {
      throw new Error(
        "Motion Reference requires a character image and a reference video",
      );
    }
    if (mode === "image_to_video" && !project.assets.characterImage) {
      throw new Error("Image to Video requires a reference image");
    }
    if (!project.finalPrompt)
      throw new Error("Review and save a final prompt before running");

    try {
      project = await this.updateProject({
        ...project,
        status: "running",
        error: undefined,
        pendingReply: undefined,
      });
      this.state(projectId, "checking_cli", true);
      await this.command(projectId, ["--version"], undefined, "checking_cli");
      this.state(projectId, "validating_token", true);

      await this.command(
        projectId,
        ["user-info"],
        key.apiKey,
        "validating_token",
      );

      this.state(projectId, "creating_room", true);
      const roomResult = await this.command(
        projectId,
        ["create-room"],
        key.apiKey,
        "creating_room",
      );
      const roomId = findString(parseJson(roomResult.stdout), [
        "room_id",
        "roomId",
        "id",
      ]);
      if (!roomId)
        throw new Error("Could not parse room_id from create-room output");
      project = await this.updateProject({
        ...project,
        roomId,
        outputFiles: [],
      });

      this.state(projectId, "sending_prompt", true, roomId);
      const args: string[] = [
        "chat",
        "-p",
        project.finalPrompt!,
        "--lang",
        project.language,
        "--room-id",
        roomId,
      ];
      if (mode === "motion_reference") {
        args.push("--image-file", project.assets.characterImage!);
        if (project.assets.secondImage)
          args.push("--image-file", project.assets.secondImage);
        args.push("--video-file", project.assets.referenceVideo!);
      }
      if (mode === "image_to_video") {
        args.push("--image-file", project.assets.characterImage!);
        if (project.assets.secondImage)
          args.push("--image-file", project.assets.secondImage);
      }
      await this.command(projectId, args, key.apiKey, "sending_prompt");
      await this.storage.markKeyUsed(key.id);
      await this.poll(project, key.apiKey, 0);
    } catch (error) {
      if (this.cancelled.has(projectId)) return;
      const message = error instanceof Error ? error.message : String(error);
      const latest = await this.storage.getProject(projectId);
      if (latest)
        await this.updateProject({
          ...latest,
          status: "failed",
          error: message,
        });
      this.log(projectId, message, "stderr", "failed");
      this.state(projectId, "failed", false, project.roomId, 0, message);
    }
  }

  private async poll(
    project: Project,
    token: string,
    initialSeq: number,
  ): Promise<void> {
    const settings = await this.storage.getSettings();
    let lastSeq = initialSeq;
    while (!this.cancelled.has(project.id)) {
      this.state(project.id, "polling", true, project.roomId, lastSeq);
      const args = ["history-detail", "-r", project.roomId!];
      if (lastSeq > 0) args.push("--after-seq", String(lastSeq));
      const result = await this.command(project.id, args, token, "polling");
      const payload = historyPayload(parseJson(result.stdout));
      lastSeq = Number(
        payload.max_seq ??
          payload.last_seq ??
          findString(payload, ["max_seq", "last_seq"]) ??
          lastSeq,
      );
      project = await this.updateProject({
        ...project,
        lastSeq,
        remoteHistory: normalizeHistoryDetail(project.roomId!, parseJson(result.stdout)),
      });
      const next = nextAction(payload);
      const action = next.action;

      if (action === "done") {
        await this.download(project, token);
        return;
      }
      if (action === "reply") {
        const requestId = findString(payload, [
          "last_request_id",
          "request_id",
          "block_id",
          "id",
        ]);
        if (!requestId)
          throw new Error(
            "RoboNeo requested a reply but no request ID was returned",
          );
        await this.updateProject({
          ...project,
          status: "waiting_reply",
          lastSeq,
          pendingReply: { requestId, message: payload.message },
        });
        this.state(project.id, "waiting_reply", false, project.roomId, lastSeq);
        return;
      }
      if (action === "recharge") {
        const rechargeUrl =
          next.rechargeUrl || findString(payload, ["recharge_url"]);
        if (rechargeUrl && /^https?:\/\//i.test(rechargeUrl))
          await shell.openExternal(rechargeUrl);
        const message =
          next.message ||
          (rechargeUrl
            ? `Quota exhausted. Recharge at ${rechargeUrl}`
            : "RoboNeo quota exhausted. Please recharge your account.");
        throw new Error(message);
      }
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(3000, settings.pollIntervalMs)),
      );
      project = (await this.storage.getProject(project.id)) || project;
    }
  }

  async reply(projectId: string, reply: string): Promise<void> {
    const project = await this.storage.getProject(projectId);
    if (!project?.pendingReply || !project.roomId || !project.apiKeyId)
      throw new Error("No pending RoboNeo reply");
    const key = await this.storage.getKey(project.apiKeyId);
    if (!key) throw new Error("API key not found");
    await this.updateProject({
      ...project,
      status: "running",
      pendingReply: undefined,
    });
    await this.command(
      projectId,
      [
        "reply",
        "-r",
        project.roomId,
        "--last-request-id",
        project.pendingReply.requestId,
        "-p",
        reply,
      ],
      key.apiKey,
      "sending_prompt",
    );
    await this.poll(project, key.apiKey, project.lastSeq || 0);
  }

  async continue(projectId: string): Promise<void> {
    this.cancelled.delete(projectId);
    const project = await this.storage.getProject(projectId);
    if (!project?.roomId || !project.apiKeyId)
      throw new Error("Project does not have a RoboNeo room to continue");
    const key = await this.storage.getKey(project.apiKeyId);
    if (!key || key.status !== "active")
      throw new Error("Select an active RoboNeo API key");
    const running = await this.updateProject({
      ...project,
      status: "running",
      error: undefined,
    });
    if (project.status === "completed") {
      await this.download(running, key.apiKey);
      return;
    }
    await this.poll(running, key.apiKey, running.lastSeq || 0);
  }

  private async download(project: Project, token: string): Promise<void> {
    const settings = await this.storage.getSettings();
    const outputDir = this.storage.outputDir(project, settings);
    this.state(project.id, "downloading", true, project.roomId);
    await this.command(
      project.id,
      ["download", "-r", project.roomId!, "-o", outputDir],
      token,
      "downloading",
    );
    const files = await this.findOutputFiles(outputDir);
    const completed = await this.updateProject({
      ...project,
      status: "completed",
      outputFiles: files,
      pendingReply: undefined,
    });
    this.log(
      project.id,
      `Downloaded ${files.length} artifact file(s) to ${outputDir}`,
      "system",
      "completed",
    );
    this.state(project.id, "completed", false, completed.roomId);
  }

  private async findOutputFiles(dir: string): Promise<string[]> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      const nested = await Promise.all(
        entries.map(async (entry) => {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) return this.findOutputFiles(fullPath);
          return /\.(mp4|mov|png|jpe?g|webp|gif)$/i.test(entry.name)
            ? [fullPath]
            : [];
        }),
      );
      return nested.flat();
    } catch {
      return [];
    }
  }

  async cancel(projectId: string): Promise<void> {
    this.cancelled.add(projectId);
    this.processes.cancel(projectId);
    const project = await this.storage.getProject(projectId);
    if (project) await this.updateProject({ ...project, status: "cancelled" });
    this.log(projectId, "Job cancelled by user", "system", "cancelled");
    this.state(projectId, "cancelled", false, project?.roomId);
  }

  private async updateProject(project: Project): Promise<Project> {
    const saved = await this.storage.saveProject(project);
    this.send("roboneo:project-updated", saved);
    return saved;
  }
}
