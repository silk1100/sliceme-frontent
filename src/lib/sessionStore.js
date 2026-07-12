import { get, set, del, keys, clear as idbClear } from 'idb-keyval'

export async function setItem(key, value) {
  await set(key, value)
}

export async function getItem(key) {
  return await get(key)
}

export async function getAll() {
  const allKeys = await keys()
  const allValues = await Promise.all(allKeys.map(k => get(k)))
  return allValues.filter(v => v && typeof v === 'object' && v.taskId)
}

export async function removeItem(key) {
  await del(key)
}

export async function clear() {
  await idbClear()
}
