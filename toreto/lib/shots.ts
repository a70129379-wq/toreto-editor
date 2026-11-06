// The whole site is one camera move. Each entry is a stop on that flight, in order.
export const SHOTS = [
  "hero-front",
  "hero-side",
  "hero-leave",
  "strip-wide",
  "frame-0",
  "frame-1",
  "frame-2",
  "frame-3",
  "frame-4",
  "frame-5",
  "frame-6",
  "frame-7",
  "car-chase",
  "car-close",
  "prop-camera",
  "prop-clapper",
  "prop-headphones",
  "process",
  "dawn",
] as const;

export type Shot = (typeof SHOTS)[number];

export const shotIndex = (s: Shot) => SHOTS.indexOf(s);
export const LAST = SHOTS.length - 1;

/** Scroll progress (0..1) at which the camera arrives at a shot. */
export const shotU = (s: Shot) => shotIndex(s) / LAST;

/** How much scrolling each stop gets. */
export const SCREENS_PER_SHOT = 1.15;

export const NAV: Array<{ label: string; shot: Shot }> = [
  { label: "Start", shot: "hero-front" },
  { label: "About", shot: "hero-side" },
  { label: "Work", shot: "strip-wide" },
  { label: "Speed", shot: "car-chase" },
  { label: "Skills", shot: "prop-camera" },
  { label: "Process", shot: "process" },
  { label: "Contact", shot: "dawn" },
];
