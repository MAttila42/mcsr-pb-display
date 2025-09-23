import { getCache, setCache } from './lib/stores/cache'

if (typeof browser === 'undefined') {
  // @ts-expect-error build time
  globalThis.browser = chrome
}

const CHAT_LINE = 'div.chat-line__message-container'
const BADGES = 'span.chat-line__message--badges'
const NAME = 'span.chat-author__display-name'
const HANDLED_ATTR = 'data-pb-handled'

const PB_TTL = 15 * 60 * 1000

function processNode(node: Element) {
  if (!(node instanceof HTMLElement))
    return
  if (node.hasAttribute(HANDLED_ATTR))
    return
  node.setAttribute(HANDLED_ATTR, '')

  modifyNode(node).catch((err) => {
    console.error('[mcsr-pb-display] modifyNode failed', err)
    node.removeAttribute(HANDLED_ATTR)
  })
}

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    mutation.addedNodes.forEach((added) => {
      if (added instanceof HTMLElement) {
        if (added.matches?.(CHAT_LINE))
          processNode(added)
        added.querySelectorAll?.(CHAT_LINE).forEach(processNode)
      }
    })
    ;(mutation.target as HTMLElement)
      .querySelectorAll?.(CHAT_LINE)
      .forEach(processNode)
  }
})
observer.observe(document.body, { childList: true, subtree: true })

document.querySelectorAll(CHAT_LINE).forEach(processNode)

window.onload = async () => {
  const authToken = document.cookie.split('; ').find(row => row.startsWith('auth-token='))?.split('=')[1]
  await browser.storage.local.set({ authToken })
}

async function modifyNode(node: HTMLElement) {
  const nameEl = node.querySelector(NAME) as HTMLElement | null
  const tw = nameEl?.textContent?.trim()
  if (!tw)
    return

  const pb = await getPb(tw)
  if (!pb)
    return

  const date = new Date(pb)
  const hours = date.getUTCHours()
  const minutes = date.getUTCMinutes().toString().padStart(2, '0')
  const seconds = date.getUTCSeconds().toString().padStart(2, '0')
  const formatted = hours > 0 ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`

  const badgesNode = node.querySelector(BADGES)
  if (!badgesNode)
    return
  if (!node.querySelector('.pb-badge')) {
    const pbBadge = document.createElement('span')
    pbBadge.textContent = formatted
    pbBadge.className = 'pb-badge'
    badgesNode.appendChild(pbBadge)
  }
}

async function getPb(tw: string): Promise<number | undefined> {
  const key = `pb:${tw}`
  const cached = getCache<number | undefined>(key)

  if (cached && !cached.stale)
    return cached.value

  if (cached && cached.stale) {
    ;(async () => {
      const fresh = await fetchPb(tw)
      setCache(key, fresh, PB_TTL)
    })()
    return cached.value
  }

  const fresh = await fetchPb(tw)
  setCache(key, fresh, PB_TTL)
  return fresh
}

async function fetchPb(tw: string): Promise<number | undefined> {
  const url = `http://localhost:3000/user/${encodeURIComponent(tw)}/pb`
  const res = await fetch(url)
  if (!res.ok) {
    if (res.status === 404)
      return undefined
    throw new Error('Failed to fetch PB')
  }
  const text = await res.text()
  const value = Number(text)
  return Number.isFinite(value) ? value : undefined
}
