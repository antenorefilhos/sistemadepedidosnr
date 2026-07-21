import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from './ui/button'
import { surfaceClasses } from './ui/surface'

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
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#F8F4EA] via-[#FBFAF7] to-white p-6">
          <div className={surfaceClasses({ tone: 'warm', className: 'max-w-md w-full p-6 text-center' })}>
            <h1 className="text-xl font-bold text-[#5D082A] mb-2">Algo deu errado</h1>
            <p className="text-sm text-gray-600 mb-4">Ocorreu um erro inesperado na aplicação.</p>
            <Button
              onClick={this.handleReload}
              variant="primary"
            >
              Recarregar página
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
