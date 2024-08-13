import { SimpleGrid } from '@mantine/core'
import { Skeleton, Pagination, Input } from '@mantine/core'
import { IconSearch } from '@tabler/icons-react'
import { useState } from 'react'

const SkeletonGrid = () => {
  return (
    <>
      <h1>Loading</h1>
      <Skeleton height={50} mt={50} width="100%" radius="xl" />
      <Skeleton height={50} mt={50} width="100%" radius="xl" />
      <Skeleton height={50} mt={50} width="100%" radius="xl" />
      <Skeleton height={50} mt={50} width="100%" radius="xl" />
    </>
  )
}
const Grid = (props) => {
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState('')
  const filteredElements = props.elements
    ?.filter(([id]) => {
      if (!selectedId?.length) {
        return true
      }
      return id === selectedId
    })
    .flat(1)
  return (
    <div>
      <Input
        placeholder="Search"
        leftSection={<IconSearch size={16} />}
        onChange={(event) => setSelectedId(event.target.value)}
        value={selectedId}
        style={{ width: '20%', float: 'right', display: 'inline-block' }}
      />
      {props.elements ? (
        <>
          <SimpleGrid cols={3} spacing="lg">
            <h3>ID</h3>
            <h3>Proxy</h3>
            <h3>Status</h3>
            {filteredElements
              .slice(
                (page - 1) * filteredElements.length,
                (page - 1) * filteredElements.length + filteredElements.length
              )
              .map((el, i) => (
                <div key={i}>{el}</div>
              ))}
          </SimpleGrid>
          <Pagination
            total={Math.max(filteredElements.length / 30, 1)}
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
