import { AVATAR_FACES, type AvatarFace, type AvatarShape } from '@wordbomb/shared';

interface AvatarProps {
  id: string;
  color: string;
  size?: number;
  className?: string;
}

const shapes: Record<AvatarShape, string> = {
  circle: 'M50 4a46 46 0 1 1 0 92a46 46 0 1 1 0-92z',
  square:
    'M18 6h64a12 12 0 0 1 12 12v64a12 12 0 0 1-12 12H18A12 12 0 0 1 6 82V18A12 12 0 0 1 18 6z',
  hex: 'M50 4l40 23v46L50 96 10 73V27z',
  diamond: 'M50 3l44 47-44 47L6 50z',
};

function Face({ face }: { face: AvatarFace }) {
  const ink = '#0b0d14';
  switch (face) {
    case 'happy':
      return (
        <g fill={ink} stroke={ink} strokeWidth="5" strokeLinecap="round">
          <circle cx="36" cy="42" r="5" stroke="none" />
          <circle cx="64" cy="42" r="5" stroke="none" />
          <path d="M34 60q16 14 32 0" fill="none" />
        </g>
      );
    case 'cool':
      return (
        <g fill={ink} stroke={ink} strokeWidth="5" strokeLinecap="round">
          <rect x="24" y="36" width="22" height="12" rx="4" stroke="none" />
          <rect x="54" y="36" width="22" height="12" rx="4" stroke="none" />
          <path d="M46 42h8" />
          <path d="M38 64h24" fill="none" />
        </g>
      );
    case 'sleepy':
      return (
        <g fill="none" stroke={ink} strokeWidth="5" strokeLinecap="round">
          <path d="M28 44q8 6 16 0" />
          <path d="M56 44q8 6 16 0" />
          <circle cx="50" cy="64" r="5" fill={ink} stroke="none" />
        </g>
      );
    case 'wow':
      return (
        <g fill={ink}>
          <circle cx="36" cy="40" r="6" />
          <circle cx="64" cy="40" r="6" />
          <ellipse cx="50" cy="64" rx="8" ry="10" />
        </g>
      );
  }
}

export function Avatar({ id, color, size = 48, className }: AvatarProps) {
  const [shape, face] = id.split('-') as [AvatarShape, AvatarFace];
  const path = shapes[shape] ?? shapes.circle;
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={`${shape} ${face} avatar`}
    >
      <path d={path} fill={color} />
      <Face face={AVATAR_FACES.includes(face) ? face : 'happy'} />
    </svg>
  );
}
