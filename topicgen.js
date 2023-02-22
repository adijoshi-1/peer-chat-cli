const b4a = require('b4a')
const crypto = require('hypercore-crypto')

console.log('Topic:', b4a.toString(crypto.randomBytes(32), 'hex'))
