import { useState } from "react";
import {
  File,
  FileImage,
  FolderOpen,
  Image,
  Paperclip,
  Play,
  Send,
  Square,
  Video,
} from "lucide-react";
import { useParams } from "react-router-dom";
import { useStudioStore } from "../store/useStudioStore";
import { TerminalLog } from "../components/TerminalLog";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { fileName, fileUrl } from "../lib/utils";
import type { ChatAttachment, LogEntry } from "@shared/types";

const EMPTY_LOGS: LogEntry[] = [];
const EMPTY_MESSAGES: ReturnType<
  typeof useStudioStore.getState
>["chatMessages"][string] = [];

export function Terminal(): JSX.Element {
  const { id } = useParams();
  const project = useStudioStore((state) =>
    state.projects.find((item) => item.id === id),
  );
  const logs = useStudioStore((state) => state.logs[id || ""] || EMPTY_LOGS);
  const messages = useStudioStore(
    (state) => state.chatMessages[id || ""] || EMPTY_MESSAGES,
  );
  const job = useStudioStore((state) => state.jobs[id || ""]);
  const [tab, setTab] = useState<"chat" | "terminal">("chat");
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [sending, setSending] = useState(false);
  if (!project) return <p>Project not found.</p>;
  const running = Boolean(job?.running || project.status === "running");
  const isImage = (file: string): boolean =>
    /\.(png|jpe?g|webp|gif)$/i.test(file);
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm text-primary">STEP 3 OF 3</p>
          <h1 className="mt-2 text-3xl font-semibold">Run terminal</h1>
          <p className="mt-2 text-muted-foreground">{project.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge>{job?.step || project.status}</Badge>
          {running ? (
            <Button
              variant="destructive"
              onClick={() => void window.roboneo.cancelProject(project.id)}
            >
              <Square className="h-4 w-4" /> Cancel
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => void window.roboneo.runProject(project.id)}
              >
                <Play className="h-4 w-4" /> Rerun
              </Button>
              {project.roomId ? (
                <Button
                  variant="outline"
                  onClick={() =>
                    void window.roboneo.continueProject(project.id)
                  }
                >
                  <Play className="h-4 w-4" /> Sync
                </Button>
              ) : null}
            </>
          )}
          <Button
            variant="outline"
            onClick={() => void window.roboneo.openOutputFolder(project.id)}
          >
            <FolderOpen className="h-4 w-4" /> Output folder
          </Button>
        </div>
      </div>
      <div className="flex w-fit rounded-lg border border-border bg-card p-1">
        <Button
          size="sm"
          variant={tab === "chat" ? "default" : "ghost"}
          onClick={() => setTab("chat")}
        >
          Chat
        </Button>
        <Button
          size="sm"
          variant={tab === "terminal" ? "default" : "ghost"}
          onClick={() => setTab("terminal")}
        >
          Terminal
        </Button>
      </div>
      {tab === "terminal" ? (
        <TerminalLog logs={logs} />
      ) : (
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="h-[520px] overflow-auto rounded-lg border border-border bg-background/60 p-4">
              {messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Chat history will appear here after you run or sync this room.
                </p>
              ) : null}
              <div className="space-y-4">
                {messages.map((item) => (
                  <div
                    key={item.id}
                    className={
                      item.role === "user"
                        ? "ml-auto max-w-[82%]"
                        : "mr-auto max-w-[82%]"
                    }
                  >
                    <div
                      className={`rounded-lg border p-3 ${item.role === "user" ? "border-primary/30 bg-primary/10" : "border-border bg-card"}`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                        <span className="capitalize">{item.role}</span>
                        <span>{new Date(item.createdAt).toLocaleString()}</span>
                      </div>
                      {item.content ? (
                        <p className="whitespace-pre-wrap text-sm leading-6">
                          {item.content}
                        </p>
                      ) : null}
                      {item.attachments.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.attachments.map((attachment) => (
                            <button
                              key={attachment.id}
                              className="flex items-center gap-2 rounded-md border border-border px-2 py-1 text-xs"
                              onClick={() =>
                                attachment.path &&
                                void window.roboneo.openPath(attachment.path)
                              }
                            >
                              {attachment.kind === "image" ? (
                                <Image className="h-3 w-3" />
                              ) : attachment.kind === "video" ? (
                                <Video className="h-3 w-3" />
                              ) : (
                                <File className="h-3 w-3" />
                              )}
                              {attachment.name}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {project.pendingReply ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                {project.pendingReply.message ||
                  "RoboNeo needs your input to continue."}
              </div>
            ) : null}
            <div className="space-y-3 rounded-lg border border-border p-3">
              <Textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder={
                  project.pendingReply
                    ? "Reply to RoboNeo..."
                    : "Continue this room..."
                }
              />
              {attachments.length ? (
                <div className="flex flex-wrap gap-2">
                  {attachments.map((attachment) => (
                    <button
                      key={attachment.id}
                      className="flex items-center gap-2 rounded-md border border-border px-2 py-1 text-xs"
                      onClick={() =>
                        setAttachments((items) =>
                          items.filter((item) => item.id !== attachment.id),
                        )
                      }
                    >
                      <Paperclip className="h-3 w-3" />
                      {attachment.name}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const selected =
                        await window.roboneo.selectChatAttachment({
                          projectId: project.id,
                          kind: "image",
                        });
                      if (selected)
                        setAttachments((items) => [...items, selected]);
                    }}
                  >
                    <Image className="h-4 w-4" /> Image
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const selected =
                        await window.roboneo.selectChatAttachment({
                          projectId: project.id,
                          kind: "video",
                        });
                      if (selected)
                        setAttachments((items) => [...items, selected]);
                    }}
                  >
                    <Video className="h-4 w-4" /> Video
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const selected =
                        await window.roboneo.selectChatAttachment({
                          projectId: project.id,
                          kind: "file",
                        });
                      if (selected)
                        setAttachments((items) => [...items, selected]);
                    }}
                  >
                    <File className="h-4 w-4" /> File
                  </Button>
                </div>
                <Button
                  disabled={
                    running ||
                    sending ||
                    (!message.trim() && !attachments.length)
                  }
                  onClick={async () => {
                    setSending(true);
                    try {
                      await window.roboneo.sendChatMessage({
                        projectId: project.id,
                        message,
                        attachmentPaths: attachments
                          .map((item) => item.path)
                          .filter((item): item is string => Boolean(item)),
                      });
                      setMessage("");
                      setAttachments([]);
                    } finally {
                      setSending(false);
                    }
                  }}
                >
                  <Send className="h-4 w-4" /> Send
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {project.outputFiles.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {project.outputFiles.map((file) => (
            <Card key={file} className="overflow-hidden">
              {isImage(file) ? (
                <img
                  src={fileUrl(file)}
                  className="aspect-[9/16] max-h-[620px] w-full bg-black object-contain"
                />
              ) : (
                <video
                  src={fileUrl(file)}
                  controls
                  className="aspect-[9/16] max-h-[620px] w-full bg-black object-contain"
                />
              )}
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{fileName(file)}</p>
                  <p className="text-xs text-muted-foreground">
                    Ready to publish
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => void window.roboneo.openPath(file)}
                >
                  {isImage(file) ? (
                    <FileImage className="h-4 w-4" />
                  ) : (
                    <Video className="h-4 w-4" />
                  )}{" "}
                  Open
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
