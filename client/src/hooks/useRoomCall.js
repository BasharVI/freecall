import { useCallback, useEffect, useRef, useState } from 'react';
import { getSocket } from '../socket.js';

/*
 * WebRTC mesh call over Socket.IO signaling.
 *
 * Every participant holds one RTCPeerConnection per other participant. When someone joins,
 * *they* send an offer to each existing peer (existing peers only ever answer), which avoids
 * offer collisions ("glare"). ICE candidates are trickled and queued until the remote
 * description is set.
 */
const toJSON = (desc) => ({ type: desc.type, sdp: desc.sdp });

export function useRoomCall({ roomId, name, localStream, iceServers, mediaState, enabled }) {
  const [status, setStatus] = useState('idle'); // idle | joining | joined | error
  const [error, setError] = useState('');
  const [room, setRoom] = useState(null);
  const [peers, setPeers] = useState({});

  const connections = useRef(new Map()); // peerId -> { pc, pending, fallbackStream }
  const screenTrack = useRef(null);
  const localStreamRef = useRef(localStream);
  const mediaStateRef = useRef(mediaState);
  localStreamRef.current = localStream;
  mediaStateRef.current = mediaState;

  useEffect(() => {
    if (!enabled) return;
    const socket = getSocket();
    let active = true;
    let joined = false;
    let roomType = 'video';
    setStatus('joining');
    setError('');

    const upsertPeer = (id, patch) => setPeers((prev) => ({ ...prev, [id]: { ...prev[id], id, ...patch } }));
    const dropPeer = (id) => {
      connections.current.get(id)?.pc.close();
      connections.current.delete(id);
      setPeers((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    };
    const send = (to, data) => socket.emit('signal', { to, data });

    // Initiator: add every local track, or a receive-only transceiver for missing kinds so we
    // still get the other side's media. Answerer: called after setRemoteDescription so tracks
    // reuse the transceivers created from the offer.
    const attachLocalMedia = (pc, isInitiator) => {
      const stream = localStreamRef.current ?? new MediaStream();
      const kinds = roomType === 'video' ? ['audio', 'video'] : ['audio'];
      for (const kind of kinds) {
        let track = stream.getTracks().find((t) => t.kind === kind);
        if (kind === 'video' && track && screenTrack.current) track = screenTrack.current;
        if (track) pc.addTrack(track, stream);
        else if (isInitiator) pc.addTransceiver(kind, { direction: 'recvonly' });
      }
    };

    const sendOffer = async (id, options) => {
      const conn = connections.current.get(id);
      if (!conn) return;
      await conn.pc.setLocalDescription(await conn.pc.createOffer(options));
      send(id, { type: 'offer', sdp: toJSON(conn.pc.localDescription) });
    };

    const createConnection = (id, isInitiator) => {
      const pc = new RTCPeerConnection({ iceServers });
      const conn = { pc, pending: [], fallbackStream: null };
      connections.current.set(id, conn);

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) send(id, { type: 'candidate', candidate: candidate.toJSON() });
      };
      pc.ontrack = ({ streams, track }) => {
        let stream = streams[0];
        if (!stream) {
          conn.fallbackStream ??= new MediaStream();
          conn.fallbackStream.addTrack(track);
          stream = conn.fallbackStream;
        }
        upsertPeer(id, { stream, trackCount: stream.getTracks().length });
      };
      pc.onconnectionstatechange = () => {
        upsertPeer(id, { connectionState: pc.connectionState });
        if (pc.connectionState === 'failed' && isInitiator) {
          sendOffer(id, { iceRestart: true }).catch(console.error);
        }
      };
      return conn;
    };

    const flushCandidates = async (conn) => {
      for (const candidate of conn.pending.splice(0)) {
        await conn.pc.addIceCandidate(candidate).catch((err) => console.warn('ICE candidate rejected', err));
      }
    };

    const onSignal = async ({ from, data }) => {
      try {
        let conn = connections.current.get(from);
        if (data.type === 'offer') {
          const isNew = !conn;
          if (isNew) conn = createConnection(from, false);
          await conn.pc.setRemoteDescription(data.sdp);
          if (isNew) attachLocalMedia(conn.pc, false);
          await flushCandidates(conn);
          await conn.pc.setLocalDescription(await conn.pc.createAnswer());
          send(from, { type: 'answer', sdp: toJSON(conn.pc.localDescription) });
        } else if (data.type === 'answer' && conn) {
          await conn.pc.setRemoteDescription(data.sdp);
          await flushCandidates(conn);
        } else if (data.type === 'candidate' && conn) {
          if (conn.pc.remoteDescription) await conn.pc.addIceCandidate(data.candidate);
          else conn.pending.push(data.candidate);
        }
      } catch (err) {
        console.error(`Signaling error with ${from}:`, err);
      }
    };

    const onPeerJoined = (p) => upsertPeer(p.id, p);
    const onPeerUpdated = (p) => upsertPeer(p.id, p);
    const onPeerLeft = ({ id }) => dropPeer(id);
    const onDisconnect = () => {
      joined = false;
      setStatus('error');
      setError('Lost connection to the server.');
    };

    socket.on('signal', onSignal);
    socket.on('peer-joined', onPeerJoined);
    socket.on('peer-updated', onPeerUpdated);
    socket.on('peer-left', onPeerLeft);
    socket.on('disconnect', onDisconnect);

    socket.emit('join-room', { roomId, name, ...mediaStateRef.current }, (res) => {
      if (!active) {
        if (!res.error) socket.emit('leave-room');
        return;
      }
      if (res.error) {
        setStatus('error');
        setError(res.error);
        return;
      }
      joined = true;
      roomType = res.room.type;
      setRoom(res.room);
      setStatus('joined');
      for (const peer of res.peers) {
        upsertPeer(peer.id, peer);
        createConnection(peer.id, true);
        attachLocalMedia(connections.current.get(peer.id).pc, true);
        sendOffer(peer.id).catch(console.error);
      }
    });

    return () => {
      active = false;
      socket.off('signal', onSignal);
      socket.off('peer-joined', onPeerJoined);
      socket.off('peer-updated', onPeerUpdated);
      socket.off('peer-left', onPeerLeft);
      socket.off('disconnect', onDisconnect);
      for (const { pc } of connections.current.values()) pc.close();
      connections.current.clear();
      setPeers({});
      if (joined) socket.emit('leave-room');
    };
  }, [enabled, roomId, name, iceServers]);

  // Tell other participants when our mic/camera/screen state changes.
  const { audio, video, screen } = mediaState;
  useEffect(() => {
    if (status === 'joined') getSocket().emit('media-state', { audio, video, screen });
  }, [status, audio, video, screen]);

  // Swap the outgoing video (camera <-> screen share) on every connection without renegotiating.
  const setScreenTrack = useCallback((track) => {
    screenTrack.current = track;
    const outgoing = track ?? localStreamRef.current?.getVideoTracks()[0] ?? null;
    for (const { pc } of connections.current.values()) {
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
      sender?.replaceTrack(outgoing).catch(console.error);
    }
  }, []);

  return { status, error, room, peers: Object.values(peers), setScreenTrack };
}
