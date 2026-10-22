import { describe, expect, it } from 'vitest';
import { localGreeting } from './greeting';

describe('salutation selon l’heure locale de l’appareil', () => {
  it.each([
    [0, 0, 'Bonsoir', '🌙'], [4, 59, 'Bonsoir', '🌙'],
    [5, 0, 'Bonjour', '☀️'], [11, 59, 'Bonjour', '☀️'],
    [12, 0, 'Bon après-midi', '🌤️'], [17, 59, 'Bon après-midi', '🌤️'],
    [18, 0, 'Bonsoir', '🌙'], [23, 59, 'Bonsoir', '🌙'],
  ])('%ih%im → %s', (hour, minute, message, emoji) => {
    expect(localGreeting(new Date(2026, 9, 22, hour, minute))).toEqual({ message, emoji });
  });
});
