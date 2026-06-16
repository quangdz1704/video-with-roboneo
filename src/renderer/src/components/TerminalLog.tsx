import { useEffect, useRef } from "react";
import type { LogEntry } from "@shared/types";

export function TerminalLog({ logs }: { logs: LogEntry[] }): JSX.Element {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(
    () => endRef.current?.scrollIntoView({ behavior: "smooth" }),
    [logs.length],
  );
  return (
    <div className="h-[480px] overflow-auto rounded-xl border border-white/10 bg-[#050507] p-4 font-mono text-xs leading-5 shadow-inner">
      {logs.length === 0 ? (
        <div className="text-zinc-600">Terminal output will appear here.</div>
      ) : null}
      {logs.map((log) => (
        <div
          key={log.id}
          className={
            log.stream === "stderr"
              ? "text-rose-400"
              : log.stream === "system"
                ? "text-cyan-300"
                : "text-zinc-300"
          }
        >
          <span className="mr-3 text-zinc-600">
            {new Date(log.timestamp).toLocaleTimeString()}
          </span>
          <span className="whitespace-pre-wrap break-all">{log.message}</span>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
