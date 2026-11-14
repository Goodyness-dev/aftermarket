import React from "react";

// A stale lazy chunk or a failed WebGL inspection must not unmount the depot.
export class InspectionBoundary extends React.Component<
  { children: React.ReactNode; onClose: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="modal-backdrop">
        <section
          className="brief"
          role="alertdialog"
          aria-label="Inspection unavailable"
        >
          <h2>Inspection could not load.</h2>
          <p>
            Your depot is still available. If the game was updated while this
            page was open, refresh to load the current inspection viewer.
          </p>
          <button className="secondary" onClick={this.props.onClose}>
            RETURN TO DEPOT
          </button>
          <button className="primary" onClick={() => location.reload()}>
            REFRESH GAME
          </button>
        </section>
      </div>
    );
  }
}
