/* eslint-disable no-undef */
require('dotenv').config()

const Hyperswarm = require('hyperswarm')
const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const b4a = require('b4a')
const goodbye = require('graceful-goodbye')
const { v4 } = require('uuid')

const swarm = new Hyperswarm()
const store = new Corestore('storage')
const drive = new Hyperdrive(store)

goodbye(() => {
  swarm.destroy()
  store.close()
  drive.close()
})

const conns = []
swarm.on('connection', async (conn) => {
  const data = []
  for await (const entry of drive.entries()) {
    data.push(JSON.parse((await drive.get(entry.key)).toString()))
  }
  conn.write(JSON.stringify(data))
  conns.push(conn)
  conn.once('close', () => conns.splice(conns.indexOf(conn), 1))
  conn.on('data', async (data) => {
    try {
      data = b4a.toString(data, 'utf-8')
      data = JSON.parse(data)
      if (Array.isArray(data)) {
        console.log('Syncing Messages')
        for (const index of data) {
          await drive.put(`Message${index.id}`, JSON.stringify(index))
        }
        console.log('Messages synced')
      } else {
        console.log(`${data.publicKey}: ${data.message}`)
        await drive.put(`Message${data.id}`, JSON.stringify(data))
      }
    } catch (err) {
      console.log(err)
    }
  })
})

const topic = b4a.from(process.env.TOPIC, 'hex')

drive.ready().then(async () => {
  const discovery = swarm.join(topic)
  discovery.flushed().then(() => {
    console.log('Swarm and drive ready')

    process.stdin.on('data', async (data) => {
      const keyPair = swarm.keyPair
      const publicKey = b4a.toString(keyPair.publicKey, 'hex')
      data = b4a.toString(data, 'utf-8')
      data = {
        id: v4(),
        message: data,
        publicKey,
      }
      data = JSON.stringify(data)
      await drive.put(`Message${data.id}`, data)
      for (const conn of conns) {
        conn.write(data)
      }
    })
  })

  const data = []
  for await (const entry of drive.entries()) {
    data.push(JSON.parse((await drive.get(entry.key)).toString()))
  }
  console.log(data)
})
