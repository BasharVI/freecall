import { useEffect, useRef } from 'react';
import { useSpeaking } from '../hooks/useSpeaking.js';
import Icon from './Icon.jsx';

const STATUS_TEXT = { new: 'Connecting…', connecting: 'Connecting…', disconnected: 'Reconnecting…', failed: 'Connection failed' };

export default function ParticipantTile({ name, stream, audioOn, videoOn, isLocal, mirror, connectionState, screen }) {
  const videoRef = useRef(null);
  const speaking = useSpeaking(audioOn ? stream : null);
  const showVideo = videoOn && (stream?.getVideoTracks().length ?? 0) > 0;

  useEffect(() => {
    const el = videoRef.current;
    if (el && el.srcObject !== stream) el.srcObject = stream ?? null;
  }, [stream]);

  const initials = name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const status = STATUS_TEXT[connectionState];

  return (
    <div className={`tile ${speaking ? 'tile--speaking' : ''}`}>
      {/* The <video> element also plays remote audio, so it stays mounted even when hidden. */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`tile__video ${mirror ? 'tile__video--mirror' : ''} ${screen ? 'tile__video--contain' : ''}`}
        hidden={!showVideo}
      />
      {!showVideo && (
        <div className="tile__avatar">
          <span className={`avatar avatar--lg ${speaking ? 'avatar--speaking' : ''}`}>{initials}</span>
        </div>
      )}
      <div className="tile__label">
        {!audioOn && <span className="tile__muted"><Icon name="micOff" size={14} /></span>}
        {screen && <Icon name="screen" size={14} />}
        <span>{name}{isLocal && ' (you)'}</span>
      </div>
      {status && <div className="tile__status">{status}</div>}
    </div>
  );
}
