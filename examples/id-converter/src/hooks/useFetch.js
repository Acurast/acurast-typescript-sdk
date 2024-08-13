import { useState, useEffect } from 'react'

const useFetch = (url, method, body) => {
  const [data, setData] = useState()
  const [error, setError] = useState()

  useEffect(() => {
    fetch(url, {
      method,
      headers: new Headers({
        Authorization: 'cuZK-TfaWMjGDtBpQsM5oTOL20PwEJi1RUjAA0KfP30',
        'Content-Type': 'application/json'
      }),
      body
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Request failed. Error ${res.status}`)
        }
        return res.json()
      })
      .then((data) => setData(data))
      .catch((error) => setError(error.message))
  }, [url])

  return { data, error }
}
export default useFetch
