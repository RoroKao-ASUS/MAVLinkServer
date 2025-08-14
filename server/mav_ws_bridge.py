# // =========================
# // File: mav_ws_bridge.py
# // Python 3.9+
# // deps: pip install pymavlink websockets
# // Usage example:
# //   python mav_ws_bridge.py --udp 127.0.0.1:14550 --ws 8765 --dialect common
# // This script receives MAVLink over UDP (from PX4/QGC port 14550),
# // decodes with pymavlink, and broadcasts JSON to all WS clients.
# ---------------------------------------------------------------
# -*- coding: utf-8 -*-
import asyncio, json, argparse, sys
import websockets
from pymavlink import mavutil

CLIENTS = set()

# 將不可序列化型別轉成可被 JSON 接受的型別
def json_safe(o):
    # bytes / bytearray → 十六進位字串（或你也可以改成 list(o)）
    if isinstance(o, (bytes, bytearray)):
        return o.hex()
    # set/tuple → list
    if isinstance(o, (set, tuple)):
        return list(o)
    # numpy 類型 → tolist()
    if hasattr(o, "tolist"):
        try:
            return o.tolist()
        except Exception:
            pass
    # 其他奇怪型別 → 盡量轉成 str
    try:
        return float(o)  # 部分 decimal/自定義數字型別
    except Exception:
        return str(o)

async def ws_handler(websocket):
    CLIENTS.add(websocket)
    try:
        await websocket.wait_closed()
    finally:
        CLIENTS.discard(websocket)

async def mav_reader(udp_endpoint: str, dialect: str):
    master = mavutil.mavlink_connection(udp_endpoint, dialect=dialect, autoreconnect=True)
    try:
        master.wait_heartbeat(timeout=5)
    except Exception:
        pass

    while True:
        msg = master.recv_match(blocking=False)
        if msg is None:
            await asyncio.sleep(0.001)
            continue

        try:
            m = msg.to_dict()
        except Exception:
            m = {f: getattr(msg, f) for f in msg.get_fieldnames()}

        payload = {
            "msgid": msg.get_msgId(),
            "name": msg.get_type(),
            "time_us": getattr(msg, "time_usec", None) or getattr(msg, "time_boot_ms", None),
            "fields": m,
            "types": {f: type(getattr(msg, f)).__name__ for f in msg.get_fieldnames()},
        }

        if CLIENTS:
            dead = []
            # 這裡改成 default=json_safe，就不會再試圖把 bytearray 轉 float
            data = json.dumps(payload, default=json_safe, ensure_ascii=False)
            for ws in list(CLIENTS):
                try:
                    await ws.send(data)
                except Exception:
                    dead.append(ws)
            for ws in dead:
                CLIENTS.discard(ws)

async def main():
    p = argparse.ArgumentParser()
    p.add_argument('--udp', default='udp:127.0.0.1:14550')
    p.add_argument('--ws', type=int, default=8765)
    p.add_argument('--dialect', default='common')
    args = p.parse_args()

    ws_server = websockets.serve(ws_handler, '0.0.0.0', args.ws, ping_interval=20, ping_timeout=20)
    await ws_server
    await mav_reader(args.udp, args.dialect)

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        sys.exit(0)
