"use client";
import { Component, type ReactNode } from "react";

// If the browser can't start WebGL (old GPU, locked-down laptop), keep the dashboard usable instead of crashing it.
export class GraphBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="grid h-full place-items-center px-6 text-center text-sm text-muted-foreground">
        This browser can&apos;t draw the 3D view. Your jobs and skills are all in the panels.
      </div>
    );
  }
}
