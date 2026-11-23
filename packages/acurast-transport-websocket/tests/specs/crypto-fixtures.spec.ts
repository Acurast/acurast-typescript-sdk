import { expect } from 'chai'

import { Crypto } from '../../src/crypto'

// Generated with the elliptic + @stablelib implementation (transport-websocket 1.0.1).
// Processors verify these signatures, so the output must stay byte-identical.
const FIXTURES = {
  sign: [
    {
      secretKeyHex: 'f756203bb98842c7f0d6cb369d16f979374fc8e8479bb9ed84efd650f071ae3c',
      dataHex: '2020202020202020202020202020202020202020202020202020202020202020',
      signatureHex:
        'f14582d919ce30e2747964f571542b75b10838cec5e6bfee4f9373f78dd2ad0e481a5231c6aacfc0193bf68d3845be0d6e938ca1274dccf4c0374f90c712111e',
      uncompressedPublicKeyHex:
        '0479e4fd27830bc3d26e2e070c27794ca58e9631e2117620b5eaf9d1d18b50df96b924174b3bc0ddc8e35020a69e34395749682073ba2f67a3c8a59cc10d15fa56',
      compressedPublicKeyHex: '0279e4fd27830bc3d26e2e070c27794ca58e9631e2117620b5eaf9d1d18b50df96',
    },
    {
      secretKeyHex: 'bf6574567b623bfe123ca9b7a7c1b3f475431c280bfc97a800ac8703fc45db75',
      dataHex: '3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f',
      signatureHex:
        '0e0de7a970038fb344005de0fa5d96542ce53d2cf01cc413c83f50c8131e251bf30bc978f30383036c0dff397ee724a4fa6087b51496d4786ec968f5cd1ec023',
      uncompressedPublicKeyHex:
        '045717b5f10d83d2183c578e3de17895a825df497e1442d6f49a0e42d19bd117516a300529779641ff8c5a686f5266a330116e984f3b0efe5b13913772f729855a',
      compressedPublicKeyHex: '025717b5f10d83d2183c578e3de17895a825df497e1442d6f49a0e42d19bd11751',
    },
    {
      secretKeyHex: '9c1c307ee4a6a913cccf522efe74685b0bb58c05080108ec29f6e460d91587f7',
      dataHex: '5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e',
      signatureHex:
        'fb343806db479a066cd8a986089ab83abcebc08da3ee5c8c3735be932d2ec7d5ab535d2b04760151161b1ee553d92cdee399e792ce66f7a1248e04bc9e73a3a1',
      uncompressedPublicKeyHex:
        '0468894e3584c13170e2296ea8d8e0a7b74022bce1908ff70558287b5a8a027bd96c880716eb84ebc56187158bb2af4e59c3bf22ae6cb90fa5a6dadcf78c6369be',
      compressedPublicKeyHex: '0268894e3584c13170e2296ea8d8e0a7b74022bce1908ff70558287b5a8a027bd9',
    },
    {
      secretKeyHex: 'f9f380c95dcb48378cd1c2a6434cf241aafbd6ef9d4aac00080b18e7347d2d23',
      dataHex: '1111111111111111111111111111111111',
      signatureHex:
        'e80a3abddd5a0eb874a3e3b23db83810dfd16c4aa0c75971204ff5e33ec67ae0032910ea8416365c7419e5d95686073e1917484025659712a213acc73034c1e9',
      uncompressedPublicKeyHex:
        '0482baec5e4af0b2e1121362a744eb2c5a0c8fce5d607825c21b5f1661e1538ee915266dc22cdc072aa41ce2c86375936f9f69df5a0bb8beff363b5baa0ade707a',
      compressedPublicKeyHex: '0282baec5e4af0b2e1121362a744eb2c5a0c8fce5d607825c21b5f1661e1538ee9',
    },
    {
      secretKeyHex: '449d915156c8386407e9a2fb74a6f4076d074dc5c39c9c2333b56720351e828c',
      dataHex: '3030303030303030303030303030303030',
      signatureHex:
        'e5441bfd32c3e573145625ddb881a81483c71640f8968101fb541849dd45be33da5e6c61cdfe1b4a3c60c7bffb198c45f052f9f23f56771dae95b575ae0bfeb9',
      uncompressedPublicKeyHex:
        '0404e906dea0efbad7a6d7990de5a1d8933a680bbb142cdb33f3c12f69f73846e46f107f029c80d3586c8c9b834907be6994e9e619fafde10a7cb0fab1e38bf887',
      compressedPublicKeyHex: '0304e906dea0efbad7a6d7990de5a1d8933a680bbb142cdb33f3c12f69f73846e4',
    },
    {
      secretKeyHex: '189675caf33ec365feefdc967d7a57bcdb2c2d9a48a02b49966ed003452cc1f1',
      dataHex: '4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f',
      signatureHex:
        '1313f60f4cb58fb95291c7d8181025f15a85208236a94f62961444fc68d6610e69d5d123d766b987a02e23da3419413092dd6404c5c8819f724440986004de21',
      uncompressedPublicKeyHex:
        '04c5f145ab94cb42191ffc3e0604970788841d57cf1af9338c51cdc2a364e8f50832a151bb7bb952dab40d26d5100433599688493830a99970275d16e2baa06a92',
      compressedPublicKeyHex: '02c5f145ab94cb42191ffc3e0604970788841d57cf1af9338c51cdc2a364e8f508',
    },
    {
      secretKeyHex: '63b3a0b73c74672a7857c758d161d42a837fbbcfbfe9642b65e5e8eea1e8ebc8',
      dataHex:
        '303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030',
      signatureHex:
        '0e7eea69b86a4dbe43eaad49e3cd9703ac557d3d0231e9ead7efcbd1436b58ce9617a1a896a695c012c62123d276651654d699b6ef79b8415b281cb1387a13f5',
      uncompressedPublicKeyHex:
        '04621c85072c6a9b74242b05903b4613074ad04a6a2e2726ad1805a6d7afa85efc77f83f22a980178180440de4cd8ebb731640fefcc4bc46656d5e6eb9a104c5fc',
      compressedPublicKeyHex: '02621c85072c6a9b74242b05903b4613074ad04a6a2e2726ad1805a6d7afa85efc',
    },
    {
      secretKeyHex: '1600fe50b3ee0056e63bb036ed8e1cbcd56fc1ee93e9ad42bb8e6c91c73f7a83',
      dataHex:
        '4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f',
      signatureHex:
        '6669afa4ae8271ec360492b57ec16ea67e5cd770070b5a8e426d14f1e12d883d66f84899ca919fb8df36da2c9e2c42249dd7b9028f9a91c2cc358fcdad6bb507',
      uncompressedPublicKeyHex:
        '042855a25622b27b760edd466f3fbe4db460829e449f47828b99f9ea6229d255b00a1c861ae7bdc0d5d991accbb6c8de8d7750646db0d5fa7ebdb4887bee1049d0',
      compressedPublicKeyHex: '022855a25622b27b760edd466f3fbe4db460829e449f47828b99f9ea6229d255b0',
    },
    {
      secretKeyHex: '9319b568b8dc454873ef812503c81b3ffb44b27b4694a7ae4b8f5b05f62a4dc8',
      dataHex:
        '6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e',
      signatureHex:
        '1f8098c948fb82142949849e57494a9a72ce4dce298ed4766915f32a976d9e89a5e5cb3a2726d39de0a58655fe9d724ccad3ce3bdffe980f4ad2defa25ec5de7',
      uncompressedPublicKeyHex:
        '046e86ed4a800d4ac9f70670ceaad12fb239a30f62393b4c733ca6693263934437b1ddb58f77a2c151906fdb4dde1e06d9f144226f67fa7504be787d1473039dea',
      compressedPublicKeyHex: '026e86ed4a800d4ac9f70670ceaad12fb239a30f62393b4c733ca6693263934437',
    },
    {
      secretKeyHex: '982867b360703b653c56ff8aa5e59e41ce77249796cff1ea3ffa08da752a4d0e',
      dataHex: '',
      signatureHex:
        '02ba5bcf1ba4c3d6c7cef4cd69f91c8b3bf1a5bab35ff232450b0574b3b998635364bb88072a32bea73aea25ca086224cef7e3afa03a7c51d625d80a6c2ae656',
      uncompressedPublicKeyHex:
        '0410e76b27a8e04811007488c3cc504fa0b07cff212e04947034e828c67ee933ecd56e24d34a410fd8b6d4f57a7322383da1e20207b531e5f1acd0f6b491803d57',
      compressedPublicKeyHex: '0310e76b27a8e04811007488c3cc504fa0b07cff212e04947034e828c67ee933ec',
    },
    {
      secretKeyHex: '7f4eb535af88fba86aec473fa25d20343e1289533d24b36f587e5e09cd296ad3',
      dataHex: '',
      signatureHex:
        '2ef99e1ae899a9a4701dab55d9b0f98691604bc5b24f47e699b3d8ac1e52a872aa22f692c197bc00d0c78e89b6e39989f09c48f191500b40969908b05b16246f',
      uncompressedPublicKeyHex:
        '041b72dd5722be82f4da98123449fd6954455cd952ce7c89e911b79a49d1912548a0a14c2ce9d0ef04de84bca381c42b86daaa8c8978a96f57e3f405216f79e7af',
      compressedPublicKeyHex: '031b72dd5722be82f4da98123449fd6954455cd952ce7c89e911b79a49d1912548',
    },
    {
      secretKeyHex: '358a072cf9aa076e98533cd82e2d429b64eeae23ec1602c81484745374aac46a',
      dataHex: '',
      signatureHex:
        '923b414dbee2993106b45b2c49064fc23aaaf8bdd6693f7ddf079f7ae770a668a29ab9159a1e45d937b3124b1dc0b5e738bdd006ffa3bc413b33f0311b2b390d',
      uncompressedPublicKeyHex:
        '04bd7c73a97caab59fd68b59eea9c8541b4d68b488074fbe954d3bf4670e5ecfe426eb7a3a61fe5099f12ac3f71a878cb0aeaf79d35e499f09c59c002c4d45b5ce',
      compressedPublicKeyHex: '02bd7c73a97caab59fd68b59eea9c8541b4d68b488074fbe954d3bf4670e5ecfe4',
    },
  ],
  sha256: [
    {
      inputHex: '',
      sha256Hex: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    },
    {
      inputHex: '616263',
      sha256Hex: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    },
    {
      inputHex:
        '7878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878787878',
      sha256Hex: 'aa20c23e3201834050679e1d88941b9a6fed0557c9a705cb2c315e2e63fd486d',
    },
  ],
}

