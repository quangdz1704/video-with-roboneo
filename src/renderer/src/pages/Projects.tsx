import {
  DownloadCloud,
  FolderOpen,
  History,
  Loader2,
  Pencil,
  TerminalSquare,
  Trash2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { useStudioStore } from "../store/useStudioStore";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import type { RemoteHistoryRoom } from "@shared/types";

function formatRemoteTime(value?: string): string {
  if (!value) return "";
  const numeric = Number(value);
  const date = Number.isFinite(numeric)
    ? new Date(numeric * (value.length === 10 ? 1000 : 1))
    : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

export function Projects(): JSX.Element {
  const projects = useStudioStore((state) => state.projects);
  const setProjects = useStudioStore((state) => state.setProjects);
  const upsertProject = useStudioStore((state) => state.upsertProject);
  const [remoteRooms, setRemoteRooms] = useState<RemoteHistoryRoom[]>([]);
  const [historyMessage, setHistoryMessage] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [importingRoom, setImportingRoom] = useState<string>();
  const remove = async (id: string): Promise<void> => {
    if (!confirm("Delete this local project and its copied inputs?")) return;
    await window.roboneo.deleteProject(id);
    setProjects(projects.filter((item) => item.id !== id));
  };
  const loadRemoteHistory = async (): Promise<void> => {
    setLoadingHistory(true);
    try {
      const result = await window.roboneo.listRemoteHistory();
      setRemoteRooms(result.rooms);
      setHistoryMessage(result.message);
    } catch (error) {
      setHistoryMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoadingHistory(false);
    }
  };
  const importRoom = async (roomId: string): Promise<void> => {
    setImportingRoom(roomId);
    try {
      const project = await window.roboneo.importRemoteHistoryRoom(roomId);
      upsertProject(project);
      setHistoryMessage(`Imported ${project.name}`);
    } catch (error) {
      setHistoryMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setImportingRoom(undefined);
    }
  };
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Projects & history</h1>
          <p className="mt-2 text-muted-foreground">
            Local project metadata, rooms, and downloaded artifacts.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={loadingHistory}
          onClick={() => void loadRemoteHistory()}
        >
          {loadingHistory ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <History className="h-4 w-4" />
          )}{" "}
          Load RoboNeo history
        </Button>
      </div>
      {historyMessage ? (
        <p className="rounded-lg border border-border bg-card p-3 text-sm">
          {historyMessage}
        </p>
      ) : null}
      {remoteRooms.length ? (
        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">RoboNeo cloud history</p>
                <p className="text-xs text-muted-foreground">
                  Import a room to inspect detail, continue polling, or download
                  artifacts locally.
                </p>
              </div>
              <Badge>{remoteRooms.length} rooms</Badge>
            </div>
            {remoteRooms.map((room) => {
              const local = projects.find(
                (project) => project.roomId === room.roomId,
              );
              return (
                <div
                  key={room.roomId}
                  className="flex items-center justify-between gap-4 rounded-lg border border-border p-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{room.title}</p>
                      {room.type ? <Badge>{room.type}</Badge> : null}
                      {local ? <Badge>local</Badge> : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Room {room.roomId}
                      {formatRemoteTime(room.updatedAt)
                        ? ` · ${formatRemoteTime(room.updatedAt)}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {local ? (
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/terminal/${local.id}`}>
                          <TerminalSquare className="h-4 w-4" />
                        </Link>
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={Boolean(importingRoom)}
                      onClick={() => void importRoom(room.roomId)}
                    >
                      {importingRoom === room.roomId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <DownloadCloud className="h-4 w-4" />
                      )}{" "}
                      {local ? "Refresh" : "Import"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}
      <div className="space-y-3">
        {projects.map((project) => (
          <Card key={project.id}>
            <CardContent className="flex items-center justify-between gap-5 p-5">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <p className="truncate font-medium">{project.name}</p>
                  <Badge>{project.status.replace("_", " ")}</Badge>
                  <Badge>
                    {(project.mode || "motion_reference").replaceAll("_", " ")}
                  </Badge>
                </div>
                <p className="mt-2 line-clamp-1 text-sm text-muted-foreground">
                  {project.brief || "No brief"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(project.updatedAt).toLocaleString()}{" "}
                  {project.roomId ? `· Room ${project.roomId}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link to={`/new?project=${project.id}`}>
                    <Pencil className="h-4 w-4" />
                  </Link>
                </Button>
                {project.status !== "draft" ? (
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/terminal/${project.id}`}>
                      <TerminalSquare className="h-4 w-4" />
                    </Link>
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void window.roboneo.openOutputFolder(project.id)
                  }
                >
                  <FolderOpen className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void remove(project.id)}
                >
                  <Trash2 className="h-4 w-4 text-rose-400" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
