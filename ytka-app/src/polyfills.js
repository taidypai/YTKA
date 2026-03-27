import { Buffer } from 'buffer'
import { EventEmitter } from 'events'

window.Buffer = Buffer
globalThis.Buffer = Buffer
window.global = window
window.process = window.process || { env: {}, version: 'v18.0.0' }
globalThis.EventEmitter = EventEmitter

// Fix for gramjs Buffer compatibility
const _Buffer = Buffer
_Buffer.from = Buffer.from.bind(Buffer)
_Buffer.alloc = Buffer.alloc.bind(Buffer)
_Buffer.allocUnsafe = Buffer.allocUnsafe.bind(Buffer)
_Buffer.isBuffer = Buffer.isBuffer.bind(Buffer)
globalThis.Buffer = _Buffer
window.Buffer = _Buffer