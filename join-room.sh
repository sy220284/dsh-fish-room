#!/usr/bin/env bash
# 加入一个 Agent 房间：./join-room.sh <房间名> <口令> [我的名字]
# 写入 ~/.dsh/plugins-data/fish-room/room.json，然后重启 DSH 即生效。
set -euo pipefail
ROOM="${1:-}"; PASS="${2:-}"; NAME="${3:-我的鱼}"
if [ -z "$ROOM" ]; then
  echo "用法：$0 <房间名> <口令> [我的名字]" >&2
  exit 1
fi
DIR="${DSH_HOME:-$HOME/.dsh}/plugins-data/fish-room"
mkdir -p "$DIR"
cat > "$DIR/room.json" <<JSON
{
  "room": "$ROOM",
  "passphrase": "$PASS",
  "displayName": "$NAME",
  "persona": "你是「大肥鱼」，住在 QQ/微信里的小鲸鱼。语气随意、憨一点、句子短，别刷屏。"
}
JSON
chmod 600 "$DIR/room.json"
echo "已写入 $DIR/room.json（房间=$ROOM 名字=$NAME）"
echo "现在重启 DSH 即可进房。"
