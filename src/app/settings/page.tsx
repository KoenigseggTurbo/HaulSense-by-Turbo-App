"use client"

import { useState, useEffect } from "react"
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
  User, 
  Calendar, 
  DollarSign, 
  Save, 
  Loader2,
  Truck,
  Plus,
  Trash2,
  Fuel,
  RefreshCw,
  Palette,
  Monitor,
  Moon,
  Sun,
  HandCoins,
  Clock
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useUser, useFirestore, useDoc, useMemoFirebase, setDocumentNonBlocking } from "@/firebase"
import { doc } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { CustomDeduction, AppSettings } from "@/lib/types"

const DAYS_OF_WEEK = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
]

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Phoenix", label: "Mountain Standard Time (No DST)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "America/Adak", label: "Hawaii-Aleutian Time (HAT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Standard Time (No DST)" },
  { value: "UTC", label: "Coordinated Universal Time (UTC)" }
]

function calculateFscFromPrice(price: number): number {
  if (price <= 1.892) return 0;
  let fsc = 0;
  if (price <= 5.388) {
    fsc = 0.08 + Math.floor((price - 1.893) / 0.076) * 0.01;
  } else {
    fsc = 0.54 + Math.floor((price - 5.389) / 0.076) * 0.01;
  }
  return Math.round(fsc * 100) / 100;
}

