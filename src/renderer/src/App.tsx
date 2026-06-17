import { useEffect } from "react";
import {
  KeyRound as ApiKeysIcon,
  FolderKanban,
  Home,
  PlusSquare,
  Settings as SettingsIcon,
  Sparkles,
} from "lucide-react";
import { Navigate, NavLink, Route, Routes, useParams } from "react-router-dom";
import { useStudioStore } from "./store/useStudioStore";
import { cn } from "./lib/utils";
import { Dashboard } from "./pages/Dashboard";
import { NewVideo } from "./pages/NewVideo";
import { PromptReviewPage } from "./pages/PromptReviewPage";
import { Terminal } from "./pages/Terminal";
import { Projects } from "./pages/Projects";
import { ApiKeys } from "./pages/ApiKeys";
import { Settings } from "./pages/Settings";

const nav = [
  ["Dashboard", "/", Home],
  ["New", "/new", PlusSquare],
  ["Projects", "/projects", FolderKanban],
  ["API Keys", "/keys", ApiKeysIcon],
  ["Settings", "/settings", SettingsIcon],
] as const;

function ProjectEntry(): JSX.Element {
  const { id } = useParams();
  const hydrated = useStudioStore((state) => state.hydrated);
  const project = useStudioStore((state) =>
    state.projects.find((item) => item.id === id),
  );
  if (!hydrated)
    return <p className="text-muted-foreground">Loading project...</p>;
  if (!project) return <Navigate to="/projects" replace />;
  return (
    <Navigate
      to={
        project.status === "draft"
          ? `/new?project=${project.id}`
          : `/terminal/${project.id}`
      }
      replace
    />
  );
}

export default function App(): JSX.Element {
  const {
    setProjects,
    setKeys,
    setSettings,
    addLog,
    addChatMessage,
    setLogs,
    setChatMessages,
    setJob,
    upsertProject,
    setHydrated,
  } = useStudioStore();
  useEffect(() => {
    Promise.all([
      window.roboneo.listProjects(),
      window.roboneo.listKeys(),
      window.roboneo.getSettings(),
    ]).then(([projects, keys, settings]) => {
      setProjects(projects);
      setKeys(keys);
      setSettings(settings);
      void Promise.all(
        projects.map(async (project) => {
          const [logs, messages] = await Promise.all([
            window.roboneo.getProjectLogs(project.id),
            window.roboneo.getProjectChatMessages(project.id),
          ]);
          setLogs(project.id, logs);
          setChatMessages(project.id, messages);
        }),
      );
      setHydrated(true);
    });
    const offLog = window.roboneo.onLog(addLog);
    const offChat = window.roboneo.onChatMessage(addChatMessage);
    const offJob = window.roboneo.onJobState(setJob);
    const offProject = window.roboneo.onProjectUpdated(upsertProject);
    return () => {
      offLog();
      offChat();
      offJob();
      offProject();
    };
  }, [
    setProjects,
    setKeys,
    setSettings,
    addLog,
    addChatMessage,
    setLogs,
    setChatMessages,
    setJob,
    upsertProject,
    setHydrated,
  ]);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-20 flex w-64 flex-col border-r border-border bg-card/80 p-4 backdrop-blur">
        <div className="flex items-center gap-3 px-3 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold">RoboNeo</p>
            <p className="text-xs text-muted-foreground">TikTok Video Studio</p>
          </div>
        </div>
        <nav className="mt-6 space-y-1">
          {nav.map(([label, href, Icon]) => (
            <NavLink
              key={href}
              to={href}
              end={href === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground",
                  isActive && "bg-primary/10 text-primary",
                )
              }
            >
              <Icon className="h-4 w-4" /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto rounded-xl border border-border bg-background/60 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Local-only architecture</p>
          <p className="mt-1 leading-5">
            Keys, assets, projects, CLI processes, and outputs stay on this
            device.
          </p>
        </div>
      </aside>
      <main className="ml-64 min-h-screen flex-1">
        <div className="mx-auto max-w-[1500px] p-8 lg:p-10">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/new" element={<NewVideo />} />
            <Route path="/prompt/:id" element={<PromptReviewPage />} />
            <Route path="/terminal/:id" element={<Terminal />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:id" element={<ProjectEntry />} />
            <Route path="/keys" element={<ApiKeys />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
