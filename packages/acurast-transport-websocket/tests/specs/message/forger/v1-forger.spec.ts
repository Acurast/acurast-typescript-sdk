import { expect } from 'chai'

import {
  type ChallengeMessage,
  createInitMessage,
  type InitMessage,
  createChallengeMessage,
  createAcceptedMessage,
  type AcceptedMessage,
  type PayloadMessage,
  createPayloadMessage,
  type ResponseMessage,
  createResponseMessage
} from '../../../../src/message/v1-messages'
import { forgeV1Message } from '../../../../src/message/forger/v1-forger'

describe('V1Forger', function () {
  it('forges InitMessage', function () {
    const sender: Buffer = Buffer.from('8c30e6864d09f7a3a05b84d44c7d8460', 'hex')
    const initMessage: InitMessage = createInitMessage(sender)

    const forged: Buffer = forgeV1Message(initMessage)

    expect(forged.toString('hex')).to.eq('108c30e6864d09f7a3a05b84d44c7d846000000000000000000000000000000000')
  })

  it('forges ChallengeMessage', function () {
    const recipient: Buffer = Buffer.from('8c30e6864d09f7a3a05b84d44c7d8460', 'hex')
    const challenge: Buffer = Buffer.from('802e4f57093eed0b54a4569c0f10748d', 'hex')
    const difficulty: Buffer = Buffer.from('ffffffffffffffffffffffffffffffff', 'hex')
    const challengeMessage: ChallengeMessage = createChallengeMessage(recipient, challenge, difficulty)

    const forged: Buffer = forgeV1Message(challengeMessage)

    expect(forged.toString('hex')).to.eq('11000000000000000000000000000000008c30e6864d09f7a3a05b84d44c7d8460ffffffffffffffffffffffffffffffff802e4f57093eed0b54a4569c0f10748d')
  })

  it('forges ResponseMessage', function () {
    const sender: Buffer = Buffer.from('8c30e6864d09f7a3a05b84d44c7d8460', 'hex')
    const challenge: Buffer = Buffer.from('802e4f57093eed0b54a4569c0f10748d', 'hex')
    const publicKey: Buffer = Buffer.from('0338f595e8b20754d4b4520d47bbf152ce574d7bf0cbfb4d984aa6b5025c1483b1', 'hex')
    const nonce: Buffer = Buffer.from('00000000000000000000000000000000', 'hex')
    const signature: Buffer = Buffer.from('1a53e66510f16aa6905a525f332670f10df1f044f7910faeda1f038fd7a53c59503060c492bcf4ae0fe6398e1364db93a1691f4441201284f438b302fa47c109', 'hex')
    const responseMessage: ResponseMessage = createResponseMessage(sender, challenge, publicKey, nonce, signature)

    const forged: Buffer = forgeV1Message(responseMessage)

    expect(forged.toString('hex')).to.eq('128c30e6864d09f7a3a05b84d44c7d846000000000000000000000000000000000802e4f57093eed0b54a4569c0f10748d0338f595e8b20754d4b4520d47bbf152ce574d7bf0cbfb4d984aa6b5025c1483b1000000000000000000000000000000001a53e66510f16aa6905a525f332670f10df1f044f7910faeda1f038fd7a53c59503060c492bcf4ae0fe6398e1364db93a1691f4441201284f438b302fa47c109')
  })

  it('forges AcceptedMessage', function () {
    const recipient: Buffer = Buffer.from('8c30e6864d09f7a3a05b84d44c7d8460', 'hex')
    const acceptedMessage: AcceptedMessage = createAcceptedMessage(recipient)

    const forged: Buffer = forgeV1Message(acceptedMessage)

    expect(forged.toString('hex')).to.eq('13000000000000000000000000000000008c30e6864d09f7a3a05b84d44c7d8460')
  })

  it('forges PayloadMessage', function () {
    const sender: Buffer = Buffer.from('8c30e6864d09f7a3a05b84d44c7d8460', 'hex')
    const recipient: Buffer = Buffer.from('dc6e99132174e7f640ea5b7364c00b78', 'hex')
    const payload: Buffer = Buffer.from('6d657373616765', 'hex')
    const payloadMessage: PayloadMessage = createPayloadMessage(sender, recipient, payload)

    const forged: Buffer = forgeV1Message(payloadMessage)

    expect(forged.toString('hex')).to.eq('148c30e6864d09f7a3a05b84d44c7d8460dc6e99132174e7f640ea5b7364c00b786d657373616765')
  })
})