import { mount } from 'svelte'
import Popup from './Popup.svelte'
import 'virtual:uno.css'

const popup = mount(Popup, {
  target: document.getElementById('popup')!,
})

export default popup