describe('Crypto fixtures', function () {
  const crypto = new Crypto()

  FIXTURES.sign.forEach((f, i) => {
    it(`signs and compresses like the previous implementation #${i} (${f.dataHex.length / 2} bytes)`, function () {
      const signature = crypto.signP256(
        Buffer.from(f.dataHex, 'hex'),
        Buffer.from(f.secretKeyHex, 'hex'),
      )
      expect(Buffer.from(signature).toString('hex')).eq(f.signatureHex)

      const compressed = crypto.compressP256PublicKey(
        Buffer.from(f.uncompressedPublicKeyHex, 'hex'),
      )
      expect(Buffer.from(compressed).toString('hex')).eq(f.compressedPublicKeyHex)
    })
  })

  it('accepts a secret key without its leading zero byte, as elliptic did', function () {
    const data = Buffer.alloc(32, 7)
    const short = Buffer.alloc(31, 9)
    const padded = Buffer.concat([Buffer.alloc(1), short])
    expect(Buffer.from(crypto.signP256(data, short)).toString('hex')).eq(
      Buffer.from(crypto.signP256(data, padded)).toString('hex'),
    )
  })

  FIXTURES.sha256.forEach((f, i) => {
    it(`hashes like the previous implementation #${i}`, function () {
      expect(Buffer.from(crypto.sha256(Buffer.from(f.inputHex, 'hex'))).toString('hex')).eq(
        f.sha256Hex,
      )
    })
  })
})
