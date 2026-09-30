// Hand-drawn line-art icons for the three category types lucide-react
// doesn't cover well (a laced sneaker, a collared/button-up dress shirt as
// distinct from a plain t-shirt, and a stoppered perfume bottle). Built to
// match lucide's own icon language on purpose — 24x24 viewBox, stroke-only,
// round joins, `stroke="currentColor"` — so they drop into the same
// `<Icon size={22} />` call sites as lucide icons and pick up color the
// same way (via the parent's `text-*` class, not a prop on the icon
// itself).
export interface CategoryIconProps {
  size?: number | string;
  className?: string;
}

export function Sneaker({ size = 24, className }: CategoryIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 17v-6a1 1 0 0 1 1-1h2.8L10 6.8A2 2 0 0 1 11.4 6h1.9a1 1 0 0 1 1 1v3.3l3.9 1.6c1 .4 1.8 1.3 1.8 2.4 0 1.5-1.2 2.7-2.7 2.7H3z" />
      <path d="M8 10.5 10.3 8.2" />
      <path d="M3 17v1.2A1.8 1.8 0 0 0 4.8 20h14.4a1.8 1.8 0 0 0 1.8-1.8" />
    </svg>
  );
}

export function CollaredShirt({ size = 24, className }: CategoryIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M9 3 6 5v3l2-1v11a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V7l2 1V5l-3-2-2 2h-2z" />
      <path d="M12 5v14" />
    </svg>
  );
}

export function PerfumeBottle({ size = 24, className }: CategoryIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="9" y="3" width="6" height="3" rx="1" />
      <path d="M10 6v2.3L7.6 10.8A2 2 0 0 0 7 12.2V19a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-6.8a2 2 0 0 0-.6-1.4L14 8.3V6" />
    </svg>
  );
}
