// No site não há push (avisos chegam pelo app no celular).
export async function registerForPush(_profileId: string): Promise<'ok' | 'denied' | 'unavailable'> {
  return 'unavailable';
}
