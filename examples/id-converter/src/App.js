import './App.css'
import useConnectedPeers from './hooks/useConnectedPeers'
import useFetch from './hooks/useFetch'
import Grid from './ui/Grid'

function App() {
  const { list } = useConnectedPeers()

  return (
    <div style={{ textAlign: 'center' }}>
      <Grid elements={list} />
    </div>
  )
}

export default App
