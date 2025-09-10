import { mount } from 'svelte'
import Settings from './Settings.svelte'
import 'virtual:uno.css'

const settings = mount(Settings, {
  target: document.getElementById('settings')!,
})

export default settings
