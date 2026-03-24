import { Buffer } from 'buffer'
import { EventEmitter } from 'events'

window.Buffer = Buffer
globalThis.Buffer = Buffer
window.global = window
window.process = window.process || { env: {}, version: 'v18.0.0' }
globalThis.EventEmitter = EventEmitter