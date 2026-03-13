import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers'

let container: StartedTestContainer

export async function startTestDB(): Promise<string> {
  container = await new GenericContainer(
    'postgis-vector-timescaledb:local',
  )
    .withEnvironment({
      POSTGRES_USER: 'test',
      POSTGRES_PASSWORD: 'test',
      POSTGRES_DB: 'test',
    })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forLogMessage('database system is ready to accept connections', 2))
    .start()

  const host = container.getHost()
  const port = container.getMappedPort(5432)
  return `postgresql://test:test@${host}:${port}/test`
}

export async function stopTestDB(): Promise<void> {
  if (container) {
    await container.stop()
  }
}
