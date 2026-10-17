import { useEffect, useState } from 'react';

let audioContext = null;

// Returns true while the given stream's audio level is above a speaking threshold.
export function useSpeaking(stream) {
  const [speaking, setSpeaking] = useState(false);
  const track = stream?.getAudioTracks()[0] ?? null;

  useEffect(() => {
    if (!track) return setSpeaking(false);
    audioContext ??= new AudioContext();
    audioContext.resume().catch(() => {});

    const source = audioContext.createMediaStreamSource(new MediaStream([track]));
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);

    let current = false;
    let quietTicks = 0;
    const timer = setInterval(() => {
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const s of samples) sum += ((s - 128) / 128) ** 2;
      const loud = Math.sqrt(sum / samples.length) > 0.035;
      quietTicks = loud ? 0 : quietTicks + 1;
      const next = loud || (current && quietTicks < 4); // short hold to avoid flicker
      if (next !== current) setSpeaking((current = next));
    }, 100);

    return () => {
      clearInterval(timer);
      source.disconnect();
    };
  }, [track]);

  return speaking;
}
