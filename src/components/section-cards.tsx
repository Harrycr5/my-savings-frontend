import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { TillSummary } from "@/lib/api-types"

function formatAmount(amount: string, currency: string) {
  const value = Number(amount)
  if (!Number.isFinite(value)) {
    return `${amount} ${currency}`
  }

  return `${new Intl.NumberFormat("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} ${currency}`
}

export function SectionCards({ summaries }: { summaries: TillSummary[] }) {
  if (summaries.length === 0) {
    return (
      <p className="px-4 text-sm text-muted-foreground lg:px-6">
        Todavía no hay cuentas de ahorro para mostrar.
      </p>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 px-4 sm:grid-cols-2 lg:px-6 xl:grid-cols-4">
      {summaries.map((summary) => {
        const cards = [
          ["Saldo total", summary.balance],
          ["Ingresos", summary.total_income],
          ["Gastos", summary.total_expense],
          ["Ahorro neto", summary.net_savings],
        ] as const

        return cards.map(([label, amount]) => (
          <Card key={`${summary.currency}-${label}`}>
            <CardHeader>
              <CardDescription>
                {label} · {summary.currency}
              </CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums">
                {formatAmount(amount, summary.currency)}
              </CardTitle>
            </CardHeader>
          </Card>
        ))
      })}
    </div>
  )
}
