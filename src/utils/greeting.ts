/** Uses the device's local clock, including its timezone and daylight saving time. */
export function localGreeting(date = new Date()): { message: string; emoji: string } {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return { message: 'Bonjour', emoji: '☀️' };
  if (hour >= 12 && hour < 18) return { message: 'Bon après-midi', emoji: '🌤️' };
  return { message: 'Bonsoir', emoji: '🌙' };
}
