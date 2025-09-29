import { mount } from 'svelte'
import Popup from './Popup.svelte'
import 'virtual:uno.css'

if (typeof browser === 'undefined') {
  // @ts-expect-error build time
  globalThis.browser = chrome
}

const popup = mount(Popup, {
  target: document.getElementById('popup')!,
})

export default popup
