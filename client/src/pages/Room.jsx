import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, getSavedName, saveName } from '../api.js';
import { getSocket } from '../socket.js';
import { useLocalMedia } from '../hooks/useLocalMedia.js';
import { useRoomCall } from '../hooks/useRoomCall.js';
import ParticipantTile from '../components/ParticipantTile.jsx';
import Icon from '../components/Icon.jsx';

const DEFAULT_ICE = [{ urls: 'stun:stun.l.google.com:19302' }];
const canShareScreen = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia;

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [roomInfo, setRoomInfo] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [iceServers, setIceServers] = useState(null);
  const [name, setName] = useState(getSavedName);
  const [stage, setStage] = useState('prejoin'); // prejoin | call
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [screenTrack, setScreenTrack] = useState(null);
  const [copied, setCopied] = useState(false);

  const isVideoRoom = roomInfo?.type === 'video';
  const mediaRequest = useMemo(() => (roomInfo ? { video: isVideoRoom } : null), [roomInfo != null, isVideoRoom]); // eslint-disable-line
  const { stream, error: mediaError, loading: mediaLoading } = useLocalMedia(mediaRequest);
  const hasMic = (stream?.getAudioTracks().length ?? 0) > 0;
  const hasCam = (stream?.getVideoTracks().length ?? 0) > 0;

  // Room details + live participant count while on the pre-join screen.
  useEffect(() => {
    api.getRoom(roomId).then(setRoomInfo).catch((err) => setLoadError(err.message));
    api.iceServers().then(setIceServers).catch(() => setIceServers(DEFAULT_ICE));
    const socket = getSocket();
    const onRooms = (rooms) => {
      const match = rooms.find((r) => r.id === roomId);
      if (match) setRoomInfo(match);
    };
    socket.on('rooms', onRooms);
    return () => socket.off('rooms', onRooms);
  }, [roomId]);

  // Muting just disables the track, so peers don't need to renegotiate.
  useEffect(() => {
    stream?.getAudioTracks().forEach((t) => (t.enabled = micOn));
    stream?.getVideoTracks().forEach((t) => (t.enabled = camOn));
  }, [stream, micOn, camOn]);

  const mediaState = {
    audio: hasMic && micOn,
    video: (hasCam && camOn) || !!screenTrack,
    screen: !!screenTrack,
  };

  const call = useRoomCall({
    roomId,
    name: name.trim() || 'Guest',
    localStream: stream,
    iceServers,
    mediaState,
    enabled: stage === 'call' && !!iceServers,
  });

  // Stop screen sharing on unmount.
  const screenRef = useRef(null);
  screenRef.current = screenTrack;
  useEffect(() => () => screenRef.current?.stop(), []);

  function stopScreenShare() {
    screenRef.current?.stop();
    setScreenTrack(null);
    call.setScreenTrack(null);
  }

  async function toggleScreenShare() {
    if (screenTrack) return stopScreenShare();
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false });
      const track = display.getVideoTracks()[0];
      track.contentHint = 'detail';
      track.onended = stopScreenShare;
      setScreenTrack(track);
      call.setScreenTrack(track);
    } catch {
      /* user cancelled the picker */
    }
  }

  async function copyLink() {
    await navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function join(e) {
    e.preventDefault();
    saveName(name);
    setStage('call');
  }

  function retry() {
    setStage('prejoin');
  }

  const localDisplayStream = useMemo(
    () => (screenTrack ? new MediaStream([screenTrack, ...(stream?.getAudioTracks() ?? [])]) : stream),
    [screenTrack, stream],
  );

  if (loadError) {
    return (
      <div className="center-screen">
        <h2>Room unavailable</h2>
        <p className="muted">{loadError}</p>
        <Link className="btn btn--primary" to="/">Back to lobby</Link>
      </div>
    );
  }
  if (!roomInfo) return <div className="center-screen muted">Loading room…</div>;

  const localTile = (
    <ParticipantTile
      name={name.trim() || 'Guest'}
      stream={localDisplayStream}
      audioOn={mediaState.audio}
      videoOn={mediaState.video}
      screen={mediaState.screen}
      mirror={!screenTrack}
      isLocal
    />
  );

  const micButton = (
    <button type="button" className={`ctrl ${micOn && hasMic ? '' : 'ctrl--off'}`} disabled={!hasMic}
      onClick={() => setMicOn((v) => !v)} title={micOn ? 'Mute' : 'Unmute'}>
      <Icon name={micOn && hasMic ? 'mic' : 'micOff'} />
    </button>
  );
  const camButton = isVideoRoom && (
    <button type="button" className={`ctrl ${camOn && hasCam ? '' : 'ctrl--off'}`} disabled={!hasCam}
      onClick={() => setCamOn((v) => !v)} title={camOn ? 'Turn camera off' : 'Turn camera on'}>
      <Icon name={camOn && hasCam ? 'video' : 'videoOff'} />
    </button>
  );

  // ---------- Pre-join ----------
  if (stage === 'prejoin') {
    const full = roomInfo.participantCount >= roomInfo.maxParticipants;
    return (
      <div className="prejoin">
        <Link to="/" className="back-link"><Icon name="back" size={18} /> Lobby</Link>
        <div className="prejoin__card">
          <div className="prejoin__preview">
            {mediaLoading ? <div className="tile tile--placeholder muted">Requesting devices…</div> : localTile}
            <div className="prejoin__controls">{micButton}{camButton}</div>
          </div>
          <form className="prejoin__form" onSubmit={join}>
            <span className={`badge badge--${roomInfo.type}`}>
              <Icon name={isVideoRoom ? 'video' : 'headphones'} size={14} /> {isVideoRoom ? 'Video room' : 'Audio room'}
            </span>
            <h1>{roomInfo.name}</h1>
            <p className="muted">
              {roomInfo.participantCount === 0
                ? 'Nobody is here yet — be the first.'
                : `${roomInfo.participants.map((p) => p.name).join(', ')} ${roomInfo.participantCount === 1 ? 'is' : 'are'} here.`}
              {' '}({roomInfo.participantCount}/{roomInfo.maxParticipants})
            </p>
            <label className="field">
              <span>Your name</span>
              <input value={name} maxLength={30} onChange={(e) => setName(e.target.value)} placeholder="Display name" required />
            </label>
            {mediaError && <p className="warning">{mediaError}</p>}
            {call.error && <p className="error">{call.error}</p>}
            <button className="btn btn--primary btn--block" disabled={full || mediaLoading || !name.trim()}>
              {full ? 'Room is full' : 'Join now'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ---------- In call ----------
  if (call.status === 'error') {
    return (
      <div className="center-screen">
        <h2>Couldn’t join the call</h2>
        <p className="muted">{call.error}</p>
        <div className="row">
          <button className="btn btn--ghost" onClick={retry}>Try again</button>
          <Link className="btn btn--primary" to="/">Back to lobby</Link>
        </div>
      </div>
    );
  }

  const total = call.peers.length + 1;
  const cols = total <= 1 ? 1 : total <= 4 ? 2 : 3;
  const rows = Math.ceil(total / cols);

  return (
    <div className="call">
      <header className="call__head">
        <div>
          <h2>{roomInfo.name}</h2>
          <span className="muted">
            {call.status === 'joining' ? 'Joining…' : `${total}/${roomInfo.maxParticipants} in call`}
          </span>
        </div>
        <button className="btn btn--ghost btn--sm" onClick={copyLink}>
          <Icon name="link" size={16} /> {copied ? 'Copied!' : 'Copy invite link'}
        </button>
      </header>

      <main className="call__grid" style={{ '--cols': cols, '--rows': rows }}>
        {localTile}
        {call.peers.map((p) => (
          <ParticipantTile
            key={p.id}
            name={p.name ?? 'Guest'}
            stream={p.stream}
            audioOn={p.audio}
            videoOn={p.video}
            screen={p.screen}
            connectionState={p.connectionState ?? 'new'}
          />
        ))}
      </main>

      <footer className="call__controls">
        {micButton}
        {camButton}
        {isVideoRoom && canShareScreen && (
          <button className={`ctrl ${screenTrack ? 'ctrl--active' : ''}`} disabled={!hasCam}
            onClick={toggleScreenShare} title={screenTrack ? 'Stop sharing' : 'Share screen'}>
            <Icon name="screen" />
          </button>
        )}
        <button className="ctrl ctrl--leave" onClick={() => navigate('/')} title="Leave call">
          <Icon name="phoneOff" />
        </button>
      </footer>
    </div>
  );
}
