export const AVATAR_SHAPES = ['circle', 'square', 'hex', 'diamond'] as const;
export const AVATAR_FACES = ['happy', 'cool', 'sleepy', 'wow'] as const;

export type AvatarShape = (typeof AVATAR_SHAPES)[number];
export type AvatarFace = (typeof AVATAR_FACES)[number];
export type AvatarId = `${AvatarShape}-${AvatarFace}`;

export const AVATAR_IDS = AVATAR_SHAPES.flatMap((shape) =>
  AVATAR_FACES.map((face): AvatarId => `${shape}-${face}`),
);

export const MEMBER_COLORS = [
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#0ea5e9',
  '#6366f1',
  '#a855f7',
  '#ec4899',
  '#f43f5e',
  '#84cc16',
  '#06b6d4',
  '#d946ef',
] as const;
