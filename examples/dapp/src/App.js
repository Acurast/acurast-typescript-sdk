import { AcurastClient } from '@acurast/dapp'

import './App.css'
import { useEffect, useMemo, useState } from 'react'

const DEV_WSS = 'wss://ws-1.ws-server-2.acurast.com/'
const LOCAL_WSS = 'ws://localhost:9001/'

function App() {
  const acurastClient = useMemo(
    () => new AcurastClient([LOCAL_WSS, DEV_WSS, 'wss://websocket-proxy.dev.gke.papers.tech/']),
    []
  )

  const [id, setId] = useState()
  const [keyPair, setKeyPair] = useState()
  const [message, setMessage] = useState()
  const [recipient, setRecipient] = useState()
  const [payload, setPayload] = useState()

  useEffect(() => {
    const init = async () => {
      const keyPair = await crypto.subtle.generateKey(
        {
          name: 'ECDSA',
          namedCurve: 'P-256'
        },
        true,
        ['sign']
      )

      const [privateKeyRaw, publicKeyRaw] = await Promise.all([
        crypto.subtle
          .exportKey('jwk', keyPair.privateKey)
          .then((jwk) => Buffer.from(jwk.d, 'base64')),
        crypto.subtle
          .exportKey('raw', keyPair.publicKey)
          .then((arrayBuffer) => Buffer.from(arrayBuffer))
      ])

      const publicKeyCompressedSize = (publicKeyRaw.length - 1) / 2
      const publicKeyCompressed = Buffer.concat([
        new Uint8Array([publicKeyRaw[2 * publicKeyCompressedSize] % 2 ? 3 : 2]),
        publicKeyRaw.subarray(1, publicKeyCompressedSize + 1)
      ])
      const publicKeyHash = await crypto.subtle.digest('SHA-256', publicKeyCompressed)
      setId(Buffer.from(publicKeyHash.slice(0, 16)).toString('hex'))
      setKeyPair({
        privateKey: privateKeyRaw.toString('hex'),
        publicKey: publicKeyRaw.toString('hex')
      })
    }

    init()
  }, [acurastClient])

  const onRecipientInput = (event) => {
    setRecipient(event.target.value)
  }

  const onPayloadInput = (event) => {
    setPayload(event.target.value)
  }

  const open = async () => {
    await acurastClient.start({
      secretKey: keyPair.privateKey,
      publicKey: keyPair.publicKey
    })

    acurastClient.onMessage((message) => {
      setMessage({
        sender: Buffer.from(message.sender).toString('hex'),
        recipient: Buffer.from(message.recipient).toString('hex'),
        payload: Buffer.from(message.payload).toString('hex')
      })
    })
  }

  const close = () => {
    acurastClient.close()
  }

  const send = () => {
    acurastClient.send(recipient, payload)
  }

  const clear = () => {
    setMessage(undefined)
  }

  return (
    <div className="App">
      <div>
        <span>ID: </span>
        <span>{id}</span>
      </div>
      <br />
      <br />
      <button onClick={open}>Open Connection</button>
      <br />
      <br />
      <button onClick={close}>Close Connection</button>
      <br />
      <br />
      ---
      <br />
      <br />
      <div>
        <span>Recipient</span>
        <input type="text" onChange={onRecipientInput}></input>
      </div>
      <div>
        <span>Payload</span>
        <input type="text" onChange={onPayloadInput}></input>
      </div>
      <button onClick={send}>Send</button>
      <br />
      <br />
      ---
      <br />
      <br />
      <button onClick={clear}>Clear</button>
      <div>Message:</div>
      <div className="multiline">{message ? JSON.stringify(message, null, 2) : '<empty>'}</div>
    </div>
  )
}

export default App
