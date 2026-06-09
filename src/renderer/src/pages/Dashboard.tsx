import { Activity, CircleCheck, Clock3, FolderKanban, Plus, TerminalSquare, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useStudioStore } from '../store/useStudioStore'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'

export function Dashboard(): JSX.Element {
  const projects = useStudioStore((state) => state.projects)
  const completed = projects.filter((item) => item.status === 'completed').length
  const running = projects.filter((item) => item.status === 'running').length
  const metrics: Array<[string, number, LucideIcon]> = [
    ['Projects', projects.length, FolderKanban],
    ['Running', running, Activity],
    ['Completed', completed, CircleCheck]
  ]
  return (
    <div className="space-y-7">
      <div className="flex items-end justify-between">
        <div><p className="mb-2 text-sm text-primary">LOCAL AI VIDEO WORKSPACE</p><h1 className="text-4xl font-semibold tracking-tight">RoboNeo TikTok Video Studio</h1><p className="mt-3 text-muted-foreground">Create, run, and download TikTok-ready videos without an online backend.</p></div>
        <Button asChild size="lg"><Link to="/new"><Plus className="h-4 w-4" /> New video</Link></Button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {metrics.map(([label, value, Icon]) => (
          <Card key={String(label)}><CardContent className="flex items-center justify-between p-6"><div><p className="text-sm text-muted-foreground">{String(label)}</p><p className="mt-1 text-3xl font-semibold">{String(value)}</p></div><Icon className="h-8 w-8 text-primary" /></CardContent></Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle>Recent projects</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {projects.slice(0, 6).map((project) => (
            <Link key={project.id} to={project.status === 'draft' ? `/new?project=${project.id}` : `/terminal/${project.id}`} className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-accent">
              <div><p className="font-medium">{project.name}</p><p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="h-3 w-3" /> {new Date(project.updatedAt).toLocaleString()}</p></div>
              <div className="flex items-center gap-3"><Badge>{project.status.replace('_', ' ')}</Badge><TerminalSquare className="h-4 w-4 text-muted-foreground" /></div>
            </Link>
          ))}
          {projects.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">No projects yet.</p> : null}
        </CardContent>
      </Card>
    </div>
  )
}
