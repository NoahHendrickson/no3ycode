import type { ReactNode } from "react";

// Layout for the specimen pages, kept neutral so the component under it is the only thing styled
// by the theme: labels sit in the muted ink, grids align on fixed label columns.

export function Stack({ children, gap = 6 }: { children: ReactNode; gap?: number }) {
  return (
    <div className="flex flex-col" style={{ gap: gap * 4 }}>
      {children}
    </div>
  );
}

export function Row({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-6">
      {label ? (
        <span className="w-28 shrink-0 font-mono text-[11px] text-muted-foreground">{label}</span>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

/** Rows × columns with a header row; `cell` renders each intersection. */
export function Matrix<R extends string, C extends string>({
  rows,
  columns,
  cell,
}: {
  rows: ReadonlyArray<R>;
  columns: ReadonlyArray<C>;
  cell: (row: R, column: C) => ReactNode;
}) {
  return (
    <div
      className="grid items-center gap-x-6 gap-y-4"
      style={{ gridTemplateColumns: `7rem repeat(${columns.length}, max-content)` }}
    >
      <span />
      {columns.map((column) => (
        <span key={column} className="font-mono text-[11px] text-muted-foreground">
          {column}
        </span>
      ))}
      {rows.map((row) => (
        <div key={row} className="contents">
          <span className="font-mono text-[11px] text-muted-foreground">{row}</span>
          {columns.map((column) => (
            <div key={column}>{cell(row, column)}</div>
          ))}
        </div>
      ))}
    </div>
  );
}
