import { formatTime, getPb } from './pb'

if (typeof browser === 'undefined') {
  // @ts-expect-error build time
  globalThis.browser = chrome
}

const CHAT_LINE = 'div.chat-line__message-container'
const BADGES = 'span.chat-line__message--badges'
const BADGES_CLASS = 'chat-line__message--badges'
const NAME = 'span.chat-author__display-name'
const HANDLED_ATTR = 'data-pb-handled'

function getCookieValue(name: string) {
  const prefix = `${name}=`
  const raw = document.cookie
    .split('; ')
    .find(row => row.startsWith(prefix))
  if (!raw)
    return undefined
  return decodeURIComponent(raw.slice(prefix.length))
}

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

window.onload = async () => {
  const authToken = getCookieValue('auth-token')
  const login = getCookieValue('login')

  const toSet: Record<string, string> = {}
  const toRemove: string[] = []

  if (authToken)
    toSet.authToken = authToken
  else
    toRemove.push('authToken')

  if (login)
    toSet.login = login
  else
    toRemove.push('login')

  if (Object.keys(toSet).length > 0)
    await browser.storage.local.set(toSet)
  if (toRemove.length > 0)
    await browser.storage.local.remove(toRemove)
}

async function modifyNode(node: HTMLElement) {
  const nameEl = node.querySelector(NAME) as HTMLElement | null
  if (!nameEl)
    return

  const tw = nameEl.textContent?.trim()
  if (!tw)
    return

  const pb = await getPb(tw)
  if (!pb)
    return

  let badgesNode = node.querySelector(BADGES) as HTMLElement | null
  if (!badgesNode) {
    badgesNode = document.createElement('span')
    badgesNode.classList.add(BADGES_CLASS)

    const badgeContainer = nameEl.parentElement ?? node
    badgeContainer.insertBefore(badgesNode, nameEl)
  }
  if (!node.querySelector('.pb-badge')) {
    const pbBadge = document.createElement('span')
    pbBadge.textContent = formatTime(pb)
    pbBadge.className = 'pb-badge'
    badgesNode.appendChild(pbBadge)
  }
}
