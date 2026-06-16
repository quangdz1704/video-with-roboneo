import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Coins,
  KeyRound,
  Pause,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useStudioStore } from "../store/useStudioStore";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";

export function ApiKeys(): JSX.Element {
  const keys = useStudioStore((state) => state.keys);
  const setKeys = useStudioStore((state) => state.setKeys);
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [loadingCredit, setLoadingCredit] = useState<string>();
  const autoLoadedRef = useRef(false);
  const save = async (): Promise<void> => {
    try {
      const result = await window.roboneo.saveKey({
        label,
        apiKey,
        note,
        status: "active",
      });
      setKeys(result);
      setLabel("");
      setApiKey("");
      setNote("");
      setMessage(
        "API key saved. Copied command wrappers are removed automatically.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };
  const toggle = async (
    id: string,
    status: "active" | "paused",
    currentLabel: string,
  ): Promise<void> => {
    setKeys(await window.roboneo.saveKey({ id, label: currentLabel, status }));
  };
  const loadCredit = async (id: string): Promise<void> => {
    setLoadingCredit(id);
    try {
      const result = await window.roboneo.loadKeyCredit(id);
      setKeys(result.keys);
      setMessage(result.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoadingCredit(undefined);
    }
  };
  const loadAllCredits = async (): Promise<void> => {
    setLoadingCredit("all");
    let loaded = 0;
    const keysToLoad = keys;
    try {
      for (const key of keysToLoad) {
        const result = await window.roboneo.loadKeyCredit(key.id);
        setKeys(result.keys);
        if (result.ok) loaded += 1;
      }
      setMessage(
        `Loaded carrot balance for ${loaded}/${keysToLoad.length} key(s).`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoadingCredit(undefined);
    }
  };
  useEffect(() => {
    if (autoLoadedRef.current || !keys.length) return;
    autoLoadedRef.current = true;
    void loadAllCredits();
  }, [keys.length]);

  console.log("message", message);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold">API keys</h1>
          <p className="mt-2 text-muted-foreground">
            Keys are encrypted locally and injected only into the selected
            RoboNeo process.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={!keys.length || Boolean(loadingCredit)}
          onClick={() => void loadAllCredits()}
        >
          <RefreshCw
            className={`h-4 w-4 ${loadingCredit === "all" ? "animate-spin" : ""}`}
          />{" "}
          Load all credits
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" /> Add RoboNeo key
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-[1fr_1.4fr_1fr_auto]">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label"
            />
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste only the access key"
            />
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note (optional)"
            />
            <Button
              disabled={!label.trim() || !apiKey.trim()}
              onClick={() => void save()}
            >
              <Save className="h-4 w-4" /> Save
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            You may also paste <code>ROBONEO_ACCESS_KEY="..."</code> or{" "}
            <code>roboneo config access_token "..."</code>; the app extracts the
            token automatically.
          </p>
        </CardContent>
      </Card>
      {message ? (
        <p className="whitespace-pre-line rounded-lg border border-border bg-card p-3 text-sm">
          {message}
        </p>
      ) : null}
      <div className="space-y-3">
        {keys.map((key) => (
          <Card key={key.id}>
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <div className="flex items-center gap-3">
                  <p className="font-medium">{key.label}</p>
                  <Badge>{key.status}</Badge>
                  {key.creditBalance !== undefined ? (
                    <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-300">
                      <Coins className="mr-1 h-3 w-3" /> × {key.creditBalance}
                    </Badge>
                  ) : null}
                  {key.creditError ? (
                    <Badge className="border-rose-500/30 bg-rose-500/10 text-rose-300">
                      Credit unavailable
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 font-mono text-sm text-muted-foreground">
                  {key.maskedKey}
                </p>
                {key.creditError ? (
                  <p className="mt-2 max-w-2xl text-xs text-rose-300">
                    {key.creditError}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  Used {key.usedCount} times{" "}
                  {key.lastUsedAt
                    ? `· Last ${new Date(key.lastUsedAt).toLocaleString()}`
                    : ""}
                  {key.creditLoadedAt
                    ? ` · Credit checked ${new Date(key.creditLoadedAt).toLocaleString()}`
                    : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={Boolean(loadingCredit)}
                  onClick={() => void loadCredit(key.id)}
                >
                  <Coins
                    className={`h-4 w-4 ${loadingCredit === key.id ? "animate-spin" : ""}`}
                  />{" "}
                  Credit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const result = await window.roboneo.validateKey(key.id);
                    setMessage(result.message);
                  }}
                >
                  <ShieldCheck className="h-4 w-4" /> Validate
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const result = await window.roboneo.saveKeyToConfig(key.id);
                    setMessage(result.message);
                  }}
                >
                  <CheckCircle2 className="h-4 w-4" /> Save to CLI
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void toggle(
                      key.id,
                      key.status === "active" ? "paused" : "active",
                      key.label,
                    )
                  }
                >
                  <Pause className="h-4 w-4" />{" "}
                  {key.status === "active" ? "Pause" : "Activate"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () =>
                    setKeys(await window.roboneo.deleteKey(key.id))
                  }
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
