import { AcurastClient } from '@acurast/dapp'
import { useState, useMemo, useEffect } from 'react'

const useAcurastClient = () => {
  const acurastClient = useMemo(
    () => new AcurastClient(['wss://websocket-proxy-1.prod.gke.acurast.com']),
    []
  )
  const [ready, setIsReady] = useState(false)

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

      await acurastClient.start({
        secretKey: privateKeyRaw.toString('hex'),
        publicKey: publicKeyRaw.toString('hex')
      })

      setTimeout(() => setIsReady(true), 1000)
    }

    init()
  }, [acurastClient])

  return { client: acurastClient, ready }
}
export default useAcurastClient
