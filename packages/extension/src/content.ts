import { setCache } from './lib/stores/cache'
import { fetchBulkPbs, getPb } from './lib/utils'

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

void (async () => {
  const nodes = Array.from(document.querySelectorAll(CHAT_LINE)) as HTMLElement[]
  if (nodes.length === 0)
    return
  const names = new Set<string>()
  for (const node of nodes) {
    const nameEl = node.querySelector(NAME) as HTMLElement | null
    const tw = nameEl?.textContent?.trim()
    if (tw)
      names.add(tw.toLowerCase())
  }
  if (names.size > 0) {
    try {
      const map = await fetchBulkPbs(Array.from(names))
      for (const [tw, value] of Object.entries(map))
        setCache(`pb:${tw.toLowerCase()}`, value ?? undefined, PB_TTL)
    }
    catch (err) {
      console.error('[mcsr-pb-display] bulk fetch failed', err)
    }
  }
  nodes.forEach(processNode)
})()

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
