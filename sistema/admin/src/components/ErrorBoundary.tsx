import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'

type Props = {
  children: ReactNode
}

type State = {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {
    // Error logged internally via error boundary mechanism
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
          <div className="max-w-md w-full bg-white shadow rounded-lg p-6 text-center">
            <h1 className="text-xl font-bold text-red-600 mb-2">Algo deu errado</h1>
            <p className="text-sm text-gray-600 mb-4">Ocorreu um erro inesperado na interface administrativa.</p>
            <Button
              type="button"
              onClick={this.handleReload}
              className="rounded bg-[#5d082a] px-4 py-2 text-white hover:bg-[#4a0622]"
            >
              Recarregar pagina
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
