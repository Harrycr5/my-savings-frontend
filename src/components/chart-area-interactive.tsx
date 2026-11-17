import { useMemo, useState } from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

export interface DailyMovement {
  date: string
  currency: string
  income: number
  expense: number
}

const chartConfig = {
  income: {
    label: "Ingresos",
    color: "var(--chart-1)",
  },
  expense: {
    label: "Gastos",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

export function ChartAreaInteractive({ data }: { data: DailyMovement[] }) {
  const [timeRange, setTimeRange] = useState("30d")
  const currencies = useMemo(
    () => [...new Set(data.map((item) => item.currency))].sort(),
    [data],
  )
  const [currency, setCurrency] = useState("")
  const selectedCurrency = currencies.includes(currency)
    ? currency
    : currencies[0]
  const filteredData = useMemo(() => {
    const days = Number.parseInt(timeRange, 10)
    const currencyData = data.filter(
      (item) => item.currency === selectedCurrency,
    )
    const lastDate = currencyData.at(-1)?.date
    if (!lastDate) return []

    const endDate = new Date(`${lastDate}T00:00:00`)
    const startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - days)

    return currencyData.filter((item) => {
      const date = new Date(`${item.date}T00:00:00`)
      return date >= startDate && date <= endDate
    })
  }, [data, selectedCurrency, timeRange])

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Ingresos y gastos</CardTitle>
        <CardDescription>
          {selectedCurrency
            ? `Movimientos en ${selectedCurrency}`
            : "No hay movimientos con moneda disponible para graficar."}
        </CardDescription>
        <CardAction>
          <div className="flex items-center gap-2">
            {currencies.length > 1 && (
              <Select
                value={selectedCurrency}
                onValueChange={setCurrency}
              >
                <SelectTrigger className="w-24" size="sm" aria-label="Moneda">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <ToggleGroup
              type="single"
              value={timeRange}
              onValueChange={(value) => value && setTimeRange(value)}
              variant="outline"
              className="hidden @[767px]/card:flex"
            >
              <ToggleGroupItem value="7d">7 días</ToggleGroupItem>
              <ToggleGroupItem value="30d">30 días</ToggleGroupItem>
              <ToggleGroupItem value="90d">90 días</ToggleGroupItem>
            </ToggleGroup>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger
                className="w-28 @[767px]/card:hidden"
                size="sm"
                aria-label="Periodo del gráfico"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 días</SelectItem>
                <SelectItem value="30d">30 días</SelectItem>
                <SelectItem value="90d">90 días</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="fillIncome" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-income)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-income)" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="fillExpense" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-expense)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-expense)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value: string) =>
                new Date(`${value}T00:00:00`).toLocaleDateString("es-PE", {
                  month: "short",
                  day: "numeric",
                })
              }
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) =>
                    new Date(`${value}T00:00:00`).toLocaleDateString("es-PE", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })
                  }
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="income"
              type="monotone"
              fill="url(#fillIncome)"
              stroke="var(--color-income)"
            />
            <Area
              dataKey="expense"
              type="monotone"
              fill="url(#fillExpense)"
              stroke="var(--color-expense)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
