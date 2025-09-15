const SELECTOR = 'div.chat-line__message-container'

const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    const nodes = (mutation.target as HTMLElement).querySelectorAll(SELECTOR)
    nodes.forEach((node) => {
      modifyNode(node as HTMLElement)
    })
  })
})
observer.observe(document.body, { childList: true, subtree: true })
document.querySelectorAll(SELECTOR).forEach((elem) => {
  modifyNode(elem as HTMLElement)
})

function modifyNode(node: HTMLElement) {
  // const elements = node.querySelectorAll('span.chat-author__display-name')
  // elements.forEach((elem) => {
  //   if (!elem.classList.contains('name'))
  //     elem.classList.add('name')
  // })
  const badgesNode = node.querySelectorAll('span.chat-line__message--badges')[0]
  const pbBadge = document.createElement('span')
  pbBadge.textContent = 'PB'
  pbBadge.className = 'pb-badge'
  const pbBadgeExists = node.querySelector('.pb-badge')
  if (!pbBadgeExists)
    badgesNode.appendChild(pbBadge)
}
