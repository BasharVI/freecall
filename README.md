# FreeCall

Room-based video & audio calling built on the MERN stack (MongoDB, Express, React, Node) with **WebRTC**.

- Browse rooms in a live-updating lobby (participant counts and avatars update in real time)
- Create rooms: name, **video** or **audio-only**, and a participant limit (2–8)
- Pre-join screen with camera preview and mic/camera toggles
- In-call: mute, camera on/off, screen sharing, speaking indicator, invite link
- Empty user-created rooms are cleaned up automatically (featured rooms are permanent)

## How calling works

| Concern | Protocol |
| --- | --- |
| Audio/video media | **WebRTC** (SRTP over UDP, peer-to-peer, encrypted end-to-end between browsers) |
| Signaling (offer/answer/ICE) and room presence | **Socket.IO** (WebSocket) |
| NAT traversal | **STUN** (Google public servers), optional **TURN** via env vars |
| Room CRUD | REST (`/api/rooms`) backed by MongoDB |

Rooms use a **mesh** topology: each participant opens one `RTCPeerConnection` to every other participant.
The newcomer always sends the offers and existing members only answer, which avoids offer collisions.
Mesh needs no media server and adds no latency. Each person uploads one stream per peer, though,
so rooms are capped at 8. Larger rooms would need an SFU such as mediasoup or LiveKit.

## Getting started

Requirements: Node 18+ and MongoDB (optional, see below).

```bash
npm run install:all     # installs root, server and client deps
cp server/.env.example server/.env   # already done once; edit if needed
npm run dev             # server on :5000, client on http://localhost:5173
```

Open http://localhost:5173 in two browser windows (or two devices) and join the same room.

### Production

```bash
npm run build   # builds the React app into client/dist
npm start       # Express serves the API, Socket.IO and the built app on :5000
```

### Share it with other devices (ngrok)

ngrok gives your local server a public HTTPS URL. Browsers need HTTPS before they allow camera and mic access.

```bash
ngrok config add-authtoken <YOUR_TOKEN>   # one time, token from https://dashboard.ngrok.com/get-started/your-authtoken
npm run serve      # terminal 1: build + serve everything on :5000
npm run tunnel     # terminal 2: prints https://<something>.ngrok-free.app
```

Open the `https://….ngrok-free.app` link on any device. The free plan shows a one-time "Visit Site" warning page first.
For callers on different networks, add a TURN server (see below) so calls connect reliably.

### Free hosting

Vercel and Netlify only host static sites and short-lived serverless functions. They can't keep the
Socket.IO WebSocket server running, so the backend goes on **Render** (free web service) and the database on
**MongoDB Atlas** (free M0 cluster).

- **Simplest:** deploy the whole app to Render as one service. Build command `npm run install:all && npm run build`,
  start command `npm start`.
- **Frontend on Vercel/Netlify:** set the root directory to `client`, the build command to `npm run build`, the output to `dist`, and
  `VITE_SERVER_URL=https://<your-render-app>.onrender.com`. On Render, set `CLIENT_ORIGIN` to the Vercel/Netlify URL.
  SPA routing is already configured (`client/vercel.json`, `client/public/_redirects`).

### Without MongoDB

If MongoDB can't be reached, the server logs a warning and keeps rooms in memory. Everything still works,
but rooms you create are lost on restart.

## Important deployment notes

- **HTTPS is required** for camera/microphone access anywhere except `localhost`. Testing from a phone
  on your LAN needs HTTPS too, for example through a tunnel like `ngrok`/`cloudflared` or a reverse proxy.
- **TURN server:** STUN alone fails for roughly 10–20% of users behind strict NATs or firewalls. For reliable calls
  across networks, run [coturn](https://github.com/coturn/coturn) or use a hosted TURN service and set
  `TURN_URL`, `TURN_USERNAME` and `TURN_CREDENTIAL` in `server/.env`.

## Project structure

```
server/src
  index.js          Express app, Socket.IO, ICE config endpoint, static hosting
  socket.js         Signaling relay + join/leave/capacity enforcement
  presence.js       Who is in which room (in memory)
  lobby.js          Live room-list broadcasts + empty-room cleanup
  roomStore.js      Room persistence (MongoDB or in-memory fallback)
  routes/rooms.js   REST: list / get / create rooms
client/src
  pages/Lobby.jsx       Room list, filters, create-room modal
  pages/Room.jsx        Pre-join screen + call UI and controls
  hooks/useRoomCall.js  WebRTC mesh: peer connections, offers/answers, ICE, screen-share track swap
  hooks/useLocalMedia.js  getUserMedia with audio-only / listen-only fallbacks
  hooks/useSpeaking.js  Web Audio level meter for the speaking indicator
```
