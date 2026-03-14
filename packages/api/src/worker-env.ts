let workerEnv: CloudflareEnv | undefined

export function setWorkerEnv(env: CloudflareEnv) {
  workerEnv = env
}

export function getWorkerEnv() {
  return workerEnv
}
