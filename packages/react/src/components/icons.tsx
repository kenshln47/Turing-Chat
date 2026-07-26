/**
 * @module icons
 * The icon set used across Turing Chat.
 *
 * These replace the emoji the UI previously used as icons. Emoji are rendered
 * by the operating system, so the same interface looked different on every
 * machine, ignored the theme's colours entirely, and could not be sized to sit
 * on the text baseline. These are inline SVG: they inherit `currentColor`,
 * scale with the `size` prop, and look identical everywhere.
 *
 * Stroke-based, 24×24 viewBox, 1.75 stroke width — a single consistent weight.
 */

import type { SVGProps } from 'react';

/** Props shared by every icon. */
export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Edge length in pixels. @default 16 */
  size?: number;
}

/** Shared attributes so every icon keeps the same optical weight. */
function base(size: number) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
  };
}

/** Two columns side by side — comparison mode. */
export function CompareIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <rect x="3" y="4" width="7" height="16" rx="1.5" />
      <rect x="14" y="4" width="7" height="16" rx="1.5" />
    </svg>
  );
}

/** Play triangle — execute. */
export function PlayIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M7 4.5l12 7.5-12 7.5z" />
    </svg>
  );
}

/** Chevron, rotated by the `direction` prop. */
export function ChevronIcon({
  size = 16,
  direction = 'down',
  ...props
}: IconProps & { direction?: 'up' | 'down' | 'left' | 'right' }) {
  const rotation = { down: 0, up: 180, left: 90, right: -90 }[direction];
  return (
    <svg {...base(size)} style={{ transform: `rotate(${rotation}deg)`, ...props.style }} {...props}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/** Triangle with an exclamation — warnings and errors. */
export function WarningIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

/** Lightning bolt — tool invocation. */
export function BoltIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M13 2L4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5z" />
    </svg>
  );
}

/** Gauge — performance and speed. */
export function GaugeIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M12 21a9 9 0 100-18 9 9 0 000 18z" />
      <path d="M12 12l4-4" />
      <path d="M12 12h.01" />
    </svg>
  );
}

/** Trophy — standings. */
export function TrophyIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M7 4h10v5a5 5 0 01-10 0V4z" />
      <path d="M7 6H4.5a2.5 2.5 0 000 5H7M17 6h2.5a2.5 2.5 0 010 5H17" />
      <path d="M12 14v4M9 21h6" />
    </svg>
  );
}

/** Eye with a slash — hidden identity, blind mode. */
export function EyeOffIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M9.9 5.2A9.7 9.7 0 0112 5c6 0 10 7 10 7a17 17 0 01-3 3.7M6.6 6.6A17 17 0 002 12s4 7 10 7a9.7 9.7 0 005.4-1.6" />
      <path d="M9.9 9.9a3 3 0 104.2 4.2" />
      <path d="M2 2l20 20" />
    </svg>
  );
}

/** Open eye — reveal. */
export function EyeIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** Downward arrow into a tray — download and export. */
export function DownloadIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <path d="M7 10l5 5 5-5M12 15V3" />
    </svg>
  );
}

/** Trash can — destructive actions. */
export function TrashIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
    </svg>
  );
}

/** Angle brackets — code. */
export function CodeIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" />
    </svg>
  );
}

/** Shield — security. */
export function ShieldIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

/** Document with lines — writing and tests. */
export function FileTextIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6M8 13h8M8 17h5" />
    </svg>
  );
}

/** Magnifier over a circle — debugging and inspection. */
export function SearchIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

/** Overlapping rectangles — copy. */
export function CopyIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

/** Tick — confirmation. */
export function CheckIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

/** Circular arrow — refresh. */
export function RefreshIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M21 12a9 9 0 11-2.6-6.4M21 3v6h-6" />
    </svg>
  );
}

/** Concentric circles — the idle arena mark. */
export function TargetIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <circle cx="12" cy="12" r="9" strokeDasharray="3 3" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
