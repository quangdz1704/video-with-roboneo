import { useEffect, useState } from 'react'
import { CheckCircle2, CircleX, Save } from 'lucide-react'
import type { AppSettings } from '@shared/types'
import { useStudioStore } from '../store/useStudioStore'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'

export function Settings(): JSX.Element {
  const globalSettings = useStudioStore((state) => state.settings)
  const setGlobalSettings = useStudioStore((state) => state.setSettings)
  const [settings, setSettings] = useState<AppSettings | undefined>(globalSettings)
  const [environment, setEnvironment] = useState<Awaited<ReturnType<typeof window.roboneo.checkEnvironment>>>()
  useEffect(() => { void window.roboneo.checkEnvironment().then(setEnvironment) }, [])
  if (!settings) return <p>Loading settings...</p>
  const patch = (value: Partial<AppSettings>): void => setSettings({ ...settings, ...value })
  return (
    <div className="space-y-6"><div><h1 className="text-3xl font-semibold">Settings</h1><p className="mt-2 text-muted-foreground">Local CLI, polling, and output defaults.</p></div>
      <Card><CardHeader><CardTitle>Environment</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2"><div className="flex items-center gap-3 rounded-lg border border-border p-4">{environment?.node.ok ? <CheckCircle2 className="text-emerald-400" /> : <CircleX className="text-rose-400" />}<div><p className="font-medium">Node.js</p><p className="text-xs text-muted-foreground">{environment?.node.version || 'Not detected'}</p></div></div><div className="flex items-center gap-3 rounded-lg border border-border p-4">{environment?.cli.ok ? <CheckCircle2 className="text-emerald-400" /> : <CircleX className="text-rose-400" />}<div><p className="font-medium">RoboNeo CLI</p><p className="text-xs text-muted-foreground">{environment?.cli.version || `Missing · ${environment?.cli.installCommand || 'npm install -g roboneo-cli'}`}</p></div></div></CardContent></Card>
      <Card><CardHeader><CardTitle>Studio defaults</CardTitle></CardHeader><CardContent className="grid gap-5 md:grid-cols-2">
        <label className="space-y-2"><span className="text-sm font-medium">RoboNeo CLI path</span><Input value={settings.cliPath} onChange={(e) => patch({ cliPath: e.target.value })} /></label>
        <label className="space-y-2"><span className="text-sm font-medium">Output folder</span><Input value={settings.outputFolder} onChange={(e) => patch({ outputFolder: e.target.value })} /></label>
        <label className="space-y-2"><span className="text-sm font-medium">Poll interval (ms)</span><Input type="number" min={3000} value={settings.pollIntervalMs} onChange={(e) => patch({ pollIntervalMs: Number(e.target.value) })} /></label>
        <label className="space-y-2"><span className="text-sm font-medium">Default duration</span><Input type="number" min={1} value={settings.defaultDuration} onChange={(e) => patch({ defaultDuration: Number(e.target.value) })} /></label>
        <label className="space-y-2"><span className="text-sm font-medium">Default language</span><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={settings.defaultLanguage} onChange={(e) => patch({ defaultLanguage: e.target.value as 'en' | 'vi' })}><option value="en">English</option><option value="vi">Vietnamese</option></select></label>
        <label className="space-y-2"><span className="text-sm font-medium">Resolution</span><Input value={settings.defaultResolution} onChange={(e) => patch({ defaultResolution: e.target.value })} /></label>
      </CardContent></Card>
      <div className="flex justify-end"><Button onClick={async () => { const saved = await window.roboneo.saveSettings(settings); setGlobalSettings(saved) }}><Save className="h-4 w-4" /> Save settings</Button></div>
    </div>
  )
}
