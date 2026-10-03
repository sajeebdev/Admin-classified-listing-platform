import { Component, type ReactNode } from "react";

interface HtmlParserErrorBoundaryProps {
  children: ReactNode;
}

interface HtmlParserErrorBoundaryState {
  hasError: boolean;
}

export class HtmlParserErrorBoundary extends Component<HtmlParserErrorBoundaryProps, HtmlParserErrorBoundaryState> {
  state: HtmlParserErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): HtmlParserErrorBoundaryState {
    return { hasError: true };
  }

  private reset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>The HTML parser encountered a rendering error. Your pasted HTML is preserved; try parsing again or edit it first.</p>
          <button type="button" onClick={this.reset} className="mt-2 font-medium underline">
            Retry parser
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
