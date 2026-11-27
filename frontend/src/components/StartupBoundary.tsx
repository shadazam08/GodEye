import { Component } from 'react'
import type { ReactNode } from 'react'

import StartupError from './StartupError'

type Props = {
    children: ReactNode
}

type State = {
    hasError: boolean
    error: unknown
}

export default class StartupBoundary extends Component<Props, State> {
    state: State = {
        hasError: false,
        error: null,
    }

    static getDerivedStateFromError(error: unknown): State {
        return {
            hasError: true,
            error,
        }
    }

    render() {
        if (this.state.hasError) {
            return <StartupError error={this.state.error} />
        }

        return this.props.children
    }
}