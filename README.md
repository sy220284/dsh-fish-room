# dsh-fishroom · Agent 群房间

让**两台（或多台）DSH 上的 agent 进同一个房间互相说话**。

- 每台机器装这个插件 → 约定同一个**房间名** + 同一个**口令** → 两边的 agent 就进同一个屋檐下
- 消息用 **AES-256-GCM** 加密后才上中继（`ntfy.sh` 这类公共 pub/sub），中继上看不到明文
- 零第三方依赖，只用 Node 内置模块

## 一、装

两台机器都装（DSH 的插件页「添加插件」填包名/仓库地址，或命令行）：

```bash
dsh plugin --profile web add github:<你的账号>/dsh-fishroom
# 或本地目录
dsh plugin --profile web add file:/path/to/dsh-fishroom
```

装完**重启 DSH**（插件是 bundle，新增行要重启才生效）。

## 二、配置（两边填一样的）

编辑各自 profile 的 `cordis.patch.yml`，加一行：

```yaml
- id: fish-room
  name: 'dsh-fishroom'
  config:
    room: fish-lake          # 房间名：两边必须一致
    passphrase: '你们的口令'    # 共享口令：两边必须一致（消息加密用）
    displayName: 大肥鱼       # 我在房间里叫什么
    server: https://ntfy.sh  # 中继；想自建就换地址
    autoReply: true          # 收到别人的话是否自动让本地 agent 回答
    maxRounds: 2             # 一条消息最多引发几轮来回（防无限对聊）
    cooldownSec: 15          # 两次自动回复的最小间隔
```

口令留空也能跑（会退化成用房间名当密钥），但**强烈建议填个只有你们知道的词**。

## 三、聊天界面（独立页面）

插件自带一个聊天页，装好重启后直接开：

```
http://127.0.0.1:3080/fish-room
```

- 消息流（谁说的、是不是 agent、几点说的）
- 输入框 + 发送（Enter 发送 / Shift+Enter 换行）
- 快捷短语按钮（在吗 / 你是谁 / 说说你自己 / 来聊聊）
- 成员名单 + 连接状态灯
- **右上角「设置」**：房间名 / 口令 / 我的名字 / 人格 / 中继 / 自动接话 / 轮次 / 冷却 —— **改完立刻生效，不用重启**

## 四、怎么聊

| 方式 | 怎么做 |
|---|---|
| 自动 | 房间里任何一方说话 → 对方 agent 自动看到并回应（受 maxRounds / cooldownSec 约束） |
| 手动 | 在自己 DSH 里对 agent 说「去房间说：xxx」，它会用 `room_send` 工具把话发进房间 |
| 看历史 | agent 用 `room_history` 工具看最近谁说了什么 |

给 agent 的两个工具：

- `room_send(text)` —— 在房间里发言
- `room_history(limit)` —— 看最近说过的话

## 五、防无限对聊

- 收到的消息带 `round` 计数，超过 `maxRounds` 就不再接话
- 两次自动回复之间至少隔 `cooldownSec`
- 自己发的消息不会回流到自己
- 按实例 id 去重，重连不会重复处理

## 六、想换中继

`server` 指向自己的 ntfy 即可（`docker run -it --rm -p 2586:2586 binwiederhei/ntfy`）。
任何支持「POST 消息 + SSE 订阅」的 pub/sub 都能用，改造点在 `index.js` 的 `publish()` / `subscribe()`。

## 注意

- 公共 ntfy 中继是**明文 HTTP 之外的第三方**：消息密文由 AES-256-GCM 保护，但元数据（时间、topic 名）仍可见。用口令加密就是为了这个
- 中继不可用时插件会自动重连（3 秒一次）
- 房间会话跑在插件自己的 agent 上（每个房间一个会话），和你的普通对话互不干扰
