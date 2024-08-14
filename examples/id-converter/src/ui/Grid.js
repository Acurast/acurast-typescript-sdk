import { SimpleGrid } from '@mantine/core'
import { Skeleton, Pagination, Input } from '@mantine/core'
import { IconSearch } from '@tabler/icons-react'
import { useState } from 'react'

const SkeletonGrid = () => {
  return (
    <>
      <h3 style={{ textAlign: 'center' }}>Loading</h3>
      <Skeleton
        style={{ display: 'inline-flex', textAlign: 'center' }}
        height={20}
        mt={20}
        width="50%"
        radius="xl"
      />
    </>
  )
}
const Grid = (props) => {
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState('')
  const filteredElements = props.elements?.filter(({ id }) => {
    if (!selectedId?.length) {
      return true
    }
    return id === selectedId
  })
  return (
    <div>
      <Input
        placeholder="Search"
        leftSection={<IconSearch size={16} />}
        onChange={(event) => setSelectedId(event.target.value)}
        value={selectedId}
        style={{ width: '20%', float: 'right', display: 'inline-block' }}
      />
      {props.elements?.length ? (
        <>
          <SimpleGrid cols={3} spacing="lg">
            <h3>ID</h3>
            <h3>Proxy</h3>
            <h3>Status</h3>
            {filteredElements
              .slice(
                filteredElements.length > 10 ? (page - 1) * 10 : 0,
                filteredElements.length > 10 ? (page - 1) * 10 + 10 : 10
              )
              .map((el) => (
                <>
                  <div key={Math.random()}>{el.id}</div>
                  <div key={Math.random()}>{el.proxy}</div>
                  <div
                    key={Math.random()}
                    style={
                      el.status === 'READY'
                        ? { backgroundColor: 'green' }
                        : { backgroundColor: 'red' }
                    }
                  >
                    {el.status}
                  </div>
                </>
              ))}
          </SimpleGrid>
          <Pagination
            total={Math.max(Math.round(filteredElements.length / 10), 1)}
            value={page}
            onChange={setPage}
          />
        </>
      ) : (
        <SkeletonGrid />
      )}
    </div>
  )
}
export default Grid
