/* eslint-disable @typescript-eslint/no-unused-expressions */
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
  createResponseMessage,
  type V1Message
} from '../../../../src/message/v1-messages'
import { parseV1Message } from '../../../../src/message/parser/v1-parser'

describe('V1Parser', function () {
  it('parses InitMessage', function () {
    const sender: Buffer = Buffer.from('8c30e6864d09f7a3a05b84d44c7d8460', 'hex')
    const initMessage: InitMessage = createInitMessage(sender)
    const bytes: Buffer = Buffer.from('108c30e6864d09f7a3a05b84d44c7d846000000000000000000000000000000000', 'hex')

    const parsed: V1Message | undefined = parseV1Message(bytes)

    expect(parsed).not.to.be.undefined
    expect(parsed).to.deep.eq(initMessage)
  })

  it('parses ChallengeMessage', function () {
    const recipient: Buffer = Buffer.from('8c30e6864d09f7a3a05b84d44c7d8460', 'hex')
    const challenge: Buffer = Buffer.from('802e4f57093eed0b54a4569c0f10748d', 'hex')
    const difficulty: Buffer = Buffer.from('ffffffffffffffffffffffffffffffff', 'hex')
    const challengeMessage: ChallengeMessage = createChallengeMessage(recipient, challenge, difficulty)
    const bytes: Buffer = Buffer.from('11000000000000000000000000000000008c30e6864d09f7a3a05b84d44c7d8460ffffffffffffffffffffffffffffffff802e4f57093eed0b54a4569c0f10748d', 'hex')

    const parsed: V1Message | undefined = parseV1Message(bytes)

    expect(parsed).not.to.be.undefined
    expect(parsed).to.deep.eq(challengeMessage)
  })

  it('parses ResponseMessage', function () {
    const sender: Buffer = Buffer.from('8c30e6864d09f7a3a05b84d44c7d8460', 'hex')
    const challenge: Buffer = Buffer.from('802e4f57093eed0b54a4569c0f10748d', 'hex')
    const publicKey: Buffer = Buffer.from('0338f595e8b20754d4b4520d47bbf152ce574d7bf0cbfb4d984aa6b5025c1483b1', 'hex')
    const nonce: Buffer = Buffer.from('00000000000000000000000000000000', 'hex')
    const signature: Buffer = Buffer.from('1a53e66510f16aa6905a525f332670f10df1f044f7910faeda1f038fd7a53c59503060c492bcf4ae0fe6398e1364db93a1691f4441201284f438b302fa47c109', 'hex')
    const responseMessage: ResponseMessage = createResponseMessage(sender, challenge, publicKey, nonce, signature)
    const bytes: Buffer = Buffer.from('128c30e6864d09f7a3a05b84d44c7d846000000000000000000000000000000000802e4f57093eed0b54a4569c0f10748d0338f595e8b20754d4b4520d47bbf152ce574d7bf0cbfb4d984aa6b5025c1483b1000000000000000000000000000000001a53e66510f16aa6905a525f332670f10df1f044f7910faeda1f038fd7a53c59503060c492bcf4ae0fe6398e1364db93a1691f4441201284f438b302fa47c109', 'hex')

    const parsed: V1Message | undefined = parseV1Message(bytes)

    expect(parsed).not.to.be.undefined
    expect(parsed).to.deep.eq(responseMessage)
  })

  it('parses AcceptedMessage', function () {
    const recipient: Buffer = Buffer.from('8c30e6864d09f7a3a05b84d44c7d8460', 'hex')
    const acceptedMessage: AcceptedMessage = createAcceptedMessage(recipient)
    const bytes: Buffer = Buffer.from('13000000000000000000000000000000008c30e6864d09f7a3a05b84d44c7d8460', 'hex')

    const parsed: V1Message | undefined = parseV1Message(bytes)

    expect(parsed).not.to.be.undefined
    expect(parsed).to.deep.eq(acceptedMessage)
  })

  it('parses PayloadMessage', function () {
    const sender: Buffer = Buffer.from('8c30e6864d09f7a3a05b84d44c7d8460', 'hex')
    const recipient: Buffer = Buffer.from('dc6e99132174e7f640ea5b7364c00b78', 'hex')
    const payload: Buffer = Buffer.from('6d657373616765', 'hex')
    const payloadMessage: PayloadMessage = createPayloadMessage(sender, recipient, payload)
    const bytes: Buffer = Buffer.from('148c30e6864d09f7a3a05b84d44c7d8460dc6e99132174e7f640ea5b7364c00b786d657373616765', 'hex')

    const parsed: V1Message | undefined = parseV1Message(bytes)

    expect(parsed).not.to.be.undefined
    expect(parsed).to.deep.eq(payloadMessage)
  })
})