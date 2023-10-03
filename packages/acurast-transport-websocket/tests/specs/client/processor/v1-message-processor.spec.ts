/* eslint-disable @typescript-eslint/no-unused-expressions */
import { expect } from 'chai'

import { type KeyPair } from '../../../../src/client/types'
import { type SendProcessorAction, type NotifyProcessorAction, type ProcessorAction } from '../../../../src/client/processor/message-processor'
import { V1MessageProcessor } from '../../../../src/client/processor/v1-message.processor'
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

describe('V1MessageProcessor', function() {
  it('processes InitMessage', async function() {
    const sender: Buffer = Buffer.from('a8db9fd222f02c750374c15897331ed6', 'hex')
    const keyPair: KeyPair = {
      secretKey: Buffer.from('6395bd8e07cbdd6af107d90cd5cb20930af9c9e7587ed605383072795c1590ec', 'hex'),
      publicKey: Buffer.from('028400fdb370c84c566d1f05bf7ed41dc72e618561cb8815d46dbccad7ea7bd077', 'hex')
    }
    const initMessage: InitMessage = createInitMessage(sender)

    const processor: V1MessageProcessor = new V1MessageProcessor(sender)
    const actionOrUndefined: ProcessorAction | undefined =
      await processor.processMessage(initMessage, keyPair)

    expect(actionOrUndefined).to.be.undefined
  })

  it('processes ChallengeMessage', async function() {
    const sender: Buffer = Buffer.from('a8db9fd222f02c750374c15897331ed6', 'hex')
    const keyPair: KeyPair = {
      secretKey: Buffer.from('6395bd8e07cbdd6af107d90cd5cb20930af9c9e7587ed605383072795c1590ec', 'hex'),
      publicKey: Buffer.from('028400fdb370c84c566d1f05bf7ed41dc72e618561cb8815d46dbccad7ea7bd077', 'hex')
    }

    const recipient: Buffer = sender
    const challenge: Buffer = Buffer.from('06bbd40c7e566cccbbc754a7fc7f8ffd', 'hex')
    const challengeMessage: ChallengeMessage = createChallengeMessage(
      recipient,
      challenge,
      Buffer.from('ffffffffffffffffffffffffffffffff', 'hex')
    )

    const processor: V1MessageProcessor = new V1MessageProcessor(sender)
    const actionOrUndefined: ProcessorAction | undefined =
      await processor.processMessage(challengeMessage, keyPair)

    expect(actionOrUndefined).not.to.be.undefined
    expect(actionOrUndefined?.type).to.eq('send')
    const action: SendProcessorAction = actionOrUndefined as SendProcessorAction

    expect(action.message.type).to.eq('response')
    const message: ResponseMessage = action.message as ResponseMessage

    expect(message.sender).to.eq(sender)
    expect(message.challenge).to.eq(challenge)
    expect(message.publicKey).to.eq(keyPair.publicKey)
    expect(Buffer.from(message.nonce).toString('hex')).to.eq(Buffer.alloc(16).toString('hex'))
    expect(Buffer.from(message.signature).toString('hex')).to.eq('64648baaca7bb7d5603f8a42132c648a78b91b34c5209ccebe43e0a39b96d99cbff07a380f2e857f73dab74d018ef088d0a885899e25cf24af7b619658879d94')
  })

  it('processes ResponseMessage', async function() {
    const sender: Buffer = Buffer.from('a8db9fd222f02c750374c15897331ed6', 'hex')
    const keyPair: KeyPair = {
      secretKey: Buffer.from('6395bd8e07cbdd6af107d90cd5cb20930af9c9e7587ed605383072795c1590ec', 'hex'),
      publicKey: Buffer.from('028400fdb370c84c566d1f05bf7ed41dc72e618561cb8815d46dbccad7ea7bd077', 'hex')
    }

    const challenge: Buffer = Buffer.from('ee31dab8fa052a68d59feac6a7236f8c', 'hex')
    const publicKey: Buffer = Buffer.from(
      '030c3b833d4abe294dadce48b824eab2b41acd430d284565245d92ed65ae34bd3a',
      'hex'
    )
    const nonce: Buffer = Buffer.from('00000000000000000000000000000000', 'hex')
    const signature: Buffer = Buffer.from(
      '6e194a2c777752b8d92b49aec2272b2c2879ada7e0a8bd4dcd20fe556b9b8a22ee665ffc930517435c751961f7b6e3aa0339828bba59f9d7782d8658e2bf039c',
      'hex'
    )
    const responseMessage: ResponseMessage = createResponseMessage(
      sender,
      challenge,
      publicKey,
      nonce,
      signature
    )

    const processor: V1MessageProcessor = new V1MessageProcessor(sender)
    const actionOrUndefined: ProcessorAction | undefined =
      await processor.processMessage(responseMessage, keyPair)

    expect(actionOrUndefined).to.be.undefined
  })

  it('processes AcceptedMessage', async function() {
    const sender: Buffer = Buffer.from('a8db9fd222f02c750374c15897331ed6', 'hex')
    const keyPair: KeyPair = {
      secretKey: Buffer.from('6395bd8e07cbdd6af107d90cd5cb20930af9c9e7587ed605383072795c1590ec', 'hex'),
      publicKey: Buffer.from('028400fdb370c84c566d1f05bf7ed41dc72e618561cb8815d46dbccad7ea7bd077', 'hex')
    }

    const recipient: Buffer = sender
    const acceptedMessage: AcceptedMessage = createAcceptedMessage(recipient)

    const processor: V1MessageProcessor = new V1MessageProcessor(sender)
    const actionOrUndefined: ProcessorAction | undefined =
      await processor.processMessage(acceptedMessage, keyPair)

    expect(actionOrUndefined).not.to.be.undefined
    expect(actionOrUndefined!.type).to.eq('connected')
  })

  it('processes PayloadMessage', async function() {
    const sender: Buffer = Buffer.from('a8db9fd222f02c750374c15897331ed6', 'hex')
    const keyPair: KeyPair = {
      secretKey: Buffer.from('6395bd8e07cbdd6af107d90cd5cb20930af9c9e7587ed605383072795c1590ec', 'hex'),
      publicKey: Buffer.from('028400fdb370c84c566d1f05bf7ed41dc72e618561cb8815d46dbccad7ea7bd077', 'hex')
    }

    const otherSender: Buffer = Buffer.from('1ef057a3f77d03aa7c067dd113c9410b', 'hex')
    const recipient: Buffer = sender
    const payload: Buffer = Buffer.from('90cace2932470ec1af20c53ae24abfce', 'hex')
    const payloadMessage: PayloadMessage = createPayloadMessage(otherSender, recipient, payload)

    const processor: V1MessageProcessor = new V1MessageProcessor(sender)
    const actionOrUndefined: ProcessorAction | undefined =
      await processor.processMessage(payloadMessage, keyPair)

    expect(actionOrUndefined).not.to.be.undefined
    expect(actionOrUndefined!.type).to.eq('notify')
    const action: NotifyProcessorAction = actionOrUndefined as NotifyProcessorAction

    expect(action.message.sender).to.eq(payloadMessage.sender)
    expect(action.message.recipient).to.eq(payloadMessage.recipient)
    expect(action.message.payload).to.eq(payloadMessage.payload)
  })
})
