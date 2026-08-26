import { openStore, startBackgroundSync, type Store } from "@workboard/core";

let syncing = false;

/**
 * A fresh handle per render. Each one memoizes its reads for the life of the
 * request and is then discarded, so a page never serves data the MCP server has
 * since overwritten.
 */
export function db(): Store {
  if (!syncing) {
    syncing = true;
    startBackgroundSync(openStore());
  }
  return openStore();
}
