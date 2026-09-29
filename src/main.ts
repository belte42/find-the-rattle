import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
// Catch the browser's one-off install prompt before Settings is ever opened
import './lib/install.svelte'

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
