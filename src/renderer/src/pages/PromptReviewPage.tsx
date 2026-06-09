import { useState } from 'react'
import { ArrowLeft, Play } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStudioStore } from '../store/useStudioStore'
import { PromptReview } from '../components/PromptReview'
import { Button } from '../components/ui/button'

export function PromptReviewPage(): JSX.Element {
  const { id } = useParams()
  const navigate = useNavigate()
  const project = useStudioStore((state) => state.projects.find((item) => item.id === id))
  const upsertProject = useStudioStore((state) => state.upsertProject)
  const [prompt, setPrompt] = useState(project?.finalPrompt || '')
  const [busy, setBusy] = useState(false)
  if (!project?.promptPack) return <p>Project prompt pack not found.</p>
  const run = async (): Promise<void> => {
    setBusy(true)
    const saved = await window.roboneo.updateProject({ ...project, finalPrompt: prompt })
    upsertProject(saved)
    navigate(`/terminal/${project.id}`)
    void window.roboneo.runProject(project.id)
  }
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between"><div><p className="text-sm text-primary">STEP 2 OF 3</p><h1 className="mt-2 text-3xl font-semibold">Review prompt</h1><p className="mt-2 text-muted-foreground">Edit the exact prompt sent to RoboNeo.</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => navigate(`/new?project=${project.id}`)}><ArrowLeft className="h-4 w-4" /> Back</Button><Button disabled={busy || !prompt.trim()} onClick={() => void run()}><Play className="h-4 w-4" /> Run RoboNeo</Button></div></div>
      <PromptReview pack={project.promptPack} finalPrompt={prompt} onChange={setPrompt} />
    </div>
  )
}
