import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
}

class SectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[SectionError:${this.props.name || "unknown"}]`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return null; // Silently hide the broken section
    }
    return this.props.children;
  }
}

export default SectionErrorBoundary;
