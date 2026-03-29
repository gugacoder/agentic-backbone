import type { DisplaySpreadsheet } from "@agentic-backbone/ai-sdk";

function formatCell(
  value: string | number | null,
  colIndex: number,
  moneyColumns: number[] = [],
  percentColumns: number[] = [],
): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    if (moneyColumns.includes(colIndex)) {
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
    }
    if (percentColumns.includes(colIndex)) {
      return new Intl.NumberFormat("pt-BR", {
        style: "percent",
        minimumFractionDigits: 1,
        maximumFractionDigits: 2,
      }).format(value / 100);
    }
    return new Intl.NumberFormat("pt-BR").format(value);
  }
  return String(value);
}

export function SpreadsheetRenderer({ title, headers, rows, format }: DisplaySpreadsheet) {
  const moneyColumns = format?.moneyColumns ?? [];
  const percentColumns = format?.percentColumns ?? [];

  return (
    <div className="ai-chat-display ai-chat-display-spreadsheet">
      {title && <h3 className="ai-chat-display-spreadsheet-title">{title}</h3>}

      <div className="ai-chat-display-spreadsheet-scroll">
        <table className="ai-chat-display-spreadsheet-table" aria-readonly="true">
          <thead>
            <tr>
              <th className="ai-chat-display-spreadsheet-th ai-chat-display-spreadsheet-th--rownum" aria-label="Linha" />
              {headers.map((h, i) => (
                <th key={i} className="ai-chat-display-spreadsheet-th">
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="ai-chat-display-spreadsheet-row">
                <td className="ai-chat-display-spreadsheet-td ai-chat-display-spreadsheet-td--rownum">
                  {ri + 1}
                </td>
                {row.map((cell, ci) => {
                  const isMoney = moneyColumns.includes(ci);
                  const isPercent = percentColumns.includes(ci);
                  const isNumber = typeof cell === "number";
                  return (
                    <td
                      key={ci}
                      className={`ai-chat-display-spreadsheet-td${isMoney ? " ai-chat-display-spreadsheet-td--money" : ""}${isPercent ? " ai-chat-display-spreadsheet-td--percent" : ""}${isNumber && !isMoney && !isPercent ? " ai-chat-display-spreadsheet-td--number" : ""}`}
                    >
                      {formatCell(cell, ci, moneyColumns, percentColumns)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
