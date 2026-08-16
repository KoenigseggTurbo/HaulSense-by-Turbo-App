
"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { cn } from "@/lib/utils"
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card"
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight,
  TrendingUp,
  Loader2,
  Route,
  ReceiptText,
  ArrowRight,
  Calculator,
  Sparkles,
  Percent,
  Fuel,
  HandCoins,
  Download,
  FileText,
  Truck,
  User,
  Scale,
  DollarSign,
  TrendingDown,
  Info
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { useCollection, useFirestore, useUser, useMemoFirebase, useDoc } from "@/firebase"
import { collection, query, orderBy, doc } from "firebase/firestore"
import { Load, Expense, AppSettings } from "@/lib/types"
import { 
  startOfWeek, 
  endOfWeek, 
  isWithinInterval, 
  parseISO, 
  format, 
  addWeeks, 
  subWeeks 
} from "date-fns"
import { useToast } from "@/hooks/use-toast"

import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog"

const DAY_MAP: Record<string, 0 | 1 | 2 | 3 | 4 | 5 | 6> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6
}

export default function ReportsPage() {
  const { user } = useUser()
  const db = useFirestore()
  const { toast } = useToast()
  const [mounted, setMounted] = useState(false)
  const [currentWeekStart, setCurrentWeekStart] = useState<Date | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isStatementOpen, setIsStatementOpen] = useState(false)
  const reportTemplateRef = useRef<HTMLDivElement>(null)

  const settingsRef = useMemoFirebase(() => {
    if (!db || !user) return null
    return doc(db, "users", user.uid, "settings", "prefs")
  }, [db, user])
  const { data: settings } = useDoc<AppSettings>(settingsRef)

  useEffect(() => {
    const now = new Date()
    const weekStartsOn = DAY_MAP[settings?.payPeriodStartDay || 'monday'] || 1
    setCurrentWeekStart(startOfWeek(now, { weekStartsOn }))
    setMounted(true)
  }, [settings?.payPeriodStartDay])

  const loadsQuery = useMemoFirebase(() => {
    if (!db || !user || !mounted) return null
    return query(collection(db, "users", user.uid, "loads"), orderBy("endDate", "desc"))
  }, [db, user, mounted])
  const { data: loads, isLoading: loadsLoading } = useCollection<Load>(loadsQuery)

  const expensesQuery = useMemoFirebase(() => {
    if (!db || !user || !mounted) return null
    return query(collection(db, "users", user.uid, "expenses"), orderBy("date", "desc"))
  }, [db, user, mounted])
  const { data: expenses, isLoading: expensesLoading } = useCollection<Expense>(expensesQuery)

  const periodEnd = useMemo(() => {
    if (!currentWeekStart || !settings) return null
    const weekStartsOn = DAY_MAP[settings.payPeriodStartDay || 'monday'] || 1
    return endOfWeek(currentWeekStart, { weekStartsOn })
  }, [currentWeekStart, settings])

  const periodLabel = useMemo(() => {
    if (!currentWeekStart || !periodEnd) return ""
    return `${format(currentWeekStart, "MMM d")} - ${format(periodEnd, "MMM d, yyyy")}`
  }, [currentWeekStart, periodEnd])

  const round = (num: number) => Math.round(num * 100) / 100

  const periodData = useMemo(() => {
    if (!currentWeekStart || !periodEnd || !mounted || !loads || !expenses) return null

    // 1. Filter raw loads by current period interval
    const periodLoads = loads.filter(l => {
      if (!l.endDate) return false
      const d = parseISO(l.endDate)
      return isWithinInterval(d, { start: currentWeekStart, end: periodEnd })
    })

    // 2. Identify all expenses associated with these loads OR dated in this range if unassigned
    const periodLoadIds = new Set(periodLoads.map(l => l.id))
    const periodExpenses = expenses.filter(e => {
      // Rule: Expense is part of period if assigned to a period load OR unassigned but dated in period
      const isAssignedToPeriodLoad = e.loadId && periodLoadIds.has(e.loadId)
      let isDatedInPeriod = false
      if (e.date) {
        const d = parseISO(e.date)
        isDatedInPeriod = isWithinInterval(d, { start: currentWeekStart, end: periodEnd })
      }
      return isAssignedToPeriodLoad || (!e.loadId && isDatedInPeriod)
    })

    // 3. Aggregate Load Data
    let totalBaseRevenue = 0
    let totalFscRevenue = 0
    let totalMileage = 0
    let totalTripSavings = 0

    const enrichedLoads = periodLoads.map(l => {
      const fsc = Number(l.fuelSurcharge) || 0
      const gross = Number(l.rate) || 0
      const base = round(gross - fsc)
      const miles = Number(l.mileage) || 0
      
      const tripExpensesList = periodExpenses.filter(e => e.loadId === l.id)
      const tripExpenses = tripExpensesList.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
      const tripSavings = tripExpensesList.reduce((sum, e) => sum + (e.dieselSavings || 0) + (e.reeferSavings || 0), 0)
      
      totalBaseRevenue += base
      totalFscRevenue += fsc
      totalMileage += miles
      totalTripSavings += tripSavings
      
      return { 
        ...l, 
        baseRateCalculated: base, 
        fscCalculated: fsc,
        tripExpenses: round(tripExpenses),
        tripSavings: round(tripSavings),
        tripNet: round(gross - tripExpenses)
      }
    })

    const grossRevenue = round(totalBaseRevenue + totalFscRevenue)

    // 4. Aggregate Operating Costs (receipts in this period)
    const categories: Record<string, { total: number }> = {
      "Fuel": { total: 0 }, "Maintenance": { total: 0 }, "Tolls": { total: 0 },
      "Food": { total: 0 }, "Insurance": { total: 0 }, "Cash Advance": { total: 0 }, "Other": { total: 0 },
    }

    let totalOperatingExpenses = 0
    periodExpenses.forEach(e => {
      const amount = Number(e.amount) || 0
      totalOperatingExpenses += amount
      
      const catInput = (e.category || "Other").trim().toLowerCase()
      const matchingKey = Object.keys(categories).find(k => k.toLowerCase() === catInput)
      if (matchingKey) {
        categories[matchingKey].total = round(categories[matchingKey].total + amount)
      } else {
        categories["Other"].total = round(categories["Other"].total + amount)
      }
    })

    // 5. Fixed Deductions & Broker Fees
    const brokerFeePercent = settings?.defaultBrokerFeePercent ?? 10
    const brokerFeesAmount = round(grossRevenue * (brokerFeePercent / 100))
    
    const fixedCostBreakdown: Array<{ name: string; amount: number }> = []
    if (brokerFeesAmount > 0) {
      fixedCostBreakdown.push({ name: `Broker Fees (${brokerFeePercent}%)`, amount: brokerFeesAmount })
    }

    const totalCustomDeductions = round(settings?.customDeductions?.reduce((sum, d) => {
      let amount = 0;
      if (d.type === 'percentage') amount = round(grossRevenue * (d.amount / 100));
      else if (d.type === 'per_mile') amount = round(totalMileage * d.amount);
      else {
        const rawAmount = Number(d.amount) || 0;
        if (d.frequency === 'monthly') {
          amount = round(rawAmount / 4.33);
        } else {
          amount = rawAmount;
        }
      }
      
      if (amount > 0) {
        fixedCostBreakdown.push({ 
          name: d.frequency === 'monthly' ? `${d.name || "Deduction"} (Monthly / 4.33)` : (d.name || "Deduction"), 
          amount: amount 
        })
      }
      return sum + amount;
    }, 0) || 0)

    const totalFixedCosts = round(brokerFeesAmount + totalCustomDeductions)
    const totalCosts = round(totalOperatingExpenses + totalFixedCosts)
    
    // 6. Yield & Payout Calculations
    const taxableIncome = round(grossRevenue - totalCosts)
    const taxRatePercent = settings?.defaultTaxRatePercent ?? 25
    const estimatedTaxes = taxableIncome > 0 ? round(taxableIncome * (taxRatePercent / 100)) : 0
    const netPay = round(taxableIncome - estimatedTaxes)

    let totalLandstarCut = 0
    let totalLandstarGross = 0
    let totalBcoShareFromLoads = 0

    periodLoads.forEach(l => {
      if (l.isLandstar || l.landstarCut !== undefined) {
        totalLandstarCut += Number(l.landstarCut) || 0
        totalLandstarGross += Number(l.landstarGross) || Number(l.rate) || 0
        totalBcoShareFromLoads += Number(l.landstarBcoShare) || Number(l.rate) || 0
      }
    })

    return {
      periodExpenses,
      enrichedLoads,
      grossRevenue,
      totalBaseRevenue: round(totalBaseRevenue),
      totalFscRevenue: round(totalFscRevenue),
      totalOperatingExpenses: round(totalOperatingExpenses),
      totalFixedCosts,
      totalCosts,
      totalMileage,
      taxableIncome,
      netPay,
      estimatedTaxes,
      totalFuelSavings: round(totalTripSavings),
      totalFuelCost: categories["Fuel"].total,
      revenuePerMile: totalMileage > 0 ? grossRevenue / totalMileage : 0,
      totalCPM: totalMileage > 0 ? totalCosts / totalMileage : 0,
      netCPM: totalMileage > 0 ? taxableIncome / totalMileage : 0,
      fixedCPM: totalMileage > 0 ? totalFixedCosts / totalMileage : 0,
      fuelCPM: totalMileage > 0 ? categories["Fuel"].total / totalMileage : 0,
      categories,
      fixedCostBreakdown,
      profitMarginPercentage: grossRevenue > 0 ? (netPay / grossRevenue) * 100 : 0,
      totalLandstarCut: round(totalLandstarCut),
      totalLandstarGross: round(totalLandstarGross)
    }
  }, [loads, expenses, currentWeekStart, periodEnd, settings, mounted])

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeekStart(prev => direction === 'prev' ? subWeeks(prev!, 1) : addWeeks(prev!, 1))
  }

  const handleDownloadPDF = () => {
    setIsStatementOpen(true)
  }

  const handlePrint = () => {
    window.print()
  }

  const isLoading = !mounted || loadsLoading || expensesLoading || !periodData

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-background">
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border px-4 md:px-6 transition-[width,height] ease-linear">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <h1 className="text-lg md:text-xl font-bold font-headline truncate text-primary uppercase tracking-tighter">HaulSense Reports</h1>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="font-black uppercase text-[10px] tracking-widest gap-2 bg-primary/5 border-primary/20 text-primary h-9 px-4 shadow-sm"
            onClick={handleDownloadPDF}
            disabled={isLoading || isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Processing Statement...
              </>
            ) : (
              <>
                <Download className="h-3 w-3" />
                Download Statement
              </>
            )}
          </Button>
        </header>
        <main className="flex flex-1 flex-col gap-6 p-4 md:p-6 overflow-x-hidden">
          <div className="flex gap-3 items-center justify-center bg-card/40 backdrop-blur-sm p-4 rounded-2xl border border-border/50 shadow-sm max-w-xl mx-auto w-full">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-muted/50" onClick={() => navigateWeek('prev')}><ChevronLeft className="h-5 w-5" /></Button>
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="text-xs font-black uppercase tracking-widest text-slate-800">{periodLabel}</span>
              </div>
              {periodData && (
                <Badge variant="outline" className="mt-1.5 text-[9px] font-black uppercase tracking-widest border-accent/30 text-accent bg-accent/5 px-2">
                  Retention Margin: {periodData.profitMarginPercentage.toFixed(1)}%
                </Badge>
              )}
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-muted/50" onClick={() => navigateWeek('next')}><ChevronRight className="h-5 w-5" /></Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center p-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full max-w-7xl mx-auto">
              {/* Left Column: Settlement Data */}
              <div className="space-y-6">
                <Card className="rounded-2xl overflow-hidden border-border/50 shadow-lg bg-card/40 backdrop-blur-sm border-primary/20">
                  <CardHeader className="bg-primary/5 border-b border-primary/10 p-5">
                    <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-primary">
                      <Truck className="h-4 w-4" /> 
                      Landstar Settlement & Guarantee Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-background/60 rounded-2xl border border-border/40">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">Landstar's Cut (Pay Period)</span>
                        <span className="text-xl font-black text-destructive font-headline">${periodData.totalLandstarCut.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="p-4 bg-background/60 rounded-2xl border border-border/40">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">Landstar Gross Total</span>
                        <span className="text-xl font-black text-primary font-headline">${periodData.totalLandstarGross.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>


                  </CardContent>
                </Card>

                <Card className="rounded-2xl overflow-hidden border-border/50 shadow-lg bg-card/40 backdrop-blur-sm">
                  <CardHeader className="bg-muted/30 border-b border-border/50 p-5">
                    <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-primary">
                      <ReceiptText className="h-4 w-4" /> 
                      Trip Earnings Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4">
                    {periodData.enrichedLoads.length > 0 ? (
                      periodData.enrichedLoads.map(load => (
                        <div key={load.id} className="p-4 bg-background/50 rounded-2xl border border-border/30 hover:border-primary/30 transition-all group">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 text-sm font-black uppercase text-slate-900 truncate">
                                <span>{load.origin.split(',')[0]}</span>
                                <ArrowRight className="h-3 w-3 text-muted-foreground opacity-50" />
                                <span>{load.destination.split(',')[0]}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground font-bold uppercase tracking-tight">
                                <Route className="h-3 w-3 opacity-60" />
                                <span>{load.mileage} mi</span>
                                <Badge variant="outline" className="h-4 px-1.5 text-[8px] font-black tracking-widest bg-background border-border/50">TRIP #{load.loadNumber || load.id.substring(0,4).toUpperCase()}</Badge>
                              </div>
                            </div>
                            <div className="text-right flex flex-col items-end">
                              {load.landstarGross && load.landstarGross > load.rate ? (
                                <span className="text-[9px] font-bold text-muted-foreground">Total Gross: ${load.landstarGross.toLocaleString()}</span>
                              ) : null}
                              <span className="text-lg font-black text-primary font-headline tracking-tighter leading-none">${load.rate.toLocaleString()}</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px] pt-3 border-t border-border/20">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground uppercase font-black text-[9px] tracking-tighter opacity-70">Base Rate:</span>
                              <span className="font-bold text-slate-700">${load.baseRateCalculated.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground uppercase font-black text-[9px] tracking-tighter opacity-70">FSC Revenue:</span>
                              <span className="font-bold text-accent">${load.fscCalculated.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground uppercase font-black text-[9px] tracking-tighter opacity-70">Trip Costs:</span>
                              <span className="font-bold text-destructive">-${load.tripExpenses.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between bg-accent/10 px-2 py-0.5 rounded-lg border border-accent/10">
                              <span className="text-accent uppercase font-black text-[9px] tracking-tighter">Net Yield (After Exp):</span>
                              <span className="font-bold text-accent">${load.tripNet.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-16 text-muted-foreground font-bold italic text-sm bg-muted/10 rounded-2xl border border-dashed border-border/50">No trip records detected for this cycle.</div>
                    )}
                    
                    <Separator className="bg-border/30 my-6" />
                    
                    <div className="pt-2 space-y-3">
                      <div className="flex justify-between text-[11px] font-black uppercase text-slate-500 tracking-widest">
                        <span>Cycle Gross Total</span>
                        <span className="text-slate-900 font-bold">${periodData.grossRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-[11px] font-black uppercase text-slate-500 tracking-widest">
                        <span>Operating Costs (Receipts)</span>
                        <span className="text-destructive font-bold">-${periodData.totalOperatingExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-[11px] font-black uppercase text-slate-500 tracking-widest">
                        <span>Fixed Deductions (Fees)</span>
                        <span className="text-destructive font-bold">-${periodData.totalFixedCosts.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <Separator className="bg-border/20 my-2" />
                      <div className="flex justify-between items-center bg-muted/30 p-2 rounded-lg border border-border/30">
                        <div className="flex items-center gap-2">
                          <Scale className="h-3.5 w-3.5 text-primary" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-primary">Adjusted Taxable Income</span>
                        </div>
                        <span className="text-sm font-black text-slate-900 font-headline">${periodData.taxableIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-[11px] font-black uppercase text-slate-500 tracking-widest px-2">
                        <span className="flex items-center gap-1 opacity-70"><Percent className="h-3 w-3" /> Est. Tax ({settings?.defaultTaxRatePercent ?? 25}%)</span>
                        <span className="text-destructive font-bold">-${periodData.estimatedTaxes.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      
                      <div className="flex justify-between items-end pt-6 mt-4 border-t-2 border-slate-900">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] leading-none mb-1.5">Net Settlement Payout</span>
                          <span className="text-4xl font-black text-primary font-headline tracking-tighter leading-none">${periodData.netPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-black uppercase text-accent tracking-[0.2em] block mb-1.5">Net Margin</span>
                          <Badge className="bg-accent text-white font-black uppercase text-xs tracking-widest rounded-xl px-4 py-1 border-0">
                            {periodData.profitMarginPercentage.toFixed(1)}%
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Efficiency Metrics */}
              <div className="space-y-6">
                <Card className="rounded-2xl overflow-hidden border-border/50 shadow-lg bg-card/40 backdrop-blur-sm">
                  <CardHeader className="bg-muted/30 border-b border-border/50 p-5">
                    <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-accent">
                      <TrendingUp className="h-4 w-4" /> 
                      Performance Efficiency
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                      <div className="flex justify-between items-center p-4 bg-accent/5 rounded-2xl border border-accent/20 shadow-sm">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-accent" />
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Net Yield / Mi (Net CPM)</span>
                            <span className="text-[8px] font-bold text-muted-foreground uppercase">Actual profit per driven mile</span>
                          </div>
                        </div>
                        <span className="font-black text-accent text-xl font-headline">${periodData.netCPM.toFixed(2)}</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-destructive/5 rounded-2xl border border-destructive/10">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <Fuel className="h-3.5 w-3.5 text-destructive/40" />
                            <span className="text-[9px] font-black uppercase text-destructive/60 tracking-widest">Fuel CPM</span>
                          </div>
                          <span className="text-xl font-black text-destructive font-headline tracking-tighter">${periodData.fuelCPM.toFixed(2)}</span>
                        </div>
                        <div className="p-4 bg-destructive/5 rounded-2xl border border-destructive/10">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <HandCoins className="h-3.5 w-3.5 text-destructive/40" />
                            <span className="text-[9px] font-black uppercase text-destructive/60 tracking-widest">Fixed CPM</span>
                          </div>
                          <span className="text-xl font-black text-destructive font-headline tracking-tighter">${periodData.fixedCPM.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="p-4 bg-primary/5 rounded-2xl border border-primary/20">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-primary/70">Total Cycle Mileage</span>
                          <span className="text-sm font-black text-primary">{periodData.totalMileage.toLocaleString()} mi</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black uppercase tracking-widest text-primary/70">Gross Rev / Mi</span>
                          <span className="text-sm font-black text-primary">${periodData.revenuePerMile.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl overflow-hidden border-border/50 bg-accent/5 border-accent/20 shadow-lg">
                  <CardHeader className="bg-accent/10 border-b border-accent/20 p-5">
                    <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-accent">
                      <Fuel className="h-4 w-4" /> 
                      Fuel Spending & Savings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 text-center">
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-accent/70 block mb-2 leading-none">Category Total</span>
                      <span className="text-4xl font-black text-accent font-headline tracking-tighter">${periodData.totalFuelCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      <Badge variant="outline" className="mt-3 text-[9px] font-black uppercase tracking-widest border-accent/30 text-accent bg-background">
                        Discount Savings: +${periodData.totalFuelSavings.toFixed(2)}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl overflow-hidden border-border/50 shadow-lg bg-card/40 backdrop-blur-sm">
                  <CardHeader className="bg-muted/30 border-b border-border/50 p-5">
                    <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-slate-800">
                      <ReceiptText className="h-4 w-4 text-destructive" /> 
                      Operating Cost Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 space-y-3">
                    {Object.entries(periodData.categories).map(([catName, data]) => (
                      <div key={catName} className="flex justify-between items-center py-2 border-b border-border/20 last:border-0">
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{catName}</span>
                        <span className="text-xs font-black text-destructive">${data.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    ))}
                    <div className="pt-3 flex justify-between items-center font-black uppercase text-slate-400 text-[10px] tracking-widest">
                      <span>Total Operating Costs</span>
                      <span className="text-destructive font-headline">${periodData.totalOperatingExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl overflow-hidden border-border/50 shadow-lg bg-card/40 backdrop-blur-sm">
                  <CardHeader className="bg-muted/30 border-b border-border/50 p-5">
                    <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-slate-800">
                      <Calculator className="h-4 w-4 text-primary" /> 
                      Fixed Deduction Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 space-y-3">
                    {periodData.fixedCostBreakdown.length > 0 ? (
                      periodData.fixedCostBreakdown.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center py-2 border-b border-border/20 last:border-0">
                          <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{item.name}</span>
                          <span className="text-xs font-black text-destructive">-${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 text-muted-foreground text-[10px] font-bold italic uppercase tracking-widest bg-muted/5 rounded-xl border border-dashed border-border/30">No fixed costs identified.</div>
                    )}
                    <div className="pt-3 flex justify-between items-center font-black uppercase text-slate-400 text-[10px] tracking-widest">
                      <span>Cycle Fixed Total</span>
                      <span className="text-slate-900 font-headline">${periodData.totalFixedCosts.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          <Dialog open={isStatementOpen} onOpenChange={setIsStatementOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-950 text-white border-border">
          <DialogHeader className="flex flex-row items-center justify-between pb-4 border-b border-border">
            <div>
              <DialogTitle className="text-xl font-bold uppercase tracking-wider text-white">Professional Settlement Statement</DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Official statement generated from your reports tab data with custom branding.
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={handlePrint} className="bg-primary hover:bg-primary/90 text-white font-black uppercase text-[10px] tracking-widest gap-2">
                <Download className="h-3.5 w-3.5" />
                Print / Save PDF
              </Button>
            </div>
          </DialogHeader>

          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              body * {
                visibility: hidden;
              }
              #statement-print-container, #statement-print-container * {
                visibility: visible;
              }
              #statement-print-container {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                margin: 0;
                padding: 16px;
                background: white !important;
                color: #0f172a !important;
              }
            }
          `}} />

          {/* Professional Printable Document Container */}
          {periodData && (
            <div 
              id="statement-print-container"
              className="p-8 md:p-12 bg-white text-slate-900 font-sans rounded-2xl shadow-2xl my-4 space-y-8"
            >
              {/* Top Header with Logo */}
              <div className="flex justify-between items-start border-b-4 border-slate-900 pb-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-12 w-12 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center border border-slate-200">
                      <img src="/logo.png" alt="Logo" className="h-10 w-10 object-contain" />
                    </div>
                    <div>
                      <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-slate-900 leading-none">Settlement Statement</h1>
                      <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 mt-1">HaulSense Contractor Financial Portal</p>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 bg-slate-100 text-slate-700 rounded-full border border-slate-200">
                    Period: {periodLabel}
                  </span>
                  <p className="text-[9px] font-bold text-slate-400 mt-2 uppercase">Statement Date: {format(new Date(), "MMMM d, yyyy")}</p>
                </div>
              </div>

              {/* Contractor & Equipment Info Grid */}
              <div className="grid grid-cols-2 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-200">
                <div className="space-y-3">
                  <div>
                    <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-0.5">Independent Contractor</p>
                    <p className="text-sm font-black text-slate-900">{settings?.displayName || "Driver Name"}</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-0.5">Equipment / Truck ID</p>
                    <p className="text-sm font-black text-slate-900">{settings?.truckId || "N/A"}</p>
                  </div>
                </div>
                <div className="text-right space-y-3">
                  <div>
                    <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-0.5">Pay Cycle Frequency</p>
                    <p className="text-sm font-black text-slate-900 capitalize">{settings?.payPeriodStartDay || "Monday"} Start</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-0.5">Total Cycle Mileage</p>
                    <p className="text-sm font-black text-slate-900">{periodData.totalMileage.toLocaleString()} mi</p>
                  </div>
                </div>
              </div>

              {/* Financial Summary & Payout Banner */}
              <div className="bg-slate-900 text-white p-6 md:p-8 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-1">Net Settlement Payout</p>
                  <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-white font-headline">
                    ${periodData.netPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </h2>
                </div>
                <div className="flex gap-6 border-t md:border-t-0 md:border-l border-slate-700 pt-4 md:pt-0 md:pl-6 w-full md:w-auto justify-between md:justify-start">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Gross Revenue</p>
                    <p className="text-xl font-bold text-white">${periodData.grossRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="text-right md:text-left">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Net Margin</p>
                    <p className="text-xl font-bold text-emerald-400">{periodData.profitMarginPercentage.toFixed(1)}%</p>
                  </div>
                </div>
              </div>

              {/* Trip Earnings Breakdown Table */}
              <div>
                <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-3 text-slate-900 border-l-4 border-slate-900 pl-3">Trip Earnings Breakdown</h3>
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 border-y border-slate-200 text-slate-600 uppercase font-black text-[9px]">
                    <tr>
                      <th className="py-2.5 px-3 text-left">Date</th>
                      <th className="py-2.5 px-3 text-left">Origin → Destination</th>
                      <th className="py-2.5 px-3 text-left">Trip ID</th>
                      <th className="py-2.5 px-3 text-right">Mileage</th>
                      <th className="py-2.5 px-3 text-right">Gross Pay</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {periodData.enrichedLoads.length > 0 ? (
                      periodData.enrichedLoads.map(load => (
                        <tr key={load.id}>
                          <td className="py-3 px-3 font-bold text-slate-500">{load.endDate}</td>
                          <td className="py-3 px-3 font-black text-slate-900">{load.origin.split(',')[0]} → {load.destination.split(',')[0]}</td>
                          <td className="py-3 px-3 font-bold text-slate-500 uppercase">#{load.loadNumber || load.id.substring(0,4).toUpperCase()}</td>
                          <td className="py-3 px-3 text-right font-bold text-slate-700">{load.mileage} mi</td>
                          <td className="py-3 px-3 text-right font-black text-slate-900">${load.rate.toLocaleString()}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-400 italic">No trips recorded for this cycle.</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="bg-slate-50 font-black">
                    <tr>
                      <td colSpan={4} className="py-3 px-3 text-right uppercase text-[9px] text-slate-500 tracking-widest">Cycle Gross Revenue:</td>
                      <td className="py-3 px-3 text-right text-sm text-slate-900">${periodData.grossRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Ledger & Expenses Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Operating & Fixed Ledger */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-600 border-b border-slate-200 pb-2">Operating Ledger & Deductions</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-600 uppercase text-[10px]">Operating Costs (Receipts)</span>
                      <span className="font-black text-rose-600">-${periodData.totalOperatingExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    {Object.entries(periodData.categories).map(([cat, d]) => d.total > 0 && (
                      <div key={cat} className="flex justify-between items-center pl-3 text-[10px] text-slate-500">
                        <span>• {cat}</span>
                        <span>-${d.total.toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                      <span className="font-bold text-slate-600 uppercase text-[10px]">Fixed Deductions (Fees)</span>
                      <span className="font-black text-rose-600">-${periodData.totalFixedCosts.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    {periodData.fixedCostBreakdown.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center pl-3 text-[10px] text-slate-500">
                        <span>• {item.name}</span>
                        <span>-${item.amount.toLocaleString()}</span>
                      </div>
                    ))}
                    <Separator className="bg-slate-200 my-2" />
                    <div className="flex justify-between font-black text-slate-900 text-xs">
                      <span className="uppercase text-[10px] tracking-widest">Adjusted Taxable Income:</span>
                      <span>${periodData.taxableIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-[11px] items-center">
                      <span className="font-bold text-slate-500 uppercase text-[10px]">Est. Tax Liability ({settings?.defaultTaxRatePercent ?? 25}%)</span>
                      <span className="font-black text-rose-600">-${periodData.estimatedTaxes.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>

                {/* Efficiency & Performance */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-600 border-b border-slate-200 pb-2">Performance Efficiency Metrics</h4>
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-600 uppercase text-[10px]">Net Yield / Mi (Net CPM)</span>
                      <span className="font-black text-emerald-600 text-base">${periodData.netCPM.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-600 uppercase text-[10px]">Gross Revenue / Mi</span>
                      <span className="font-black text-slate-900">${periodData.revenuePerMile.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-600 uppercase text-[10px]">Fuel Cost / Mi (Fuel CPM)</span>
                      <span className="font-black text-rose-600">-${periodData.fuelCPM.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-600 uppercase text-[10px]">Fixed Cost / Mi (Fixed CPM)</span>
                      <span className="font-black text-rose-600">-${periodData.fixedCPM.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                      <span className="font-bold text-slate-600 uppercase text-[10px]">Total Fuel Savings</span>
                      <span className="font-black text-emerald-600">+${periodData.totalFuelSavings.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sign-off & Footer */}
              <div className="pt-8 border-t-2 border-slate-200 grid grid-cols-2 gap-8 text-[10px]">
                <div>
                  <p className="font-black uppercase tracking-widest text-slate-400 mb-8">Authorized Carrier Signature</p>
                  <div className="border-b border-slate-300 pb-1"></div>
                </div>
                <div>
                  <p className="font-black uppercase tracking-widest text-slate-400 mb-8">Contractor Acceptance Signature</p>
                  <div className="border-b border-slate-300 pb-1"></div>
                </div>
              </div>

              <div className="text-center pt-4">
                <p className="text-[8px] font-black uppercase tracking-[0.4em] text-slate-400">Statement Generated via HaulSense Contractor Portal | Official Professional Documentation</p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStatementOpen(false)} className="text-xs">
              Close Preview
            </Button>
            <Button onClick={handlePrint} className="bg-primary hover:bg-primary/90 text-xs gap-2 font-bold">
              <Download className="h-3.5 w-3.5" />
              Print / Save PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
