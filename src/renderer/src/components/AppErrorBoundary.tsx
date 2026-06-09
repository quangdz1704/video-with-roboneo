import { Component, type ErrorInfo, type ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from './ui/button'

interface Props {
  children: ReactNode
}

interface State {
  error?: Error
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = {}

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Renderer crashed inside React tree', error, info.componentStack)
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-8 text-foreground">
        <div className="w-full max-w-2xl rounded-xl border border-rose-500/30 bg-card p-6">
          <p className="text-sm font-medium text-rose-300">Renderer error</p>
          <h1 className="mt-2 text-2xl font-semibold">This screen could not be rendered.</h1>
          <pre className="mt-4 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-black/40 p-4 text-xs text-rose-200">
            {this.state.error.stack || this.state.error.message}
          </pre>
          <Button className="mt-5" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4" /> Reload app
          </Button>
        </div>
      </div>
    )
  }
}
