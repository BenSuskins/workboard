import { getDb, startBackgroundSync, type Db } from "@workboard/core";

let started = false;

export function db(): Db {
  const instance = getDb();
  if (!started) {
    started = true;
    startBackgroundSync(instance);
  }
  return instance;
}
