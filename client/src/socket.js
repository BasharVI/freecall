import { io } from 'socket.io-client';
import { SERVER_URL } from './api.js';

let socket = null;

// One shared Socket.IO connection for the lobby and the call.
export function getSocket() {
  if (!socket) socket = io(SERVER_URL || undefined, { transports: ['websocket'] });
  return socket;
}
