export const roomUrl = (roomId) => `${window.location.origin}/room/${roomId}`;

// Phones get the native share sheet (WhatsApp, Messages, …); everything else copies the link.
// Returns 'shared', 'copied', or null if the user dismissed the share sheet.
export async function shareRoom(room) {
  const url = roomUrl(room.id);
  const isTouch = window.matchMedia?.('(pointer: coarse)').matches;
  if (isTouch && navigator.share) {
    try {
      await navigator.share({ title: `${room.name} · FreeCall`, text: `Join "${room.name}" on FreeCall`, url });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return null;
    }
  }
  await copyText(url);
  return 'copied';
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback for non-secure contexts (e.g. plain http on a LAN).
    const el = Object.assign(document.createElement('textarea'), { value: text });
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.append(el);
    el.select();
    document.execCommand('copy');
    el.remove();
  }
}
