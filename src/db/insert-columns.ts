// How many parameters one row of a multi-row INSERT can bind: every column
// of the table, since drizzle binds a column's default when a row leaves it
// out. src/lib/chunk.ts's chunkRowsForInsert sizes chunks by it.
import { getTableColumns, type Table } from "drizzle-orm";

export function insertColumnCount(table: Table): number {
  return Object.keys(getTableColumns(table)).length;
}
