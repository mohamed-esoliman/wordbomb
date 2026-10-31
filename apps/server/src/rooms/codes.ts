import { randomInt } from 'node:crypto';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@wordbomb/shared';

export function generateRoomCode(pickIndex: (max: number) => number = randomInt): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[pickIndex(ROOM_CODE_ALPHABET.length)];
  }
  return code;
}