export default function SettingsPage() {
  const { user } = useUser()
  const db = useFirestore()
  const { toast } = useToast()

  // Form State
  const [displayName, setDisplayName] = useState("")
  const [truckId, setTruckId] = useState("")
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>("dark")
  const [payPeriodStartDay, setPayPeriodStartDay] = useState("monday")
  const [payPeriodStartTime, setPayPeriodStartTime] = useState("00:00")
  const [payPeriodTimeZone, setPayPeriodTimeZone] = useState("America/New_York")
  const [defaultTaxRatePercent, setDefaultTaxRatePercent] = useState<number>(25)
  const [defaultBrokerFeePercent, setDefaultBrokerFeePercent] = useState<number>(10)
  
  // Default Rate State
  const [useDefaultRate, setUseDefaultRate] = useState(false)
  const [defaultRateType, setDefaultRateType] = useState<'flat' | 'per_mile' | 'percentage'>("flat")
  const [defaultRateValue, setDefaultRateValue] = useState<number>(0)

  const [defaultFuelSurchargeType, setDefaultFuelSurchargeType] = useState<'none' | 'flat' | 'per_mile'>("none")
  const [defaultFuelSurchargeValue, setDefaultFuelSurchargeValue] = useState<number>(0)
  const [autoPerDiem, setAutoPerDiem] = useState(true)
  const [iftaCalculation, setIftaCalculation] = useState(true)
  const [customDeductions, setCustomDeductions] = useState<CustomDeduction[]>([])
  
  // EIA State
  const [eiaApiKey, setEiaApiKey] = useState("")
  const [currentFuelPrice, setCurrentFuelPrice] = useState<number>(0)
  const [isFetchingFuel, setIsFetchingFuel] = useState(false)

  // Fetch settings from Firestore
  const settingsRef = useMemoFirebase(() => {
    if (!db || !user) return null
    return doc(db, "users", user.uid, "settings", "prefs")
  }, [db, user])

  const { data: savedSettings, isLoading } = useDoc<AppSettings>(settingsRef)

  // Load saved settings into state
  useEffect(() => {
    if (savedSettings) {
      setDisplayName(savedSettings.displayName || "")
      setTruckId(savedSettings.truckId || "")
      setTheme(savedSettings.theme || "system")
      setPayPeriodStartDay(savedSettings.payPeriodStartDay || "monday")
      setPayPeriodStartTime(savedSettings.payPeriodStartTime || "00:00")
      setPayPeriodTimeZone(savedSettings.payPeriodTimeZone || "America/New_York")
      setDefaultTaxRatePercent(savedSettings.defaultTaxRatePercent ?? 25)
      setDefaultBrokerFeePercent(savedSettings.defaultBrokerFeePercent ?? 10)
      
      setUseDefaultRate(savedSettings.useDefaultRate ?? false)
      setDefaultRateType(savedSettings.defaultRateType || "flat")
      setDefaultRateValue(savedSettings.defaultRateValue ?? 0)

      setDefaultFuelSurchargeType(savedSettings.defaultFuelSurchargeType || "none")
      setDefaultFuelSurchargeValue(savedSettings.defaultFuelSurchargeValue ?? 0)
      setAutoPerDiem(savedSettings.autoPerDiem ?? true)
      setIftaCalculation(savedSettings.iftaCalculation ?? true)
      setCustomDeductions(savedSettings.customDeductions || [])
      setEiaApiKey(savedSettings.eiaApiKey || "")
      setCurrentFuelPrice(savedSettings.currentFuelPrice || 0)
    }
  }, [savedSettings])

  const fetchLatestFuelPrice = async () => {
    if (!eiaApiKey) {
      toast({
        title: "API Key Required",
        description: "Please enter your EIA API Key first.",
        variant: "destructive"
      })
      return
    }

    setIsFetchingFuel(true)
    try {
      const url = `https://api.eia.gov/v2/petroleum/pri/gnd/data/?api_key=${eiaApiKey}&frequency=weekly&data[0]=value&facets[series][]=EMD_EPD2D_PTE_NUS_DPG&sort[0][column]=period&sort[0][direction]=desc&offset=0&length=1`
      
      const response = await fetch(url)
      const json = await response.json()
      
      const latestData = json.response?.data?.[0]
      if (latestData && latestData.value) {
        const price = parseFloat(latestData.value)
        setCurrentFuelPrice(price)
        
        const calculatedFsc = calculateFscFromPrice(price)
        setDefaultFuelSurchargeValue(calculatedFsc)
        setDefaultFuelSurchargeType("per_mile")
        
        toast({
          title: "Fuel Price Updated",
          description: `Latest average: $${price.toFixed(3)}. FSC set to $${calculatedFsc.toFixed(2)}/mi.`
        })
      } else {
        throw new Error("No data returned from EIA")
      }
    } catch (error) {
      console.error(error)
      toast({
        title: "Fetch Failed",
        description: "Could not retrieve fuel price. Check your API key.",
        variant: "destructive"
      })
    } finally {
      setIsFetchingFuel(false)
    }
  }

  const handleAddDeduction = () => {
    const newD: CustomDeduction = {
      id: Math.random().toString(36).substring(7),
      name: "",
      amount: NaN,
      type: "flat",
      frequency: "pay_period"
    }
    setCustomDeductions([...customDeductions, newD])
  }

  const handleRemoveDeduction = (id: string) => {
    setCustomDeductions(customDeductions.filter(d => d.id !== id))
  }

  const handleUpdateDeduction = (id: string, field: keyof CustomDeduction, value: any) => {
    setCustomDeductions(customDeductions.map(d => 
      d.id === id ? { 
        ...d, 
        [field]: field === 'amount' 
          ? (value === "" ? NaN : parseFloat(value)) 
          : value 
      } : d
    ))
  }

  const handleSave = () => {
    if (!user || !settingsRef) {
      toast({
        title: "Session Error",
        description: "User session not found.",
        variant: "destructive"
      })
      return;
    }

    const payload: AppSettings = {
      id: "prefs",
      displayName,
      truckId,
      theme,
      payPeriodStartDay,
      payPeriodStartTime,
      payPeriodTimeZone,
      defaultTaxRatePercent: Number(defaultTaxRatePercent) || 0,
      defaultBrokerFeePercent: Number(defaultBrokerFeePercent) || 0,
      
      useDefaultRate,
      defaultRateType,
      defaultRateValue: Number(defaultRateValue) || 0,

      defaultFuelSurchargeType,
      defaultFuelSurchargeValue: Number(defaultFuelSurchargeValue) || 0,
      autoPerDiem,
      iftaCalculation,
      customDeductions: customDeductions.map(d => ({
        ...d,
        amount: Number(d.amount) || 0,
        frequency: d.frequency || 'pay_period'
      })),
      eiaApiKey,
      currentFuelPrice: Number(currentFuelPrice) || 0,
      updatedAt: new Date().toISOString()
    }

    setDocumentNonBlocking(settingsRef, payload, { merge: true })
    toast({
      title: "Settings Saved",
      description: "Your preferences have been updated."
    })
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-background text-foreground">
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border px-6 transition-[width,height] ease-linear">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <h1 className="text-xl font-bold font-headline">App Settings</h1>
          </div>
          <Button className="bg-primary hover:bg-primary/90" onClick={handleSave} disabled={isLoading}>
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </header>
        
        <main className="flex flex-1 flex-col gap-6 p-6 overflow-auto">
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground animate-pulse">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading your preferences...
            </div>
          )}

          <Tabs defaultValue="profile" className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
              <TabsList className="flex flex-col h-auto bg-transparent border-0 space-y-1 items-stretch">
                <TabsTrigger value="profile" className="justify-start gap-3 px-3 py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary h-10">
                  <User className="h-4 w-4" />
                  Profile Details
                </TabsTrigger>
                <TabsTrigger value="cycle" className="justify-start gap-3 px-3 py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary h-10">
                  <Calendar className="h-4 w-4" />
                  Pay Cycle Config
                </TabsTrigger>
                <TabsTrigger value="finance" className="justify-start gap-3 px-3 py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary h-10">
                  <DollarSign className="h-4 w-4" />
                  Tax & Deductions
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="md:col-span-2 space-y-6">
              <TabsContent value="profile" className="mt-0 space-y-6">
                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <User className="h-5 w-5 text-primary" />
                      Personal Profile
                    </CardTitle>
                    <CardDescription>Manage your public display name and equipment ID.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="displayName">Full Name</Label>
                        <Input 
                          id="displayName"
                          placeholder="e.g. John Driver" 
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          className="bg-card border-border" 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="truckId">Truck / Trailer ID</Label>
                        <div className="relative">
                          <Truck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input 
                            id="truckId"
                            placeholder="e.g. T-492" 
                            value={truckId}
                            onChange={(e) => setTruckId(e.target.value)}
                            className="bg-card border-border pl-10" 
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Palette className="h-5 w-5 text-primary" />
                      Visual Appearance
                    </CardTitle>
                    <CardDescription>Choose how HaulSense looks on your device.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <Label>Theme Preference</Label>
                      <div className="grid grid-cols-3 gap-3">
                        <Button 
                          variant={theme === 'light' ? 'default' : 'outline'} 
                          className="flex flex-col h-20 gap-2 font-bold"
                          onClick={() => setTheme('light')}
                        >
                          <Sun className="h-5 w-5" />
                          Light
                        </Button>
                        <Button 
                          variant={theme === 'dark' ? 'default' : 'outline'} 
                          className="flex flex-col h-20 gap-2 font-bold"
                          onClick={() => setTheme('dark')}
                        >
                          <Moon className="h-5 w-5" />
                          Dark
                        </Button>
                        <Button 
                          variant={theme === 'system' ? 'default' : 'outline'} 
                          className="flex flex-col h-20 gap-2 font-bold"
                          onClick={() => setTheme('system')}
                        >
                          <Monitor className="h-5 w-5" />
                          System
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="cycle" className="mt-0">
                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-primary" />
                      Pay Cycle Configuration
                    </CardTitle>
                    <CardDescription>Define how your pay periods are calculated and visualized.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label>Week Starts On</Label>
                        <Select value={payPeriodStartDay} onValueChange={setPayPeriodStartDay}>
                          <SelectTrigger className="bg-card border-border">
                            <SelectValue placeholder="Select day" />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border">
                            {DAYS_OF_WEEK.map(day => (
                              <SelectItem key={day.toLowerCase()} value={day.toLowerCase()}>{day}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          Cycle Start Time
                        </Label>
                        <Input 
                          type="time" 
                          value={payPeriodStartTime} 
                          onChange={(e) => setPayPeriodStartTime(e.target.value)}
                          className="bg-card border-border" 
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Reporting Timezone</Label>
                      <Select value={payPeriodTimeZone} onValueChange={setPayPeriodTimeZone}>
                        <SelectTrigger className="bg-card border-border">
                          <SelectValue placeholder="Select timezone" />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border max-h-[300px]">
                          {TIMEZONES.map(tz => (
                            <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-muted-foreground italic">
                        All load dates and expense timestamps will be normalized to this timezone for accurate weekly grouping.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="finance" className="mt-0 space-y-6">
                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-accent" />
                      Financial Defaults
                    </CardTitle>
                    <CardDescription>Setup automatic calculation parameters for revenue and deductions.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Estimated Tax Rate (%)</Label>
                        <Input 
                          type="number" 
                          value={isNaN(defaultTaxRatePercent) ? "" : defaultTaxRatePercent} 
                          onChange={e => setDefaultTaxRatePercent(e.target.value === "" ? NaN : parseFloat(e.target.value))}
                          className="bg-card border-border" 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Default Broker Fee (%)</Label>
                        <Input 
                          type="number" 
                          value={isNaN(defaultBrokerFeePercent) ? "" : defaultBrokerFeePercent} 
                          onChange={e => setDefaultBrokerFeePercent(e.target.value === "" ? NaN : parseFloat(e.target.value))}
                          className="bg-card border-border" 
                        />
                      </div>
                    </div>

                    <Separator className="bg-border" />

                    <div className="space-y-4 p-4 bg-muted/10 rounded-xl border border-border">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <HandCoins className="h-4 w-4 text-primary" />
                          <Label className="text-base font-bold">Standard Pay Scale</Label>
                        </div>
                        <Switch checked={useDefaultRate} onCheckedChange={setUseDefaultRate} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Automatically apply a fixed rate per mile or percentage to new loads. Disable if your rates vary per trip.
                      </p>
                      {useDefaultRate && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 animate-in fade-in slide-in-from-top-2">
                          <div className="space-y-2">
                            <Label className="text-xs">Rate Type</Label>
                            <Select value={defaultRateType} onValueChange={(val: any) => setDefaultRateType(val)}>
                              <SelectTrigger className="bg-card h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="flat">Flat ($)</SelectItem>
                                <SelectItem value="per_mile">Per Mile ($/mi)</SelectItem>
                                <SelectItem value="percentage">Percentage (%)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Value</Label>
                            <Input 
                              type="number" 
                              value={isNaN(defaultRateValue) ? "" : defaultRateValue} 
                              onChange={e => setDefaultRateValue(e.target.value === "" ? NaN : parseFloat(e.target.value))}
                              className="bg-card h-8 text-xs" 
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <Separator className="bg-border" />
                    
                    <div className="space-y-4 p-4 bg-primary/5 rounded-xl border border-primary/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <RefreshCw className={`h-4 w-4 text-primary ${isFetchingFuel ? 'animate-spin' : ''}`} />
                          <Label className="text-base font-bold text-primary">Dynamic Fuel Surcharge (EIA Sync)</Label>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-primary hover:bg-primary/10"
                          onClick={fetchLatestFuelPrice}
                          disabled={isFetchingFuel}
                        >
                          <RefreshCw className="mr-2 h-3.5 w-3.5" />
                          Sync Latest Price
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Automatically adjust your per-mile surcharge based on weekly national diesel averages from the US Energy Information Administration.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs">EIA API Key</Label>
                          <Input 
                            type="password"
                            placeholder="Enter EIA API Key"
                            className="bg-card h-8 text-xs"
                            value={eiaApiKey}
                            onChange={(e) => setEiaApiKey(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Current National Avg Diesel</Label>
                          <div className="flex items-center gap-2 h-8 px-3 bg-background border rounded-md text-xs font-bold">
                            <DollarSign className="h-3 w-3 text-muted-foreground" />
                            {currentFuelPrice > 0 ? currentFuelPrice.toFixed(3) : "---"}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Fuel className="h-4 w-4 text-accent" />
                        <Label className="text-base">Default Fuel Surcharge (FSC)</Label>
                      </div>
                      <p className="text-xs text-muted-foreground">These defaults will be automatically applied when capturing new loads.</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Default FSC Method</Label>
                          <Select 
                            value={defaultFuelSurchargeType} 
                            onValueChange={(val: any) => setDefaultFuelSurchargeType(val)}
                          >
                            <SelectTrigger className="bg-card border-border">
                              <SelectValue placeholder="None" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              <SelectItem value="flat">Flat FSC</SelectItem>
                              <SelectItem value="per_mile">Per Mile FSC</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Default FSC Value</Label>
                          <div className="relative">
                            {defaultFuelSurchargeType !== 'none' && <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}
                            <Input 
                              type="number" 
                              disabled={defaultFuelSurchargeType === 'none'}
                              placeholder="0.00"
                              className={`bg-card border-border ${defaultFuelSurchargeType !== 'none' ? 'pl-9' : ''}`}
                              value={isNaN(defaultFuelSurchargeValue) ? "" : defaultFuelSurchargeValue} 
                              onChange={e => setDefaultFuelSurchargeValue(e.target.value === "" ? NaN : parseFloat(e.target.value))} 
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <Separator className="bg-border" />
                    
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-base">Custom Recurring Deductions</Label>
                          <p className="text-sm text-muted-foreground">Fixed fees applied once per pay period (e.g. ELD, Insurance).</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleAddDeduction}>
                          <Plus className="h-4 w-4 mr-2" /> Add
                        </Button>
                      </div>
                      <div className="space-y-3">
                        {customDeductions.map((d) => (
                          <div key={d.id} className="flex gap-2 items-end bg-muted/20 p-3 rounded-lg border border-border">
                            <div className="grid grid-cols-4 gap-2 flex-1">
                              <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Name</Label>
                                <Input 
                                  value={d.name} 
                                  onChange={e => handleUpdateDeduction(d.id, 'name', e.target.value)}
                                  className="bg-card text-xs h-8"
                                  placeholder="Fee name"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Amount</Label>
                                <Input 
                                  type="number"
                                  value={isNaN(d.amount) ? "" : d.amount} 
                                  onChange={e => handleUpdateDeduction(d.id, 'amount', e.target.value)}
                                  className="bg-card text-xs h-8"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Type</Label>
                                <Select value={d.type} onValueChange={(val: any) => handleUpdateDeduction(d.id, 'type', val)}>
                                  <SelectTrigger className="bg-card text-xs h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="flat">Flat ($)</SelectItem>
                                    <SelectItem value="percentage">Percent (%)</SelectItem>
                                    <SelectItem value="per_mile">Per Mile ($/mi)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Frequency</Label>
                                <Select value={d.frequency || 'pay_period'} onValueChange={(val: any) => handleUpdateDeduction(d.id, 'frequency', val)}>
                                  <SelectTrigger className="bg-card text-xs h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="pay_period">Per Pay Period</SelectItem>
                                    <SelectItem value="monthly">Per Month</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleRemoveDeduction(d.id)}
                              className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        {customDeductions.length === 0 && (
                          <p className="text-xs text-muted-foreground italic text-center py-2">No custom deductions defined.</p>
                        )}
                      </div>
                    </div>

                    <Separator className="bg-border" />
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-base">Automatic Per-Diem Tracking</Label>
                        <p className="text-sm text-muted-foreground">Automatically suggest IRS per-diem rates based on load dates.</p>
                      </div>
                      <Switch checked={autoPerDiem} onCheckedChange={setAutoPerDiem} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-base">IFTA Calculation</Label>
                        <p className="text-sm text-muted-foreground">Estimated IFTA deductions based on state mileage logs.</p>
                      </div>
                      <Switch checked={iftaCalculation} onCheckedChange={setIftaCalculation} />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
