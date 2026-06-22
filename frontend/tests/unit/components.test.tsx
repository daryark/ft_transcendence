import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import Button from "../../src/components/Button/Button";
import MiniFigure from "../../src/components/MiniFigure/MiniFigure";
import { EmptyState, Skeleton } from "../../src/components/StateView/StateView";
import GameCountdownOverlay from "../../src/pages/game/components/GameCountdownOverlay";
import GameGarbageQueue from "../../src/pages/game/components/GameGarbageQueue";
import type { Figure } from "../../src/pages/game/types";

const iPiece: Figure = {
  type: "I",
  x: 0,
  y: 0,
  shape: [[1, 1, 1, 1]],
};

describe("shared UI components", () => {
  it("renders enabled mode buttons as navigation links", () => {
    render(
      <MemoryRouter>
        <Button
          description="Play solo"
          path="/solo.svg"
          route="/play/solo"
          title="SOLO"
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /solo play solo/i })).toHaveAttribute(
      "href",
      "/play/solo",
    );
  });

  it("renders disabled mode buttons with a reason and no href", () => {
    render(
      <MemoryRouter>
        <Button
          description="Public rooms"
          disabled
          disabledReason="Sign in required"
          path="/rooms.svg"
          route="/play/rooms"
          title="ROOMS"
        />
      </MemoryRouter>,
    );

    const link = screen.getByRole("link", { name: /rooms public rooms/i });
    expect(link).toHaveAttribute("aria-disabled", "true");
    expect(link).not.toHaveAttribute("href");
    expect(screen.getByText("Sign in required")).toBeInTheDocument();
  });

  it("renders loading skeletons and empty states", () => {
    const { container, rerender } = render(<Skeleton lines={3} />);

    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
    expect(container.querySelectorAll(".skeleton span")).toHaveLength(3);

    rerender(<EmptyState title="No rooms" message="Try again later" />);
    expect(screen.getByRole("heading", { name: "No rooms" })).toBeInTheDocument();
    expect(screen.getByText("Try again later")).toBeInTheDocument();
  });

  it("renders mini figures with accessible piece labels", () => {
    const { container } = render(<MiniFigure figure={iPiece} size={24} />);

    expect(screen.getByLabelText("I piece preview")).toBeInTheDocument();
    expect(container.querySelectorAll(".mini-figure__cell--filled")).toHaveLength(4);
  });

  it("renders countdown and garbage queue overlays", () => {
    const { rerender } = render(
      <GameCountdownOverlay value="3" variant="number" />,
    );

    expect(screen.getByText("3")).toHaveClass("solo-game__countdown--number");

    rerender(
      <GameGarbageQueue
        cellSize={20}
        queue={[
          { id: "a", lines: 2, status: "pending" },
          { id: "b", lines: 1, status: "queued" },
        ]}
        rows={20}
      />,
    );
    expect(screen.getByLabelText("3 pending garbage lines")).toBeInTheDocument();
  });

  it("hides empty garbage queues unless forced visible", () => {
    const { container, rerender } = render(
      <GameGarbageQueue cellSize={20} rows={20} />,
    );

    expect(container).toBeEmptyDOMElement();

    rerender(<GameGarbageQueue alwaysVisible cellSize={20} rows={20} />);
    expect(screen.getByLabelText("0 pending garbage lines")).toBeInTheDocument();
  });
});
