import { useEffect, useRef, useState } from 'react'
import { ArrowRight, FileImage, Film, ImagePlay, Sparkles } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { GenerationMode, Project } from '@shared/types'
import { generatePromptPack } from '@shared/promptTemplates'
import { useStudioStore } from '../store/useStudioStore'
import { AssetPreview } from '../components/AssetPreview'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'

export function NewVideo(): JSX.Element {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const projectId = params.get('project')
  const projects = useStudioStore((state) => state.projects)
  const keys = useStudioStore((state) => state.keys)
  const upsertProject = useStudioStore((state) => state.upsertProject)
  const settings = useStudioStore((state) => state.settings)
  const existing = projects.find((item) => item.id === projectId)
  const [project, setProject] = useState<Project | null>(existing || null)
  const [busy, setBusy] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [saveError, setSaveError] = useState('')
  const persistedRef = useRef(Boolean(existing))
  const projectRef = useRef<Project | null>(existing || null)
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve())
  const loadAttemptedRef = useRef(Boolean(existing))
  const mode = project?.mode || 'motion_reference'

  useEffect(() => {
    if (project || !settings) return
    if (projectId) {
      if (loadAttemptedRef.current) return
      loadAttemptedRef.current = true
      setBusy(true)
      window.roboneo.getProject(projectId).then((stored) => {
        if (!stored) {
          setNotFound(true)
          return
        }
        persistedRef.current = true
        projectRef.current = stored
        setProject(stored)
        upsertProject(stored)
      }).finally(() => setBusy(false))
      return
    }
    const now = new Date().toISOString()
    const draft: Project = {
      id: crypto.randomUUID(),
      name: `TikTok video ${new Date().toLocaleDateString()}`,
      mode: 'motion_reference',
      brief: '',
      mood: 'Modern and energetic',
      duration: settings.defaultDuration,
      language: settings.defaultLanguage,
      aspectRatio: settings.defaultAspectRatio,
      resolution: settings.defaultResolution,
      apiKeyId: keys.find((key) => key.status === 'active')?.id,
      assets: {},
      status: 'draft',
      outputFiles: [],
      createdAt: now,
      updatedAt: now
    }
    projectRef.current = draft
    setProject(draft)
  }, [project, projectId, settings, keys, upsertProject])

  const persist = (next: Project): Promise<void> => {
    const operation = saveQueueRef.current.then(async () => {
      const saved = persistedRef.current
        ? await window.roboneo.updateProject(next)
        : await window.roboneo.createProject(next)
      persistedRef.current = true
      setSaveError('')
      upsertProject(saved)
    })
    saveQueueRef.current = operation.catch((error) => {
      setSaveError(error instanceof Error ? error.message : String(error))
    })
    return operation
  }
  const patch = (value: Partial<Project>): void => {
    const current = projectRef.current
    if (!current) return
    const changed = Object.entries(value).some(([key, nextValue]) => current[key as keyof Project] !== nextValue)
    if (!changed) return
    const next = { ...current, ...value }
    projectRef.current = next
    setProject(next)
    void persist(next).catch(() => undefined)
  }
  const selectMode = (nextMode: GenerationMode): void => patch({ mode: nextMode })
  const chooseAsset = async (slot: 'characterImage' | 'secondImage' | 'referenceVideo', kind: 'image' | 'video'): Promise<void> => {
    const current = projectRef.current
    if (!current) return
    if (!persistedRef.current) {
      try {
        await persist(current)
      } catch {
        return
      }
    }
    const selected = await window.roboneo.selectAsset({ projectId: current.id, slot, kind })
    if (selected) patch({ assets: { ...projectRef.current!.assets, [slot]: selected } })
  }
  const review = async (): Promise<void> => {
    if (!project || !project.brief.trim()) return
    setBusy(true)
    const promptPack = generatePromptPack({
      brief: project.brief,
      mood: project.mood,
      duration: project.duration,
      hasVideo: Boolean(project.assets.referenceVideo),
      mode
    })
    await saveQueueRef.current
    const saved = await window.roboneo.updateProject({ ...projectRef.current!, promptPack, finalPrompt: promptPack.finalPrompt })
    upsertProject(saved)
    setBusy(false)
    navigate(`/prompt/${project.id}`)
  }

  if (!project) return <div className="text-muted-foreground">{notFound ? 'Draft project not found.' : busy ? 'Loading local project...' : 'Loading...'}</div>
  const modeOptions: Array<{ id: GenerationMode; label: string; description: string; icon: typeof Film }> = [
    { id: 'motion_reference', label: 'Motion Reference', description: 'Character image + reference motion video', icon: ImagePlay },
    { id: 'text_to_image', label: 'Text to Image', description: 'Generate a still image from your brief', icon: FileImage },
    { id: 'text_to_video', label: 'Text to Video', description: 'Generate a video without reference assets', icon: Film },
    { id: 'image_to_video', label: 'Image to Video', description: 'Animate one or two reference images', icon: Sparkles }
  ]
  const assetsValid =
    mode === 'motion_reference'
      ? Boolean(project.assets.characterImage && project.assets.referenceVideo)
      : mode === 'image_to_video'
        ? Boolean(project.assets.characterImage)
        : true
  return (
    <div className="space-y-7">
      <div><p className="text-sm text-primary">STEP 1 OF 3</p><h1 className="mt-2 text-3xl font-semibold">Create with RoboNeo</h1><p className="mt-2 text-muted-foreground">Choose a generation workflow. Local assets are copied into the project input folder.</p></div>
      {saveError ? <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">Could not save draft: {saveError}</p> : null}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {modeOptions.map((option) => {
          const Icon = option.icon
          return <button key={option.id} onClick={() => selectMode(option.id)} className={`rounded-xl border p-4 text-left transition ${mode === option.id ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/50'}`}><Icon className={`mb-3 h-5 w-5 ${mode === option.id ? 'text-primary' : 'text-muted-foreground'}`} /><p className="font-medium">{option.label}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{option.description}</p></button>
        })}
      </div>
      {mode === 'motion_reference' ? <div className="grid gap-4 lg:grid-cols-3">
        <AssetPreview label="Character image" type="image" path={project.assets.characterImage} onSelect={() => void chooseAsset('characterImage', 'image')} />
        <AssetPreview label="Second reference" type="image" optional path={project.assets.secondImage} onSelect={() => void chooseAsset('secondImage', 'image')} />
        <AssetPreview label="Motion reference" type="video" path={project.assets.referenceVideo} onSelect={() => void chooseAsset('referenceVideo', 'video')} />
      </div> : null}
      {mode === 'image_to_video' ? <div className="grid gap-4 lg:grid-cols-2">
        <AssetPreview label="Source image" type="image" path={project.assets.characterImage} onSelect={() => void chooseAsset('characterImage', 'image')} />
        <AssetPreview label="Second reference" type="image" optional path={project.assets.secondImage} onSelect={() => void chooseAsset('secondImage', 'image')} />
      </div> : null}
      {mode === 'text_to_image' || mode === 'text_to_video' ? <Card><CardContent className="p-5 text-sm text-muted-foreground">This workflow does not require an uploaded asset. RoboNeo will generate directly from the final prompt.</CardContent></Card> : null}
      <Card>
        <CardHeader><CardTitle>Creative brief</CardTitle></CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <label className="space-y-2"><span className="text-sm font-medium">Project name</span><Input value={project.name} onChange={(event) => patch({ name: event.target.value })} /></label>
          <label className="space-y-2"><span className="text-sm font-medium">API key</span>
            <select value={project.apiKeyId || ''} onChange={(event) => patch({ apiKeyId: event.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Select a key</option>{keys.filter((key) => key.status === 'active').map((key) => <option key={key.id} value={key.id}>{key.label} · {key.maskedKey}</option>)}
            </select>
          </label>
          <label className="space-y-2 md:col-span-2"><span className="text-sm font-medium">{mode === 'text_to_image' ? 'Describe the image' : 'What should happen in the video?'}</span><Textarea value={project.brief} onChange={(event) => patch({ brief: event.target.value })} placeholder={mode === 'text_to_image' ? 'Describe subject, composition, lighting, style, colors, and intended use...' : 'Describe the scene, action, camera, product, audience, and desired ending...'} /></label>
          <label className="space-y-2"><span className="text-sm font-medium">Mood / style</span><Input value={project.mood} onChange={(event) => patch({ mood: event.target.value })} /></label>
          <label className="space-y-2"><span className="text-sm font-medium">Duration (seconds)</span><Input type="number" min={1} max={60} value={project.duration} onChange={(event) => patch({ duration: Number(event.target.value) })} /></label>
        </CardContent>
      </Card>
      <div className="flex justify-end"><Button size="lg" disabled={busy || !assetsValid || !project.brief.trim() || !project.apiKeyId} onClick={() => void review()}><Sparkles className="h-4 w-4" /> Generate prompt pack <ArrowRight className="h-4 w-4" /></Button></div>
    </div>
  )
}
