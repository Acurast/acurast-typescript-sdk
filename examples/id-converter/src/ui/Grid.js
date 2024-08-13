import { SimpleGrid } from '@mantine/core'
import { Skeleton } from '@mantine/core'

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
  return (
    <>
      {props.elements ? (
        <SimpleGrid cols={3}>
          {props.elements.map((el) => (
            <div>{el}</div>
          ))}
        </SimpleGrid>
      ) : (
        <SkeletonGrid />
      )}
    </>
  )
}
export default Grid
