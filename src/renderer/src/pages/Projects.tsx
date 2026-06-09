import { FolderOpen, Pencil, TerminalSquare, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useStudioStore } from '../store/useStudioStore'
import { Card, CardContent } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'

export function Projects(): JSX.Element {
  const projects = useStudioStore((state) => state.projects)
  const setProjects = useStudioStore((state) => state.setProjects)
  const remove = async (id: string): Promise<void> => {
    if (!confirm('Delete this local project and its copied inputs?')) return
    await window.roboneo.deleteProject(id)
    setProjects(projects.filter((item) => item.id !== id))
  }
  return (
    <div className="space-y-6"><div><h1 className="text-3xl font-semibold">Projects & history</h1><p className="mt-2 text-muted-foreground">Local project metadata, rooms, and downloaded artifacts.</p></div>
      <div className="space-y-3">{projects.map((project) => <Card key={project.id}><CardContent className="flex items-center justify-between gap-5 p-5"><div className="min-w-0"><div className="flex items-center gap-3"><p className="truncate font-medium">{project.name}</p><Badge>{project.status.replace('_', ' ')}</Badge><Badge>{(project.mode || 'motion_reference').replaceAll('_', ' ')}</Badge></div><p className="mt-2 line-clamp-1 text-sm text-muted-foreground">{project.brief || 'No brief'}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(project.updatedAt).toLocaleString()} {project.roomId ? `· Room ${project.roomId}` : ''}</p></div><div className="flex shrink-0 gap-2"><Button asChild size="sm" variant="outline"><Link to={`/new?project=${project.id}`}><Pencil className="h-4 w-4" /></Link></Button>{project.status !== 'draft' ? <Button asChild size="sm" variant="outline"><Link to={`/terminal/${project.id}`}><TerminalSquare className="h-4 w-4" /></Link></Button> : null}<Button size="sm" variant="outline" onClick={() => void window.roboneo.openOutputFolder(project.id)}><FolderOpen className="h-4 w-4" /></Button><Button size="sm" variant="ghost" onClick={() => void remove(project.id)}><Trash2 className="h-4 w-4 text-rose-400" /></Button></div></CardContent></Card>)}</div>
    </div>
  )
}
