import { useState } from "react";
import { FileImage, FolderOpen, Play, Send, Square, Video } from "lucide-react";
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
import { Badge } from "../components/ui/badge";
import { fileName, fileUrl } from "../lib/utils";
import type { LogEntry } from "@shared/types";

const EMPTY_LOGS: LogEntry[] = [];

export function Terminal(): JSX.Element {
  const { id } = useParams();
  const project = useStudioStore((state) =>
    state.projects.find((item) => item.id === id),
  );
  const logs = useStudioStore((state) => state.logs[id || ""] || EMPTY_LOGS);
  const job = useStudioStore((state) => state.jobs[id || ""]);
  const [reply, setReply] = useState("");
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
                  <Play className="h-4 w-4" /> Continue
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
      <TerminalLog logs={logs} />
      {project.pendingReply ? (
        <Card>
          <CardHeader>
            <CardTitle>RoboNeo needs your input</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {project.pendingReply.message ||
                "Answer the follow-up request to continue."}
            </p>
            <div className="flex gap-2">
              <Input
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                placeholder="Your reply..."
              />
              <Button
                disabled={!reply.trim()}
                onClick={() => {
                  void window.roboneo.replyToProject(project.id, reply);
                  setReply("");
                }}
              >
                <Send className="h-4 w-4" /> Reply
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
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
