import { AcurastClient } from '@acurast/dapp'
import { json } from '@codemirror/lang-json'
import { packData, unpackData } from '@taquito/michel-codec'
import { b58cencode } from '@taquito/utils'
import CodeMirror from '@uiw/react-codemirror'
import axios from 'axios'
import { Oval } from 'react-loader-spinner'

import './App.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const DEV_WSS = 'wss://websocket-proxy.dev.gke.papers.tech/'
const LOCAL_WSS = 'ws://localhost:9001/'

const TEZOS_NODE = 'https://tezos-ghostnet-node.prod.gke.papers.tech'
const CONTRACT = 'KT1Uv2DzUiDBNL4znvAVp8ozyHdynEeKV3rL'

const FAKE_SOURCE = 'tz1Mj7RzPmMAqDUNFBn5t5VbXmWW4cSUAdtT'
const FAKE_SIGNATURE = 'edsigtkpiSSschcaCt9pUVrpNPf7TTcgvgDEDD6NCEHMy8NNQJCGnMfLZzYoQj74yLjo9wx6MPVV29CvVzgi7qEcEUok3k7AuMg'

const DEFAULT_PAYLOAD = {
  prim: 'Pair',
  args: [
      { string: 'BTCUSDT' },
      { int: 1000 }
  ]
}

const MESSAGE_STATUS = {
  loading: 'loading',
  verified: 'verified',
  invalidSignature: 'invalid_signature',
  error: 'error'
}

