import React, { useState, useEffect } from 'react'
import useFetch from './useFetch'
import useAcurastClient from './useAcurastClient'

const useGetAllPeers = (target) => {
  const [start, setStart] = useState(0)
  const [allData, setAllData] = useState([])

  const { data } = useFetch(`https://${target}/ids?from=${start}`)

  useEffect(() => {
    if (data && data.length > 0) {
      setAllData(data)
      if (data.length === 99) {
        setStart((prevStart) => prevStart + 99)
      }
    }
  }, [data])

  return { allData }
}

const useConnectedPeers = () => {
  const { allData: list1 } = useGetAllPeers('websocket-proxy-1.prod.gke.acurast.com')
  const { allData: list2 } = useGetAllPeers('websocket-proxy-2.prod.gke.acurast.com')
  const { client, ready } = useAcurastClient()
  const [list, setList] = useState([])

  useEffect(() => {
    if (!ready) {
      return
    }

    const mergedList = [
      ...list1.map((el) => ({ id: el, proxy: 'proxy-1', status: 'UNAVAILABLE' })),
      ...list2.map((el) => ({ id: el, proxy: 'proxy-2', status: 'UNAVAILABLE' }))
    ]

    // Function to handle incoming messages
    const handleMessage = (message) => {
      setList((prevList) =>
        prevList.map((item) =>
          item.id === Buffer.from(message.sender).toString('hex')
            ? { ...item, status: 'READY' }
            : item
        )
      )
    }

    client.onMessage(handleMessage)

    mergedList.forEach((item) => {
      client.send(
        item.id,
        JSON.stringify({
          from: 'BTC',
          to: 'USD'
        })
      )
    })

    setList(mergedList)

    return () => {
      client.onMessage = undefined
    }
  }, [list1, list2, client, ready])

  return { list }
}
export default useConnectedPeers
