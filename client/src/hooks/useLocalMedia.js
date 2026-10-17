import { useEffect, useState } from 'react';

// Acquires the microphone (and camera for video rooms). Falls back to audio-only if the
// camera is unavailable, and to "listen only" if no microphone is available either.
export function useLocalMedia(request) {
  const wantVideo = request?.video;
  const [state, setState] = useState({ stream: null, error: '', loading: true });

  useEffect(() => {
    if (!request) return;
    let cancelled = false;
    let acquired = null;

    async function acquire() {
      setState({ stream: null, error: '', loading: true });
      const audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
      const video = wantVideo ? { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } } : false;
      let error = '';
      try {
        acquired = await navigator.mediaDevices.getUserMedia({ audio, video });
      } catch (err) {
        if (wantVideo) {
          try {
            acquired = await navigator.mediaDevices.getUserMedia({ audio });
            error = 'Camera unavailable — joining with audio only.';
          } catch {
            error = describe(err);
          }
        } else {
          error = describe(err);
        }
      }
      if (cancelled) return acquired?.getTracks().forEach((t) => t.stop());
      setState({ stream: acquired, error, loading: false });
    }

    acquire();
    return () => {
      cancelled = true;
      acquired?.getTracks().forEach((t) => t.stop());
    };
  }, [request != null, wantVideo]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}

function describe(err) {
  if (!navigator.mediaDevices) return 'Media devices need a secure context (https or localhost). You can still listen in.';
  if (err?.name === 'NotAllowedError') return 'Microphone/camera permission denied. You can still join and listen.';
  if (err?.name === 'NotFoundError') return 'No microphone or camera found. You can still join and listen.';
  return `Could not access media devices (${err?.message ?? err}). You can still join and listen.`;
}