function App() {
  const acurastClient = useMemo(() => new AcurastClient(DEV_WSS), [])

  const recipientInputRef = useRef()

  const [id, setId] = useState()
  const [keyPair, setKeyPair] = useState()

  const [payload, setPayload] = useState(JSON.stringify(DEFAULT_PAYLOAD))

  const [message, setMessage] = useState()
  const [payloadData, setPayloadData] = useState()
  const [signature, setSignature] = useState()
  const [publicKey, setPublicKey] = useState()
  const [messageStatus, setMessageStatus] = useState()

  useEffect(() => {
    const init = async () => {
      const keyPair = await crypto.subtle.generateKey({
        name: 'ECDSA',
        namedCurve: 'P-256'
      }, true, ['sign'])


      const [privateKeyRaw, publicKeyRaw] = await Promise.all([
        crypto.subtle.exportKey('jwk', keyPair.privateKey).then((jwk) => Buffer.from(jwk.d, 'base64')),
        crypto.subtle.exportKey('raw', keyPair.publicKey).then((arrayBuffer) => Buffer.from(arrayBuffer))
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

  const recipient = () => {
    return recipientInputRef.current.value
  }

  const onPayloadInput = useCallback((value) => {
    setPayload(value)
  }, [])

  const open = async () => {
    await acurastClient.start({ 
      secretKey: keyPair.privateKey, 
      publicKey: keyPair.publicKey,
    })

    acurastClient.onMessage((message) => {
      const messagePayload = unpackData(message.payload)
  
      setMessage({
        sender: Buffer.from(message.sender).toString('hex'),
        recipient: Buffer.from(message.recipient).toString('hex'),
        payload: messagePayload
      })
  
      const payloadData = Buffer.from(
        packData([messagePayload.args[0][0]], {
          prim: 'list',
          args: [
            {
              prim: 'pair',
              args: [
                {
                  prim: 'timestamp'
                },
                {
                  prim: 'pair',
                  args: [
                    {
                      prim: 'string'
                    },
                    {
                      prim: 'int'
                    }
                  ]
                }
              ]
            }
          ]
        })
      ).toString('hex')
      setPayloadData(payloadData)
  
      const publicKey = b58cencode(recipient(), new Uint8Array([3, 178, 139, 127]))
      setPublicKey(publicKey)
  
      const signature = messagePayload.args[1].string
      setSignature(signature)
  
      verify(payloadData, publicKey, signature)
    })
  }

  const close = () => {
    acurastClient.close()
  }

  const send = () => {
    const packedPayload = Buffer.from(packData(JSON.parse(payload)))
    acurastClient.send(recipient(), packedPayload)
  }

  const verify = async (payloadData, publicKey, signature) => {
    setMessageStatus(MESSAGE_STATUS.loading)
    const source = FAKE_SOURCE

    try {
      const { data: block } = await axios.get(`${TEZOS_NODE}/chains/main/blocks/head/header`)
      const { data: counter } = await axios.get(`${TEZOS_NODE}/chains/main/blocks/head/context/contracts/${source}/counter`)
  
      const { data } = await axios.post(`${TEZOS_NODE}/chains/main/blocks/head/helpers/scripts/run_operation`, {
        chain_id: block.chain_id,
        operation: {
          branch: block.hash,
          contents: [
            {
              kind: 'transaction',
              fee: '0',
              gas_limit: '1040000',
              storage_limit: '60000',
              amount: '0',
              destination: CONTRACT,
              source: source,
              counter: `${parseInt(counter, 10) + 1}`,
              parameters: {
                entrypoint: 'fulfill',
                value: {
                  prim: 'Pair',
                  args: [
                    {
                      bytes: payloadData
                    },
                    [
                      {
                        prim: 'Pair',
                        args: [
                          {
                            string: publicKey
                          },
                          {
                            bytes: signature
                          }
                        ]
                      }
                    ]
                  ]
                }
              }
            }
          ],
          signature: FAKE_SIGNATURE
        }
      })

      setMessageStatus(data.contents[0].metadata.operation_result.status === 'applied' 
        ? MESSAGE_STATUS.verified 
        : data.contents[0].metadata.operation_result.status === 'failed' && data.contents[0].metadata.operation_result.errors.find((err) => err.with?.string === 'InvalidSignature')
        ? MESSAGE_STATUS.invalidSignature
        : MESSAGE_STATUS.error
      )
    } catch (error) {
      setMessageStatus(MESSAGE_STATUS.error)
      console.warn(error)
    }
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
      <br /><br />
      <button onClick={open}>Open Connection</button>
      <br /><br />
      <button onClick={close}>Close Connection</button>
      <br /><br />
      ---
      <br /><br />
      <div>
        <span>Recipient</span>
        <input type="text" ref={recipientInputRef}></input>
      </div>
      <div>
        <span>Payload</span>
        <CodeMirror
          value={JSON.stringify(DEFAULT_PAYLOAD, null, 2)}
          height='250px'
          theme='dark'
          extensions={[json()]}
          basicSetup={{
            lineNumbers: false,
            highlightActiveLine: false
          }}
          onChange={onPayloadInput}
        />
        <br />
      </div>
      <button onClick={send}>Send</button>
      <br /><br />
      ---
      <br /><br />
      <button onClick={clear}>Clear</button>
      <div>
        <span>Message: </span>
        {messageStatus === MESSAGE_STATUS.loading && <Oval
          height={20}
          width={20}
          wrapperStyle={{
            display: 'inline-block'
          }}
        />}
        {messageStatus === MESSAGE_STATUS.verified && <span>✅</span>}
        {messageStatus === MESSAGE_STATUS.invalidSignature && <span>❌</span>}
        {messageStatus === MESSAGE_STATUS.error && <span>⚠️</span>}
      </div>
      <br />
      <div>
        <span>Payload Data: </span>
        <span>{payloadData ? payloadData : '---'}</span>
      </div>
      <div>
        <span>Public Key: </span>
        <span>{publicKey ? publicKey : '---'}</span>
      </div>
      <div>
        <span>Signature: </span>
        <span>{signature ? signature : '---'}</span>
      </div>
      <br />
      <span>Raw: </span>
      <CodeMirror
          value={message ? JSON.stringify(message, null, 2) : '{}'}
          height={message ? '250px' : '50px'}
          theme='dark'
          extensions={[json()]}
          editable={false}
          basicSetup={{
            lineNumbers: false,
            highlightActiveLine: false
          }}
        />
    </div>
  );
}

export default App;
