import './App.css'
import useConnectedPeers from './hooks/useConnectedPeers'
import Grid from './ui/Grid'

function App() {
  const { list } = useConnectedPeers()
  const available = list?.filter((el) => el.status === 'READY').length ?? 0
  const unavailable = list?.filter((el) => el.status === 'UNAVAILABLE').length ?? 0
  const uniqueNames = new Set()
  const duplicated = list.filter((el) => {
    const isDuplicate = uniqueNames.has(el.id)
    uniqueNames.add(el.id)
    return isDuplicate
  })

  return (
    <div style={{ textAlign: 'center' }}>
      <h1>Oracles</h1>
      <div>
        <h3>Total: {list?.length ?? 0}</h3>
        <h3>
          Available: {available} {((available / list.length) * 100).toFixed(2)}%
        </h3>
        <h3>
          Unavailable: {unavailable} {((unavailable / list.length) * 100).toFixed(2)}%
        </h3>
      </div>
      <Grid elements={list} />
      <div>
        <h3>Duplicated Connections</h3>
        <Grid elements={duplicated} />
      </div>
    </div>
  )
}

export default App
