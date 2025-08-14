 
PX4 MAVLink Viewer (React + Python WS Bridge)


### What this project does
Receives MAVLink packets from PX4 / SITL over UDP (e.g., 14550).
- Decodes packets using pymavlink and broadcasts them as JSON over WebSocket.
- A React app connects to the WebSocket and updates in real time:
	- list of messages (button per message) showing MessageName (ID), Freq.
	- details table with Name / Value / Type for the selected message.


### Architecture & Data Flow

```
PX4 (UDP/MAVLink: 14550 or custom)
        │
        ▼
Python bridge (server/mav_ws_bridge.py)
  - pymavlink decodes MAVLink
  - websockets serves JSON at ws://localhost:8765
        │
        ▼
React app (web/src/App.jsx)
  - WebSocket client
  - message buttons   
  - 3-column details (Name / Value / Type)
  - Live refresh on every packet
```


### Directory layout

```
px4-mavlink-viewer/
├─ server/
│  ├─ requirements.txt
│  └─ mav_ws_bridge.py         # UDP → WebSocket bridge (pymavlink + websockets)
└─ web/
   ├─ package.json
   ├─ .env                     # VITE_WS_URL=ws://localhost:8765
   ├─ index.html
   ├─ vite.config.js
   ├─ postcss.config.js
   ├─ tailwind.config.js
   └─ src/
      ├─ main.jsx              # React entry point (mounts <App />)
      ├─ App.jsx               # UI (Connect button + list + 3-column details)
      └─ index.css
```


### Requirements

```
Python 3.10+ 
(Ubuntu: install python3-venv, e.g. sudo apt install python3.10-venv)
Node.js 18+ / npm
PX4 SITL or any MAVLink source
```



### Startup order 

1) Start PX4 Example (pick any model):
	$ make px4_sitl gz_x500

2) Start the Python bridge

```
cd server
python3 -m venv .venv
source .venv/bin/activate # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
python mav_ws_bridge.py --udp udpin:0.0.0.0:14550 --ws 8765 --dialect common

(To coexist with QGC, you can use a different UDP port (e.g., 14551) so you don’t collide with QGC on 14550)
```

3) Start the React app

```
cd ../web
npm i
npm run dev
# open http://localhost:5173
```


