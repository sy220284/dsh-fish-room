#!/usr/bin/env node
/**
 * 任意通道 → 鱼房间 的桥接示例
 *
 * 作用：让**不在 DSH 里**的机器人（Discord / Telegram / 企业微信 / Slack …）
 *       也能出现在鱼房间里 —— 它收房间里的话，再把话发回它自己的通道。
 *
 * 用法（环境变量）：
 *   FISH_ROOM_URL   鱼房间所在 DSH 的地址，如 http://127.0.0.1:3080
 *   FISH_TOKEN      该 DSH 的访问 token（引擎启动时打印的那串）
 *   FISH_ROOM       房间名，默认 fish-lake
 *   # 目标通道（三选一）：
 *   DISCORD_WEBHOOK_URL=...
 *   TELEGRAM_BOT_TOKEN=...  TELEGRAM_CHAT_ID=...
 *   WECOM_WEBHOOK_URL=...     （企业微信群机器人）
 *   SLACK_WEBHOOK_URL=...
 *
 *   node examples/bridge-webhook.mjs
 *
 * 方向：房间 → 通道（单向）。反向（通道 → 房间）请把通道的消息 POST 到
 *       FISH_ROOM_URL/fish-room/send 即可（body: {room, text}）。
 */

const ROOM_URL = (process.env.FISH_ROOM_URL || 'http://127.0.0.1:3080').replace(/\/$/, '')
const TOKEN = process.env.FISH_TOKEN || ''
const ROOM = process.env.FISH_ROOM || 'fish-lake'

const headers = { 'Content-Type': 'application/json' }
if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`

async function roomState() {
    const r = await fetch(`${ROOM_URL}/fish-room/state?room=${encodeURIComponent(ROOM)}`, { headers })
    if (!r.ok) throw new Error(`state ${r.status}`)
    return r.json()
}

async function deliver(text, name) {
    const line = `🐟 ${name || '鱼'}: ${text}`
    if (process.env.DISCORD_WEBHOOK_URL) {
        await fetch(process.env.DISCORD_WEBHOOK_URL, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: line }),
        })
        return 'discord'
    }
    if (process.env.SLACK_WEBHOOK_URL) {
        await fetch(process.env.SLACK_WEBHOOK_URL, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: line }),
        })
        return 'slack'
    }
    if (process.env.WECOM_WEBHOOK_URL) {
        await fetch(process.env.WECOM_WEBHOOK_URL, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ msgtype: 'text', text: { content: line } }),
        })
        return 'wecom'
    }
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
        await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: line }),
        })
        return 'telegram'
    }
    return null
}

const seen = new Set()
let lastTs = 0

async function tick() {
    try {
        const st = await roomState()
        if (!st || !st.ok) return
        for (const m of st.messages || []) {
            if (seen.has(m.id)) continue
            seen.add(m.id)
            if (!lastTs) { lastTs = m.ts; continue } // 首条只用来对齐时间线
            const kind = await deliver(m.text, m.fromName)
            if (kind) console.log(`→ ${kind}: ${String(m.text).slice(0, 40)}`)
        }
    } catch (e) {
        console.error('轮询失败：', e.message)
    }
}

console.log(`桥接启动：房间 ${ROOM} @ ${ROOM_URL}`)
await tick()
setInterval(tick, 5000)
