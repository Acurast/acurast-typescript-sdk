import React, { useState, useEffect } from 'react'
import useFetch from './useFetch'

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
  const [list, setList] = useState([])

  useEffect(() => {
    const l1 = list1.map((el) => [el, 'proxy-1', 'true'])
    const l2 = list2.map((el) => [el, 'proxy-2', 'true'])
    setList([...l1, ...l2])
  }, [list1, list2])

  return { list }
}
export default useConnectedPeers
