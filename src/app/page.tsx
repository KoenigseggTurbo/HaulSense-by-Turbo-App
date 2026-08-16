
"use client"

import { useMemo, useState, useEffect } from "react"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card"
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from "recharts"
import { 
  TrendingUp, 
  DollarSign, 
  Route, 
  Package, 
  Calendar,
  Plus,
  Loader2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useCollection, useFirestore, useUser, useMemoFirebase, useDoc } from "@/firebase"
import { collection, query, orderBy, doc } from "firebase/firestore"
import { Load, Expense, AppSettings } from "@/lib/types"
import { 
  startOfWeek, 
  endOfWeek, 
  isWithinInterval, 
  parseISO, 
  format, 
  eachDayOfInterval 
} from "date-fns"

export default function Dashboard() {
  const { user } = useUser()
  const db = useFirestore()
  const [mounted, setMounted] = useState(false)
  const [today, setToday] = useState("")
  const [referenceDate, setReferenceDate] = useState<Date | null>(null)

  useEffect(() => {
    const now = new Date()
    setToday(now.toISOString().split('T')[0])
    setReferenceDate(now)
    setMounted(true)
  }, [])

  const round = (num: number) => Math.round(num * 100) / 100

  const loadsQuery = useMemoFirebase(() => {
    if (!db || !user || !mounted) return null
    return query(collection(db, "users", user.uid, "loads"), orderBy("endDate", "desc"))
  }, [db, user, mounted])
  const { data: rawLoads, isLoading: loadsLoading } = useCollection<Load>(loadsQuery)

  const expensesQuery = useMemoFirebase(() => {
    if (!db || !user || !mounted) return null
    return query(collection(db, "users", user.uid, "expenses"), orderBy("date", "desc"))
  }, [db, user, mounted])
  const { data: expenses, isLoading: expensesLoading } = useCollection<Expense>(expensesQuery)

  const settingsRef = useMemoFirebase(() => {
    if (!db || !user || !mounted) return null
    return doc(db, "users", user.uid, "settings", "prefs")
  }, [db, user, mounted])
  const { data: settings } = useDoc<AppSettings>(settingsRef)

  const loads = useMemo(() => {
    if (!rawLoads || !today) return []
    return rawLoads.map(load => {
      let derivedStatus = load.status
      if (load.startDate && load.endDate) {
        if (today > load.endDate) {
          derivedStatus = 'completed'
        } else if (today >= load.startDate) {
          derivedStatus = 'active'
        } else {
          derivedStatus = 'upcoming'
        }
      }
      return { ...load, status: derivedStatus }
    })
  }, [rawLoads, today])

  const stats = useMemo(() => {
    if (!mounted || !referenceDate || !today) {
      return { gross: 0, miles: 0, netPay: 0, activeLoads: 0, chartData: [], recentLoads: [] }
    }

    const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 })
    const weekEnd = endOfWeek(referenceDate, { weekStartsOn: 1 })

    const weekLoads = loads?.filter(l => {
      if (!l.endDate) return false
      const d = parseISO(l.endDate)
      return isWithinInterval(d, { start: weekStart, end: weekEnd })
    }) || []

    const weekExpensesList = expenses?.filter(e => {
      if (!e.date) return false
      const d = parseISO(e.date)
      return isWithinInterval(d, { start: weekStart, end: weekEnd })
    }) || []

    const gross = round(weekLoads.reduce((sum, l) => sum + (Number(l.rate) || 0), 0))
    const miles = weekLoads.reduce((sum, l) => sum + (Number(l.mileage) || 0), 0)
    
    const totalExp = round(weekExpensesList.reduce((sum, e) => {
      return sum + (Number(e.amount) || 0);
    }, 0))
    
    const totalCustomDeductions = round(settings?.customDeductions?.reduce((sum, d) => {
      let amount = 0;
      if (d.type === 'percentage') {
        amount = round(gross * (d.amount / 100));
      } else if (d.type === 'per_mile') {
        amount = round(miles * d.amount);
      } else {
        const rawAmount = Number(d.amount) || 0;
        if (d.frequency === 'monthly') {
          amount = round(rawAmount / 4.33);
        } else {
          amount = rawAmount;
        }
      }
      return sum + amount;
    }, 0) || 0)

    const brokerFeePercent = settings?.defaultBrokerFeePercent ?? 10
    const brokerFees = round(gross * (brokerFeePercent / 100))
    const taxableIncome = round(gross - brokerFees - totalExp - totalCustomDeductions)
    const taxRatePercent = settings?.defaultTaxRatePercent ?? 25
    const estimatedTaxes = taxableIncome > 0 ? round(taxableIncome * (taxRatePercent / 100)) : 0
    const netPay = round(taxableIncome - estimatedTaxes)

    const days = eachDayOfInterval({ start: weekStart, end: weekEnd })
    const chartData = days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd')
      const dayAmount = weekLoads
        .filter(l => l.endDate === dayStr)
        .reduce((sum, l) => sum + (Number(l.rate) || 0), 0)
      return {
        name: format(day, 'EEE'),
        amount: round(dayAmount)
      }
    })

    return {
      gross,
      miles,
      netPay,
      activeLoads: loads?.filter(l => l.status === 'active').length || 0,
      chartData,
      recentLoads: loads?.slice(0, 3) || []
    }
  }, [loads, expenses, settings, today, referenceDate, mounted])

  const isLoading = loadsLoading || expensesLoading || !mounted

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-background">
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border px-4 md:px-6 transition-[width,height] ease-linear">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <h1 className="text-lg md:text-xl font-bold font-headline truncate">Dashboard</h1>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <Button size="sm" variant="outline" asChild className="hidden sm:flex">
              <Link href="/settings">
                <Calendar className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </Button>
            <Button size="sm" className="bg-primary hover:bg-primary/90" asChild>
              <Link href="/loads">
                <Plus className="mr-1 md:mr-2 h-4 w-4" />
                New Load
              </Link>
            </Button>
          </div>
        </header>
        
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6 overflow-x-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center flex-1">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Gross (Week)</CardTitle>
                    <DollarSign className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl md:text-2xl font-bold">${stats.gross.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  </CardContent>
                </Card>
                
                <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Miles</CardTitle>
                    <Route className="h-4 w-4 text-accent" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl md:text-2xl font-bold">{stats.miles.toLocaleString()} mi</div>
                  </CardContent>
                </Card>

                <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Net Pay (Est.)</CardTitle>
                    <TrendingUp className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl md:text-2xl font-bold">${stats.netPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  </CardContent>
                </Card>

                <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active Loads</CardTitle>
                    <Package className="h-4 w-4 text-accent" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl md:text-2xl font-bold">{stats.activeLoads}</div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <Card className="border-border/50">
                  <CardHeader className="px-4 md:px-6">
                    <CardTitle className="text-lg">Weekly Revenue</CardTitle>
                    <CardDescription>Daily performance overview</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[250px] md:h-[350px] px-2 md:px-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 10}}
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 10}}
                          tickFormatter={(value) => `$${value}`}
                          width={40}
                        />
                        <Tooltip 
                          cursor={{fill: 'hsl(var(--muted)/0.2)'}}
                          contentStyle={{backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px'}}
                        />
                        <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                          {stats.chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.amount > 0 ? 'hsl(var(--accent))' : 'hsl(var(--primary))'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
