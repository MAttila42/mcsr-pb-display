if (typeof browser === 'undefined') {
  // @ts-expect-error build time
  globalThis.browser = chrome
}

const CHAT_LINE = 'div.chat-line__message-container'
const BADGES = 'span.chat-line__message--badges'

const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    const nodes = (mutation.target as HTMLElement).querySelectorAll(CHAT_LINE)
    nodes.forEach((node) => {
      modifyNode(node as HTMLElement)
    })
  })
})
observer.observe(document.body, { childList: true, subtree: true })
document.querySelectorAll(CHAT_LINE).forEach((elem) => {
  modifyNode(elem as HTMLElement)
})

window.onload = async () => {
  const authToken = document.cookie.split('; ').find(row => row.startsWith('auth-token='))?.split('=')[1]
  await browser.storage.local.set({ authToken })
}

function modifyNode(node: HTMLElement) {
  // const elements = node.querySelectorAll('span.chat-author__display-name')
  // elements.forEach((elem) => {
  //   if (!elem.classList.contains('name'))
  //     elem.classList.add('name')
  // })
  const badgesNode = node.querySelectorAll(BADGES)[0]
  const pbBadge = document.createElement('span')
  pbBadge.textContent = 'PB'
  pbBadge.className = 'pb-badge'
  const pbBadgeExists = node.querySelector('.pb-badge')
  if (!pbBadgeExists)
    badgesNode.appendChild(pbBadge)
}
