import type { CSSProperties } from "react";

const avatarColors = [
  "#d6cc1e",
  "#8ed053",
  "#6ec6ff",
  "#ff7f50",
  "#c986ff",
  "#ffcc66",
  "#6ee7b7",
  "#ef6f8f",
  "#a7f3d0",
  "#f97316",
  "#93c5fd",
  "#f0abfc",
  "#fde047",
  "#34d399",
  "#fb7185",
  "#60a5fa",
  "#c4b5fd",
  "#facc15",
  "#5eead4",
  "#e879f9",
];

export const getAvatarStyle = (avatarId?: number) => {
  const index =
    avatarId && avatarId >= 1 && avatarId <= avatarColors.length
      ? avatarId - 1
      : 0;

  return { "--avatar-color": avatarColors[index] } as CSSProperties;
};
