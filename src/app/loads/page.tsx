
"use client"

import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { cn } from "@/lib/utils"
import { 
  Card, 
  CardContent, 
  CardDescription,
  CardHeader, 
  CardTitle 
} from "@/components/ui/card"
import { 
  Plus, 
  Search, 
  MapPin, 
  MoreVertical, 
  Truck, 
  Loader2, 
  Trash2, 
  Edit, 
  DollarSign, 
  ChevronRight, 
  ChevronLeft, 
  MapPinned, 
  BadgeDollarSign, 
  Package, 
  Receipt, 
  TrendingUp, 
  TrendingDown, 
  CalendarDays, 
  Sparkles, 
  Zap, 
  Camera, 
  Upload, 
  X, 
  ChevronDown, 
  Fuel,
  Percent,
  Clock,
  Calculator,
  Scale
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useCollection, useFirestore, useUser, useMemoFirebase, useDoc, setDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase"
import { collection, doc } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { Load, Stop, AppSettings, Expense } from "@/lib/types"
import { startOfWeek, endOfWeek, isWithinInterval, parseISO, format } from "date-fns"
import { extractLoadDetails } from "@/ai/flows/smart-load-data-extraction-flow"

const INITIAL_FORM_DATA: Partial<Load> = {
  loadNumber: "",
  origin: "",
  destination: "",
  rate: 0,
  rateType: "per_mile",
  rateValue: 0,
  percentageBase: 0,
  fuelSurchargeType: "none",
  fuelSurchargeValue: 0,
  fuelSurcharge: 0,
  mileage: 0,
  startDate: "",
  endDate: "",
  status: "upcoming",
  stops: []
}

const DAY_MAP: Record<string, 0 | 1 | 2 | 3 | 4 | 5 | 6> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6
}

function getEstDateString() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

export default function LoadsPage() {
  const { user } = useUser()
  const db = useFirestore()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isLandstarDialogOpen, setIsLandstarDialogOpen] = useState(false)
  const [editingLoad, setEditingLoad] = useState<Load | null>(null)
  const [today, setToday] = useState("")
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0)
  
  // Expense detail states
  const [viewingExpense, setViewingExpense] = useState<Expense | null>(null)
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false)

  const [isExtracting, setIsExtracting] = useState(false)
  const [extractText, setExtractText] = useState("")
  const [extractImage, setExtractImage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  // Landstar Calculator State
  const [landstarProNumber, setLandstarProNumber] = useState("")
  const [landstarOrigin, setLandstarOrigin] = useState("")
  const [landstarDestination, setLandstarDestination] = useState("")
  const [landstarPickupDate, setLandstarPickupDate] = useState("")
  const [landstarPickupTime, setLandstarPickupTime] = useState("08:00")
  const [landstarDeliveryDate, setLandstarDeliveryDate] = useState("")
  const [landstarDeliveryTime, setLandstarDeliveryTime] = useState("17:00")
  const [landstarDeadheadMiles, setLandstarDeadheadMiles] = useState("")
  const [landstarDispatchedMiles, setLandstarDispatchedMiles] = useState("")
  const landstarTotalMiles = (parseFloat(landstarDeadheadMiles) || 0) + (parseFloat(landstarDispatchedMiles) || 0)

  const [landstarTrailerType, setLandstarTrailerType] = useState("landstar_van") // bco_van, landstar_van, flatbed, specialized, reefer, expedited, custom
  const [landstarCustomPercent, setLandstarCustomPercent] = useState("72")
  const [landstarLinehaul, setLandstarLinehaul] = useState("")
  
  // Stops state
  const [landstarStops, setLandstarStops] = useState<Array<{
    id: string
    location: string
    isPickup: boolean
    date: string
  }>>([])

  // Idle & wait state
  const [landstarIdleHours, setLandstarIdleHours] = useState("")
  const [landstarFuelBurnRate, setLandstarFuelBurnRate] = useState("0.6") // gallons per hour
  const [landstarFuelPrice, setLandstarFuelPrice] = useState("3.50")

  // Automatic driving & idle fuel state
  const [landstarMpg, setLandstarMpg] = useState("6.5")
  const [landstarAverageSpeed, setLandstarAverageSpeed] = useState("55")
  const [landstarAutoCalcIdle, setLandstarAutoCalcIdle] = useState(true)

  // Accessorials State
  const [landstarFsc, setLandstarFsc] = useState("")
  const [landstarTarp, setLandstarTarp] = useState("")
  const [landstarDetention, setLandstarDetention] = useState("")
  const [landstarLayover, setLandstarLayover] = useState("")
  const [landstarLoadingUnloading, setLandstarLoadingUnloading] = useState("")
  const [landstarStopOff, setLandstarStopOff] = useState("")
  const [landstarFsc100, setLandstarFsc100] = useState(true)
  const [landstarTarp100, setLandstarTarp100] = useState(true)
  const [landstarDetention100, setLandstarDetention100] = useState(true)
  const [landstarLayover100, setLandstarLayover100] = useState(true)
  const [landstarLoadingUnloading100, setLandstarLoadingUnloading100] = useState(true)
  const [landstarStopOff100, setLandstarStopOff100] = useState(false)
  
  // Custom accessorials list
  const [landstarCustomAccessorials, setLandstarCustomAccessorials] = useState<Array<{
    id: string
    name: string
    amount: string
    paidAt100: boolean
  }>>([])


  const [landstarExtractText, setLandstarExtractText] = useState("")
  const [landstarExtractImage, setLandstarExtractImage] = useState<string | null>(null)
  const [isLandstarExtracting, setIsLandstarExtracting] = useState(false)

  const handleLandstarSmartExtract = async () => {
    if (!landstarExtractText.trim() && !landstarExtractImage) {
      toast({ title: "Input Required", description: "Please upload a document or paste Landstar rate confirmation details.", variant: "destructive" })
      return
    }

    setIsLandstarExtracting(true)
    try {
      const result = await extractLoadDetails({ 
        loadDescription: landstarExtractText || undefined,
        loadPhoto: landstarExtractImage || undefined
      })
      
      const rate = result.rate || 0
      const mileage = result.mileage || 0
      
      setLandstarProNumber(result.loadNumber || landstarProNumber)
      setLandstarOrigin(result.origin || landstarOrigin)
      setLandstarDestination(result.destination || landstarDestination)
      setLandstarDispatchedMiles(mileage ? mileage.toString() : landstarDispatchedMiles)
      setLandstarLinehaul(rate ? rate.toString() : landstarLinehaul)
      
      if (result.startDate) setLandstarPickupDate(result.startDate)
      if (result.startTime) setLandstarPickupTime(result.startTime)
      if (result.endDate) setLandstarDeliveryDate(result.endDate)
      if (result.endTime) setLandstarDeliveryTime(result.endTime)

      if (result.fsc !== undefined && result.fsc !== null) setLandstarFsc(result.fsc ? result.fsc.toString() : landstarFsc)
      if (result.tarp !== undefined && result.tarp !== null) setLandstarTarp(result.tarp ? result.tarp.toString() : landstarTarp)
      if (result.detention !== undefined && result.detention !== null) setLandstarDetention(result.detention ? result.detention.toString() : landstarDetention)
      if (result.layover !== undefined && result.layover !== null) setLandstarLayover(result.layover ? result.layover.toString() : landstarLayover)
      if (result.loadingUnloading !== undefined && result.loadingUnloading !== null) setLandstarLoadingUnloading(result.loadingUnloading ? result.loadingUnloading.toString() : landstarLoadingUnloading)
      if (result.stopOff !== undefined && result.stopOff !== null) setLandstarStopOff(result.stopOff ? result.stopOff.toString() : landstarStopOff)

      if (result.stops && result.stops.length > 0) {
        setLandstarStops(result.stops.map(s => ({
          id: Math.random().toString(36).substring(7),
          location: s.location,
          isPickup: s.isPickup,
          date: s.date || ""
        })))
      }

      toast({ 
        title: "Landstar Load Extracted Successfully", 
        description: "Rate confirmation details applied to calculator.",
        action: <Sparkles className="h-4 w-4 text-primary" />
      })
      setLandstarExtractText("")
      setLandstarExtractImage(null)
    } catch (error) {
      console.error(error)
      toast({ title: "Extraction Failed", description: "Could not parse document. Please enter details manually.", variant: "destructive" })
    } finally {
      setIsLandstarExtracting(false)
    }
  }

  const handleLandstarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setLandstarExtractImage(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const activeBcoPercent = useMemo(() => {
    switch (landstarTrailerType) {
      case "landstar_van": return 65
      case "bco_van": return 72
      case "flatbed": return 73
      case "specialized": return 74
      case "reefer": return 75
      case "dedicated": return 75
      case "expedited": return 62
      case "custom": return parseFloat(landstarCustomPercent) || 0
      default: return 72
    }
  }, [landstarTrailerType, landstarCustomPercent])



  const pickupDateTime = useMemo(() => {
    if (!landstarPickupDate) return null
    try {
      return new Date(`${landstarPickupDate}T${landstarPickupTime || "00:00"}`)
    } catch (e) {
      return null
    }
  }, [landstarPickupDate, landstarPickupTime])

  const deliveryDateTime = useMemo(() => {
    if (!landstarDeliveryDate) return null
    try {
      return new Date(`${landstarDeliveryDate}T${landstarDeliveryTime || "00:00"}`)
    } catch (e) {
      return null
    }
  }, [landstarDeliveryDate, landstarDeliveryTime])

  const totalTripHours = useMemo(() => {
    if (!pickupDateTime || !deliveryDateTime) return 0
    const diffMs = deliveryDateTime.getTime() - pickupDateTime.getTime()
    return Math.max(0, diffMs / (1000 * 60 * 60))
  }, [pickupDateTime, deliveryDateTime])

  const landstarCalculations = useMemo(() => {
    const bcoPct = activeBcoPercent / 100
    const landstarPct = (100 - activeBcoPercent) / 100

    const linehaulVal = parseFloat(landstarLinehaul) || 0
    const fscVal = parseFloat(landstarFsc) || 0
    const tarpVal = parseFloat(landstarTarp) || 0
    const detentionVal = parseFloat(landstarDetention) || 0
    const layoverVal = parseFloat(landstarLayover) || 0
    const loadUnloadVal = parseFloat(landstarLoadingUnloading) || 0
    const stopOffVal = parseFloat(landstarStopOff) || 0

    let totalGrossRevenue = linehaulVal

    // Accessorial calculations with 100% or split toggles
    let total100BcoAccessorials = 0
    let bcoSplitAccessorialsShare = 0
    let landstarSplitAccessorialsShare = 0

    const processAccessorial = (amount: number, is100: boolean) => {
      if (amount <= 0) return
      if (is100) {
        total100BcoAccessorials += amount
      } else {
        totalGrossRevenue += amount
        bcoSplitAccessorialsShare += amount * bcoPct
        landstarSplitAccessorialsShare += amount * landstarPct
      }
    }

    if (fscVal > 0) {
      if (landstarFsc100) {
        total100BcoAccessorials += fscVal
      } else {
        bcoSplitAccessorialsShare += fscVal * bcoPct
        landstarSplitAccessorialsShare += fscVal * landstarPct
      }
    }

    processAccessorial(tarpVal, landstarTarp100)
    processAccessorial(detentionVal, landstarDetention100)
    processAccessorial(layoverVal, landstarLayover100)
    processAccessorial(loadUnloadVal, landstarLoadingUnloading100)
    processAccessorial(stopOffVal, landstarStopOff100)

    landstarCustomAccessorials.forEach(acc => {
      const amt = parseFloat(acc.amount) || 0
      processAccessorial(amt, acc.paidAt100)
    })

    const totalGrossWithFsc = totalGrossRevenue + fscVal
    
    const bcoLinehaulShare = linehaulVal * bcoPct
    const landstarLinehaulShare = linehaulVal * landstarPct

    const totalPaidToBco = bcoLinehaulShare + total100BcoAccessorials + bcoSplitAccessorialsShare
    const totalLandstarTake = landstarLinehaulShare + landstarSplitAccessorialsShare

    // Driving Fuel & Hours
    const miles = landstarTotalMiles
    const speedVal = parseFloat(landstarAverageSpeed) || 55
    const drivingHours = speedVal > 0 ? miles / speedVal : 0

    const mpgVal = parseFloat(landstarMpg) || 6.5
    const drivingFuelUsed = mpgVal > 0 ? miles / mpgVal : 0
    const fuelPriceVal = parseFloat(landstarFuelPrice) || 3.50
    const drivingFuelCost = drivingFuelUsed * fuelPriceVal

    // Idle Hours
    const idleHrs = landstarAutoCalcIdle 
      ? Math.max(0, totalTripHours - drivingHours) 
      : (parseFloat(landstarIdleHours) || 0)

    const burnRate = parseFloat(landstarFuelBurnRate) || 0.6
    
    const idleFuelUsed = idleHrs * burnRate
    const idleFuelCost = idleFuelUsed * fuelPriceVal
    const totalIdlingCost = idleFuelCost

    const totalFuelUsed = drivingFuelUsed + idleFuelUsed
    const totalFuelCost = drivingFuelCost + idleFuelCost

    // Net settlement is payout minus total idling & wait expenses and driving fuel cost
    const trueNetSettlement = totalPaidToBco - totalIdlingCost - drivingFuelCost

    const rpmGross = miles > 0 ? totalGrossRevenue / miles : 0
    const rpmBco = miles > 0 ? totalPaidToBco / miles : 0
    const rpmTrueNet = miles > 0 ? trueNetSettlement / miles : 0

    return {
      bcoLinehaulShare,
      landstarLinehaulShare,
      total100BcoAccessorials,
      bcoSplitAccessorialsShare,
      landstarSplitAccessorialsShare,
      totalGrossRevenue,
      totalPaidToBco,
      totalLandstarTake,
      drivingHours,
      drivingFuelUsed,
      drivingFuelCost,
      idleHrs,
      idleFuelUsed,
      idleFuelCost,
      totalIdlingCost,
      totalFuelUsed,
      totalFuelCost,
      trueNetSettlement,
      rpmGross,
      rpmBco,
      rpmTrueNet,
      miles
    }
  }, [
    activeBcoPercent,
    landstarLinehaul,
    landstarFsc,
    landstarTarp,
    landstarDetention,
    landstarLayover,
    landstarLoadingUnloading,
    landstarStopOff,
    landstarCustomAccessorials,
    landstarIdleHours,
    landstarFuelBurnRate,
    landstarFuelPrice,
    landstarDeadheadMiles,
    landstarDispatchedMiles,
    landstarAverageSpeed,
    landstarMpg,
    landstarAutoCalcIdle,
    totalTripHours,
    landstarFsc100,
    landstarTarp100,
    landstarDetention100,
    landstarLayover100,
    landstarLoadingUnloading100,
    landstarStopOff100
  ])

  const handleSaveLandstarLoad = () => {
    if (!user || !db) return
    if (!landstarOrigin || !landstarDestination) {
      toast({ title: "Missing Fields", description: "Origin and Destination are required to save the load.", variant: "destructive" })
      return
    }

    const calculatedBcoRate = Math.round(landstarCalculations.totalPaidToBco * 100) / 100
    const fscCalculated = Math.round((parseFloat(landstarFsc) || 0) * 100) / 100

    const breakdownNotes = `Landstar BCO Settlement Breakdown:
- Trailer Type / Dedicated: ${landstarTrailerType} (${activeBcoPercent}%)
- Gross Linehaul: ${(parseFloat(landstarLinehaul) || 0).toFixed(2)}
- BCO Linehaul Share: ${landstarCalculations.bcoLinehaulShare.toFixed(2)}
- 100% BCO Accessorials: ${landstarCalculations.total100BcoAccessorials.toFixed(2)}
- BCO Split Accessorials Share: ${landstarCalculations.bcoSplitAccessorialsShare.toFixed(2)}
- Total Paid to BCO: ${calculatedBcoRate.toFixed(2)}
- Landstar's Share: ${landstarCalculations.totalLandstarTake.toFixed(2)}
- Estimated Idling Cost: ${landstarCalculations.totalIdlingCost.toFixed(2)} (Hours: ${landstarCalculations.idleHrs.toFixed(1)})
- Estimated Driving Fuel Cost: ${landstarCalculations.drivingFuelCost.toFixed(2)} (${landstarCalculations.drivingFuelUsed.toFixed(1)} gal at ${landstarMpg} MPG)
- Estimated Idle Fuel Cost: ${landstarCalculations.idleFuelCost.toFixed(2)} (${landstarCalculations.idleFuelUsed.toFixed(1)} gal)
- Total Estimated Fuel Cost: ${landstarCalculations.totalFuelCost.toFixed(2)} (${landstarCalculations.totalFuelUsed.toFixed(1)} gal)`

    const finalData = {
      loadNumber: landstarProNumber || "LS-" + Math.floor(Math.random() * 900000 + 100000),
      origin: landstarOrigin,
      destination: landstarDestination,
      stops: landstarStops,
      mileage: landstarCalculations.miles,
      rateType: 'flat' as const,
      rateValue: calculatedBcoRate,
      percentageBase: 0,
      fuelSurchargeType: 'flat' as const,
      fuelSurchargeValue: fscCalculated,
      fuelSurcharge: fscCalculated,
      rate: calculatedBcoRate,
      startDate: landstarPickupDate || getEstDateString(),
      endDate: landstarDeliveryDate || getEstDateString(),
      status: 'completed' as const,
      notes: breakdownNotes,
      estimatedFuelUsed: landstarCalculations.totalFuelUsed,
      estimatedFuelCost: landstarCalculations.totalFuelCost,
      estimatedDrivingFuelUsed: landstarCalculations.drivingFuelUsed,
      estimatedIdleFuelUsed: landstarCalculations.idleFuelUsed,
      isLandstar: true,
      landstarLinehaul: parseFloat(landstarLinehaul) || 0,
      landstarGross: landstarCalculations.totalGrossRevenue,
      landstarCut: landstarCalculations.totalLandstarTake,
      landstarBcoShare: calculatedBcoRate,
      landstarFsc: parseFloat(landstarFsc) || 0,
      landstarTarp: parseFloat(landstarTarp) || 0,
      landstarDetention: parseFloat(landstarDetention) || 0,
      landstarLayover: parseFloat(landstarLayover) || 0,
      landstarLoadingUnloading: parseFloat(landstarLoadingUnloading) || 0,
      landstarStopOff: parseFloat(landstarStopOff) || 0,
      landstarFsc100,
      landstarTarp100,
      landstarDetention100,
      landstarLayover100,
      landstarLoadingUnloading100,
      landstarStopOff100,
      landstarCustomAccessorials,
    }

    if (editingLoad && editingLoad.id) {
      updateDocumentNonBlocking(doc(db, "users", user.uid, "loads", editingLoad.id), { ...finalData, id: editingLoad.id })
      toast({ 
        title: "Landstar Trip Updated", 
        description: `BCO settlement of ${calculatedBcoRate.toLocaleString()} has been updated.`,
      })
    } else {
      const loadsRef = collection(db, "users", user.uid, "loads")
      const newLoadRef = doc(loadsRef)
      setDocumentNonBlocking(newLoadRef, { ...finalData, id: newLoadRef.id }, { merge: true })
      toast({ 
        title: "Landstar Load Saved!", 
        description: `BCO settlement of ${calculatedBcoRate.toLocaleString()} has been recorded.`,
      })
    }

    setIsLandstarDialogOpen(false)
    setEditingLoad(null)
    setLandstarProNumber("")
    setLandstarOrigin("")
    setLandstarDestination("")
    setLandstarPickupDate("")
    setLandstarPickupTime("08:00")
    setLandstarDeliveryDate("")
    setLandstarDeliveryTime("17:00")
    setLandstarDeadheadMiles("")
    setLandstarDispatchedMiles("")
    setLandstarStops([])
    setLandstarLinehaul("")
    setLandstarTrailerType("landstar_van")
    setLandstarCustomPercent("72")
    setLandstarFsc("")
    setLandstarTarp("")
    setLandstarDetention("")
    setLandstarLayover("")
    setLandstarLoadingUnloading("")
    setLandstarStopOff("")
    setLandstarFsc100(true)
    setLandstarTarp100(true)
    setLandstarDetention100(true)
    setLandstarLayover100(true)
    setLandstarLoadingUnloading100(true)
    setLandstarStopOff100(false)
    setLandstarIdleHours("")
    setLandstarCustomAccessorials([])
  }

  const handleAddCustomAccessorial = () => {
    setLandstarCustomAccessorials([
      ...landstarCustomAccessorials,
      {
        id: Math.random().toString(36).substring(7),
        name: "",
        amount: "",
        paidAt100: true
      }
    ])
  }

  const handleUpdateCustomAccessorial = (id: string, field: string, value: any) => {
    setLandstarCustomAccessorials(landstarCustomAccessorials.map(acc => {
      if (acc.id === id) {
        return { ...acc, [field]: value }
      }
      return acc
    }))
  }

  const handleRemoveCustomAccessorial = (id: string) => {
    setLandstarCustomAccessorials(landstarCustomAccessorials.filter(acc => acc.id !== id))
  }

  const [formData, setFormData] = useState<Partial<Load>>(INITIAL_FORM_DATA)

  useEffect(() => {
    setToday(new Date().toISOString().split('T')[0])
  }, [])

  const settingsRef = useMemoFirebase(() => {
    if (!db || !user) return null
    return doc(db, "users", user.uid, "settings", "prefs")
  }, [db, user])
  const { data: settings } = useDoc<AppSettings>(settingsRef)

  // Math Logic for Load Calculations
  useEffect(() => {
    const rateValue = Number(formData.rateValue) || 0
    const mileage = Number(formData.mileage) || 0
    const percentageBase = Number(formData.percentageBase) || 0
    const fscValue = Number(formData.fuelSurchargeValue) || 0
    const rateType = formData.rateType || 'per_mile'
    const fscType = formData.fuelSurchargeType || 'none'

    let baseRate = 0
    if (rateType === 'per_mile') baseRate = rateValue * mileage
    else if (rateType === 'flat') baseRate = rateValue
    else if (rateType === 'percentage') baseRate = (percentageBase * rateValue) / 100

    let fsc = 0
    if (fscType === 'per_mile') fsc = fscValue * mileage
    else if (fscType === 'flat') fsc = fscValue

    const totalRate = Math.round((baseRate + fsc) * 100) / 100
    
    if (totalRate !== formData.rate || fsc !== formData.fuelSurcharge) {
      setFormData(prev => ({ ...prev, rate: totalRate, fuelSurcharge: fsc }))
    }
  }, [formData.rateValue, formData.mileage, formData.percentageBase, formData.fuelSurchargeValue, formData.rateType, formData.fuelSurchargeType, formData.rate, formData.fuelSurcharge])

  const resetForm = useCallback(() => {
    setEditingLoad(null)
    setFormData(INITIAL_FORM_DATA)
    setExtractText("")
    setExtractImage(null)
  }, [])

  const loadsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "users", user.uid, "loads")
  }, [db, user])

  const expensesQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "users", user.uid, "expenses")
  }, [db, user])

  const { data: rawLoads, isLoading: isLoadsLoading } = useCollection<Load>(loadsQuery)
  const { data: expenses } = useCollection<Expense>(expensesQuery)

  const loads = useMemo(() => {
    if (!rawLoads || !today) return []
    return rawLoads.map(load => {
      let derivedStatus = load.status
      if (today && load.startDate && load.endDate) {
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



  const filteredLoads = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return loads;

    return loads.filter(load => {
      const originMatch = (load.origin || "").toLowerCase().includes(term);
      const destinationMatch = (load.destination || "").toLowerCase().includes(term);
      const statusMatch = (load.status || "").toLowerCase().includes(term);
      const numberMatch = (load.loadNumber || "").toLowerCase().includes(term);
      return originMatch || destinationMatch || statusMatch || numberMatch;
    })
  }, [loads, searchTerm])

  const groupedLoadsByWeek = useMemo(() => {
    const groups: { [key: string]: Load[] } = {}
    const weekStartsOn = DAY_MAP[settings?.payPeriodStartDay || 'monday'] || 1

    filteredLoads.forEach(load => {
      if (!load.endDate) {
        const key = "Unscheduled"
        if (!groups[key]) groups[key] = []
        groups[key].push(load)
        return
      }
      try {
        const date = parseISO(load.endDate)
        const weekStart = startOfWeek(date, { weekStartsOn })
        const key = format(weekStart, "yyyy-MM-dd")
        if (!groups[key]) groups[key] = []
        groups[key].push(load)
      } catch (e) {
        console.error(e)
        const key = "Unscheduled"
        if (!groups[key]) groups[key] = []
        groups[key].push(load)
      }
    })

    return Object.entries(groups).sort((a, b) => {
      if (a[0] === "Unscheduled") return 1
      if (b[0] === "Unscheduled") return -1
      return b[0].localeCompare(a[0])
    })
  }, [filteredLoads, settings?.payPeriodStartDay])

  const renderLandstarCalculator = () => (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Inputs Area */}
      <div className="lg:col-span-7 space-y-6">
        {/* AI Document Scanner & Prefill Card */}
        <Card className="border-border/50 rounded-2xl bg-card/40 backdrop-blur-sm shadow-sm border-primary/20">
          <CardHeader className="p-5 pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-wider text-primary flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Scan / Upload Landstar Document to Prefill
            </CardTitle>
            <CardDescription className="text-[10px] text-muted-foreground">
              Upload rate confirmation or document image / paste text to auto-fill PRO, origin, destination, miles & rate.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-2 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60 mb-1.5 block">Upload Document / Photo</Label>
                <Input type="file" accept="image/*,application/pdf" onChange={handleLandstarFileChange} className="text-xs file:bg-primary/10 file:text-primary file:border-0 file:rounded-md file:text-[10px] file:font-bold file:uppercase cursor-pointer" />
                {landstarExtractImage && (
                  <div className="mt-2 text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                    ✓ Document loaded successfully
                  </div>
                )}
              </div>
              <div>
                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60 mb-1.5 block">Or Paste Rate Confirmation Text</Label>
                <Textarea value={landstarExtractText} onChange={e => setLandstarExtractText(e.target.value)} placeholder="Paste text here..." className="text-xs h-20 resize-none" />
              </div>
            </div>
            <Button 
              onClick={handleLandstarSmartExtract} 
              disabled={isLandstarExtracting}
              className="w-full bg-primary hover:bg-primary/90 text-white font-black uppercase text-[10px] tracking-widest gap-2"
            >
              {isLandstarExtracting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Analyzing Document...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  Extract & Prefill Landstar Load
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Trip Info Card */}
        <Card className="border-border/50 rounded-2xl bg-card/40 backdrop-blur-sm shadow-sm">
          <CardHeader className="p-5 pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-wider text-primary flex items-center gap-2">
              <Truck className="h-4 w-4" /> Load & Route Details
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-2 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60">Bill Number (Load #)</Label>
              <Input value={landstarProNumber} onChange={e => setLandstarProNumber(e.target.value)} placeholder="e.g. Bill #" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60">Deadhead Miles</Label>
                <Input type="number" value={landstarDeadheadMiles} onChange={e => setLandstarDeadheadMiles(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60">Dispatched Miles</Label>
                  {landstarTotalMiles > 0 && <span className="text-[10px] font-bold text-primary">Total: {landstarTotalMiles}</span>}
                </div>
                <Input type="number" value={landstarDispatchedMiles} onChange={e => setLandstarDispatchedMiles(e.target.value)} placeholder="0" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60">Origin</Label>
                <Input value={landstarOrigin} onChange={e => setLandstarOrigin(e.target.value)} placeholder="City, State" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60">Destination</Label>
                <Input value={landstarDestination} onChange={e => setLandstarDestination(e.target.value)} placeholder="City, State" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60">Stops (Optional)</Label>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-7 text-[10px] font-black uppercase tracking-widest px-3" 
                  onClick={() => setLandstarStops([...landstarStops, { id: Math.random().toString(), location: "", isPickup: false, date: "" }])}
                >
                  <Plus className="h-3 w-3 mr-1" /> Add Stop
                </Button>
              </div>
              {landstarStops.map((stop, idx) => (
                <div key={stop.id} className="grid grid-cols-12 gap-2 items-center p-2.5 bg-muted/20 rounded-xl border border-border">
                  <div className="col-span-2 flex items-center gap-1">
                    <Checkbox 
                      checked={stop.isPickup} 
                      onCheckedChange={(val) => {
                        const newStops = [...landstarStops]
                        newStops[idx].isPickup = !!val
                        setLandstarStops(newStops)
                      }} 
                    />
                    <span className="text-[9px] font-bold text-muted-foreground">{stop.isPickup ? "PU" : "DEL"}</span>
                  </div>
                  <div className="col-span-5">
                    <Input 
                      placeholder="Stop City, State" 
                      value={stop.location} 
                      onChange={e => {
                        const newStops = [...landstarStops]
                        newStops[idx].location = e.target.value
                        setLandstarStops(newStops)
                      }}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="col-span-4">
                    <Input 
                      type="date"
                      value={stop.date} 
                      onChange={e => {
                        const newStops = [...landstarStops]
                        newStops[idx].date = e.target.value
                        setLandstarStops(newStops)
                      }}
                      className="h-8 text-xs px-1"
                    />
                  </div>
                  <div className="col-span-1 text-right">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-destructive"
                      onClick={() => setLandstarStops(landstarStops.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60">Pickup Date & Time</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input type="date" value={landstarPickupDate} onChange={e => setLandstarPickupDate(e.target.value)} />
                  <Input type="time" value={landstarPickupTime} onChange={e => setLandstarPickupTime(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60">Delivery Date & Time</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input type="date" value={landstarDeliveryDate} onChange={e => setLandstarDeliveryDate(e.target.value)} />
                  <Input type="time" value={landstarDeliveryTime} onChange={e => setLandstarDeliveryTime(e.target.value)} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Landstar Specific Pay Settings Card */}
        <Card className="border-border/50 rounded-2xl bg-card/40 backdrop-blur-sm shadow-sm">
          <CardHeader className="p-5 pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-wider text-primary flex items-center gap-2">
              <Scale className="h-4 w-4" /> Landstar Pay Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-2 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60">Trailer Type / Division</Label>
                <Select value={landstarTrailerType} onValueChange={setLandstarTrailerType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bco_van">BCO Van / Standard (72%)</SelectItem>
                    <SelectItem value="landstar_van">Landstar-owned Van Trailer (65%)</SelectItem>
                    <SelectItem value="flatbed">Flatbed / Step Deck / Specialized (73%)</SelectItem>
                    <SelectItem value="reefer">Refrigerated (71%)</SelectItem>
                    <SelectItem value="expedited">Expedited Straight Truck (62%)</SelectItem>
                    <SelectItem value="custom">Custom Percentage (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {landstarTrailerType === 'custom' && (
                <div className="space-y-1.5 animate-in fade-in">
                  <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60">Custom BCO %</Label>
                  <Input type="number" value={landstarCustomPercent} onChange={e => setLandstarCustomPercent(e.target.value)} placeholder="72" />
                </div>
              )}

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60">Gross Linehaul Rate (Excl. Fuel Surcharge)</Label>
                  <Badge variant="outline" className="text-[9px] font-black uppercase text-primary">{activeBcoPercent}% BCO Share</Badge>
                </div>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" type="number" value={landstarLinehaul} onChange={e => setLandstarLinehaul(e.target.value)} placeholder="0.00" />
                </div>
              </div>
            </div>



            {/* Accessorials */}
            <div className="space-y-4 pt-2">
              <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60 block">Accessorial Fees & Surcharges (100% Driver vs Split)</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {/* FSC */}
                <div className="space-y-1 p-2.5 bg-muted/20 rounded-xl border border-border/60">
                  <div className="flex justify-between items-center">
                    <Label className="text-[9px] uppercase font-black text-muted-foreground">FSC (Surcharge)</Label>
                    <button
                      type="button"
                      onClick={() => setLandstarFsc100(!landstarFsc100)}
                      className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase transition-colors ${landstarFsc100 ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}
                    >
                      {landstarFsc100 ? '100% Driver' : `Split (${activeBcoPercent}%)`}
                    </button>
                  </div>
                  <div className="relative">
                    <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input className="pl-7 h-8 text-xs font-bold" type="number" value={landstarFsc} onChange={e => setLandstarFsc(e.target.value)} placeholder="0.00" />
                  </div>
                </div>

                {/* Tarp Fee */}
                <div className="space-y-1 p-2.5 bg-muted/20 rounded-xl border border-border/60">
                  <div className="flex justify-between items-center">
                    <Label className="text-[9px] uppercase font-black text-muted-foreground">Tarp Fee</Label>
                    <button
                      type="button"
                      onClick={() => setLandstarTarp100(!landstarTarp100)}
                      className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase transition-colors ${landstarTarp100 ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}
                    >
                      {landstarTarp100 ? '100% Driver' : `Split (${activeBcoPercent}%)`}
                    </button>
                  </div>
                  <div className="relative">
                    <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input className="pl-7 h-8 text-xs font-bold" type="number" value={landstarTarp} onChange={e => setLandstarTarp(e.target.value)} placeholder="0.00" />
                  </div>
                </div>

                {/* Detention */}
                <div className="space-y-1 p-2.5 bg-muted/20 rounded-xl border border-border/60">
                  <div className="flex justify-between items-center">
                    <Label className="text-[9px] uppercase font-black text-muted-foreground">Detention</Label>
                    <button
                      type="button"
                      onClick={() => setLandstarDetention100(!landstarDetention100)}
                      className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase transition-colors ${landstarDetention100 ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}
                    >
                      {landstarDetention100 ? '100% Driver' : `Split (${activeBcoPercent}%)`}
                    </button>
                  </div>
                  <div className="relative">
                    <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input className="pl-7 h-8 text-xs font-bold" type="number" value={landstarDetention} onChange={e => setLandstarDetention(e.target.value)} placeholder="0.00" />
                  </div>
                </div>

                {/* Layover */}
                <div className="space-y-1 p-2.5 bg-muted/20 rounded-xl border border-border/60">
                  <div className="flex justify-between items-center">
                    <Label className="text-[9px] uppercase font-black text-muted-foreground">Layover</Label>
                    <button
                      type="button"
                      onClick={() => setLandstarLayover100(!landstarLayover100)}
                      className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase transition-colors ${landstarLayover100 ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}
                    >
                      {landstarLayover100 ? '100% Driver' : `Split (${activeBcoPercent}%)`}
                    </button>
                  </div>
                  <div className="relative">
                    <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input className="pl-7 h-8 text-xs font-bold" type="number" value={landstarLayover} onChange={e => setLandstarLayover(e.target.value)} placeholder="0.00" />
                  </div>
                </div>

                {/* Loading / Lumper */}
                <div className="space-y-1 p-2.5 bg-muted/20 rounded-xl border border-border/60">
                  <div className="flex justify-between items-center">
                    <Label className="text-[9px] uppercase font-black text-muted-foreground">Loading / Lumper</Label>
                    <button
                      type="button"
                      onClick={() => setLandstarLoadingUnloading100(!landstarLoadingUnloading100)}
                      className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase transition-colors ${landstarLoadingUnloading100 ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}
                    >
                      {landstarLoadingUnloading100 ? '100% Driver' : `Split (${activeBcoPercent}%)`}
                    </button>
                  </div>
                  <div className="relative">
                    <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input className="pl-7 h-8 text-xs font-bold" type="number" value={landstarLoadingUnloading} onChange={e => setLandstarLoadingUnloading(e.target.value)} placeholder="0.00" />
                  </div>
                </div>

                {/* Stop-Off */}
                <div className="space-y-1 p-2.5 bg-muted/20 rounded-xl border border-border/60">
                  <div className="flex justify-between items-center">
                    <Label className="text-[9px] uppercase font-black text-muted-foreground">Stop-Off</Label>
                    <button
                      type="button"
                      onClick={() => setLandstarStopOff100(!landstarStopOff100)}
                      className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase transition-colors ${landstarStopOff100 ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}
                    >
                      {landstarStopOff100 ? '100% Driver' : `Split (${activeBcoPercent}%)`}
                    </button>
                  </div>
                  <div className="relative">
                    <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input className="pl-7 h-8 text-xs font-bold" type="number" value={landstarStopOff} onChange={e => setLandstarStopOff(e.target.value)} placeholder="0.00" />
                  </div>
                </div>
              </div>

              {/* Custom Accessorials List */}
              <div className="space-y-3 pt-3 border-t border-border/50">
                <div className="flex justify-between items-center">
                  <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60">Custom Accessorial Fees</Label>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddCustomAccessorial} className="h-7 text-[10px] font-bold gap-1">
                    <Plus className="h-3 w-3" /> Add Custom Fee
                  </Button>
                </div>
                {landstarCustomAccessorials.map(acc => (
                  <div key={acc.id} className="flex items-center gap-2 bg-muted/30 p-2 rounded-xl border border-border">
                    <Input 
                      className="h-8 text-xs font-bold flex-1" 
                      placeholder="Fee Name (e.g. Scale, Extra Stop)" 
                      value={acc.name} 
                      onChange={e => handleUpdateCustomAccessorial(acc.id, 'name', e.target.value)} 
                    />
                    <div className="relative w-28">
                      <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                      <Input 
                        className="pl-6 h-8 text-xs font-bold" 
                        type="number" 
                        placeholder="0.00" 
                        value={acc.amount} 
                        onChange={e => handleUpdateCustomAccessorial(acc.id, 'amount', e.target.value)} 
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUpdateCustomAccessorial(acc.id, 'paidAt100', !acc.paidAt100)}
                      className={`text-[8px] px-2 py-1 rounded font-black uppercase transition-colors shrink-0 ${acc.paidAt100 ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}
                    >
                      {acc.paidAt100 ? '100%' : 'Split'}
                    </button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveCustomAccessorial(acc.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10 shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Operating Costs & Fuel Estimator Card */}
        <Card className="border-border/50 rounded-2xl bg-card/40 backdrop-blur-sm shadow-sm">
          <CardHeader className="p-5 pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-wider text-primary flex items-center gap-2">
              <Fuel className="h-4 w-4" /> Trip Fuel & Operating Cost Estimator
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-2 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60">Truck MPG</Label>
                <Input type="number" step="0.1" value={landstarMpg} onChange={e => setLandstarMpg(e.target.value)} placeholder="6.5" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60">Fuel Price ($/gal)</Label>
                <Input type="number" step="0.01" value={landstarFuelPrice} onChange={e => setLandstarFuelPrice(e.target.value)} placeholder="3.50" />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-border">
              <div className="space-y-0.5">
                <Label className="text-xs font-black uppercase text-foreground">Auto-Calculate Idling & Wait Fuel</Label>
                <p className="text-[10px] text-muted-foreground">Estimate idle fuel burn during pickup/delivery waits.</p>
              </div>
              <Switch checked={landstarAutoCalcIdle} onCheckedChange={(val) => setLandstarAutoCalcIdle(!!val)} />
            </div>

            {landstarAutoCalcIdle ? (
              <div className="grid grid-cols-3 gap-3 animate-in fade-in">
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase font-black text-muted-foreground">Avg Speed (MPH)</Label>
                  <Input type="number" value={landstarAverageSpeed} onChange={e => setLandstarAverageSpeed(e.target.value)} placeholder="55" className="h-9 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase font-black text-muted-foreground">Wait / Idle Hours</Label>
                  <Input type="number" value={landstarIdleHours} onChange={e => setLandstarIdleHours(e.target.value)} placeholder="0" className="h-9 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase font-black text-muted-foreground">Idle Burn (gal/hr)</Label>
                  <Input type="number" step="0.1" value={landstarFuelBurnRate} onChange={e => setLandstarFuelBurnRate(e.target.value)} placeholder="0.6" className="h-9 text-xs" />
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Settlement Breakdown Summary Sidebar */}
      <div className="lg:col-span-5 space-y-6">
        <Card className="border-border/50 rounded-2xl bg-card/60 backdrop-blur-sm shadow-xl sticky top-6 border-primary/30">
          <CardHeader className="bg-primary/5 border-b border-primary/10 p-5">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Settlement & Net Earnings Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-5">
            {/* Net True Settlement / Net Yield Highlight Box */}
            <div className="p-4 bg-primary/10 rounded-2xl border border-primary/30 space-y-2 text-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-primary block">Net Yield / True BCO Net Settlement (After Fuel)</span>
              <div className="text-3xl font-black text-primary font-headline tracking-tighter">
                ${landstarCalculations.trueNetSettlement.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              {(landstarCalculations.totalFuelCost > 0) && (
                <div className="text-[10px] font-bold text-muted-foreground">
                  Includes -${(landstarCalculations.totalFuelCost).toFixed(2)} Fuel & Wait Expenses vs Total Gross
                </div>
              )}
            </div>

            {/* Breakdown lines */}
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                <span className="text-muted-foreground font-bold">Total Gross Revenue:</span>
                <span className="font-black text-foreground">${landstarCalculations.totalGrossRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                <span className="text-muted-foreground font-bold">BCO Linehaul Share ({activeBcoPercent}%):</span>
                <span className="font-black text-foreground">${landstarCalculations.bcoLinehaulShare.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                <span className="text-muted-foreground font-bold">100% BCO Accessorials:</span>
                <span className="font-black text-accent">${landstarCalculations.total100BcoAccessorials.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                <span className="text-muted-foreground font-bold">Split Accessorials Share ({activeBcoPercent}%):</span>
                <span className="font-black text-foreground">${landstarCalculations.bcoSplitAccessorialsShare.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border font-bold">
                <span className="text-primary font-black">Driver Payout (Total Paid to BCO):</span>
                <span className="font-black text-primary text-base">${landstarCalculations.totalPaidToBco.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 text-destructive/80">
                <span className="text-muted-foreground font-bold">Landstar Share Take ({100 - activeBcoPercent}%):</span>
                <span className="font-black text-destructive/80">${landstarCalculations.totalLandstarTake.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Fuel Breakdown Details */}
            {(landstarCalculations.totalFuelCost > 0) && (
              <div className="p-3 bg-muted/30 rounded-xl border border-border space-y-1.5 text-[11px]">
                <span className="font-black uppercase text-[9px] tracking-widest text-muted-foreground block mb-1">Estimated Fuel & Wait Expenses</span>
                <div className="flex justify-between">
                  <span>Driving Fuel ({landstarCalculations.drivingFuelUsed.toFixed(1)} gal):</span>
                  <span className="text-muted-foreground">${landstarCalculations.drivingFuelCost.toFixed(2)}</span>
                </div>
                {landstarCalculations.idleFuelUsed > 0 && (
                  <div className="flex justify-between">
                    <span>Idling Fuel ({landstarCalculations.idleFuelUsed.toFixed(1)} gal):</span>
                    <span className="text-muted-foreground">${landstarCalculations.idleFuelCost.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1 border-t border-border font-bold text-foreground">
                  <span>Total Fuel & Wait Cost:</span>
                  <span>-${(landstarCalculations.totalFuelCost).toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* RPM Metrics */}
            {landstarCalculations.miles > 0 && (
              <div className="p-3 bg-muted/30 rounded-xl border border-border space-y-2">
                <span className="font-black uppercase text-[9px] tracking-widest text-muted-foreground block">Revenue Per Mile (RPM)</span>
                <div className="grid grid-cols-3 gap-2 text-center mt-1">
                  <div className="bg-background/80 p-2 rounded-xl border border-border/50">
                    <span className="text-[8px] font-black uppercase text-muted-foreground block">Gross RPM</span>
                    <span className="text-xs font-black text-foreground">${landstarCalculations.rpmGross.toFixed(2)}</span>
                  </div>
                  <div className="bg-background/80 p-2 rounded-xl border border-border/50">
                    <span className="text-[8px] font-black uppercase text-primary block">BCO RPM</span>
                    <span className="text-xs font-black text-primary">${landstarCalculations.rpmBco.toFixed(2)}</span>
                  </div>
                  <div className="bg-background/80 p-2 rounded-xl border border-border/50">
                    <span className="text-[8px] font-black uppercase text-accent block">Net RPM</span>
                    <span className="text-xs font-black text-accent">${landstarCalculations.rpmTrueNet.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <Button 
              onClick={handleSaveLandstarLoad}
              disabled={!landstarOrigin || !landstarDestination}
              className="w-full bg-primary hover:bg-primary/90 h-11 text-xs font-black uppercase tracking-widest shadow-lg gap-2"
            >
              <Plus className="h-4 w-4" /> {editingLoad && editingLoad.isLandstar ? "Update Landstar Trip" : "Save Load & Log Expenses"}
            </Button>

            {!landstarOrigin || !landstarDestination ? (
              <p className="text-[10px] text-muted-foreground text-center font-bold">
                * Please enter Origin & Destination to save this trip to your history.
              </p>
            ) : null}

          </CardContent>
        </Card>
      </div>
    </div>
  )

  const getWeekSavings = useCallback((weekLoads: Load[]) => {
    return weekLoads.reduce((sum, load) => {
      const loadExp = expenses?.filter(e => e.loadId === load.id) || []
      const diesel = loadExp.reduce((s, e) => s + (e.dieselSavings || 0), 0)
      const reefer = loadExp.reduce((s, e) => s + (e.reeferSavings || 0), 0)
      return sum + diesel + reefer
    }, 0)
  }, [expenses])

  const handleOpenDialog = useCallback((load: Load | null = null) => {
    if (load) {
      setEditingLoad(load)
      if (load.isLandstar) {
        setLandstarProNumber(load.loadNumber || "")
        setLandstarOrigin(load.origin || "")
        setLandstarDestination(load.destination || "")
        setLandstarPickupDate(load.startDate || "")
        setLandstarDeliveryDate(load.endDate || "")
        setLandstarDispatchedMiles(String(load.mileage || ""))
        setLandstarTrailerType(load.landstarTrailerType || "landstar_van")
        setLandstarCustomPercent(load.landstarCustomPercent || "72")
        setLandstarLinehaul(load.landstarLinehaul !== undefined ? String(load.landstarLinehaul) : String(load.landstarGross || load.rateValue || ""))
        setLandstarStops((load.stops || []).map(s => ({
          id: s.id || Math.random().toString(),
          location: s.location || "",
          isPickup: !!s.isPickup,
          date: s.date || ""
        })))

        setLandstarFsc(load.landstarFsc !== undefined ? String(load.landstarFsc) : "")
        setLandstarTarp(load.landstarTarp !== undefined ? String(load.landstarTarp) : "")
        setLandstarDetention(load.landstarDetention !== undefined ? String(load.landstarDetention) : "")
        setLandstarLayover(load.landstarLayover !== undefined ? String(load.landstarLayover) : "")
        setLandstarLoadingUnloading(load.landstarLoadingUnloading !== undefined ? String(load.landstarLoadingUnloading) : "")
        setLandstarStopOff(load.landstarStopOff !== undefined ? String(load.landstarStopOff) : "")
        setLandstarFsc100(load.landstarFsc100 ?? true)
        setLandstarTarp100(load.landstarTarp100 ?? true)
        setLandstarDetention100(load.landstarDetention100 ?? true)
        setLandstarLayover100(load.landstarLayover100 ?? true)
        setLandstarLoadingUnloading100(load.landstarLoadingUnloading100 ?? true)
        setLandstarStopOff100(load.landstarStopOff100 ?? false)
        setLandstarCustomAccessorials(load.landstarCustomAccessorials || [])
        setIsLandstarDialogOpen(true)
      } else {
        setFormData({
          ...load,
          stops: load.stops || []
        })
        setIsDialogOpen(true)
      }
    } else {
      setEditingLoad(null)
      // Automatically pre-fill with defaults from user settings
      setFormData({
        ...INITIAL_FORM_DATA,
        rateType: settings?.defaultRateType || 'per_mile',
        rateValue: settings?.defaultRateValue || 0,
        fuelSurchargeType: settings?.defaultFuelSurchargeType || 'none',
        fuelSurchargeValue: settings?.defaultFuelSurchargeValue || 0,
      })
      setIsDialogOpen(true)
    }
  }, [settings])

  const handleSaveLoad = () => {
    if (!user || !db) return
    if (!formData.origin || !formData.destination) {
      toast({ title: "Missing Fields", description: "Origin and Destination are required.", variant: "destructive" })
      return
    }

    const { id: _, ...payloadData } = formData;
    const finalData = {
      ...payloadData,
      rateValue: parseFloat(String(formData.rateValue)) || 0,
      mileage: parseFloat(String(formData.mileage)) || 0,
      percentageBase: parseFloat(String(formData.percentageBase)) || 0,
      fuelSurchargeValue: parseFloat(String(formData.fuelSurchargeValue)) || 0,
      fuelSurcharge: parseFloat(String(formData.fuelSurcharge)) || 0,
      rate: parseFloat(String(formData.rate)) || 0,
      stops: formData.stops || []
    }

    if (editingLoad) {
      updateDocumentNonBlocking(doc(db, "users", user.uid, "loads", editingLoad.id), finalData)
      toast({ title: "Load Updated" })
    } else {
      const loadsRef = collection(db, "users", user.uid, "loads")
      const newLoadRef = doc(loadsRef)
      setDocumentNonBlocking(newLoadRef, { ...finalData, id: newLoadRef.id }, { merge: true })
      toast({ title: "Load Created" })
    }

    setIsDialogOpen(false)
    setTimeout(resetForm, 300)
  }

  const handleDeleteExpense = (expenseId: string) => {
    if (!user || !db) return;
    deleteDocumentNonBlocking(doc(db, "users", user.uid, "expenses", expenseId));
    setIsExpenseDialogOpen(false);
    toast({ title: "Expense Deleted", description: "The expense has been removed from this trip." });
  }

  const handleDeleteLoad = (loadId: string) => {
    if (!user || !db) return
    deleteDocumentNonBlocking(doc(db, "users", user.uid, "loads", loadId))
    toast({ title: "Load Removed" })
  }

  const handleSmartExtract = async () => {
    if (!extractText.trim() && !extractImage) {
      toast({ title: "Input Required", description: "Please take a photo, upload a document, or paste details.", variant: "destructive" })
      return
    }

    setIsExtracting(true)
    try {
      const result = await extractLoadDetails({ 
        loadDescription: extractText || undefined,
        loadPhoto: extractImage || undefined
      })
      
      const rate = result.rate || 0
      const mileage = result.mileage || 0
      const rateType = result.rateType || "flat"
      
      setFormData(prev => ({
        ...prev,
        loadNumber: result.loadNumber || prev.loadNumber,
        origin: result.origin || prev.origin,
        destination: result.destination || prev.destination,
        mileage: mileage || prev.mileage,
        rateValue: rate || prev.rateValue,
        rateType: rateType as any,
        startDate: result.startDate || prev.startDate,
        endDate: result.endDate || prev.endDate,
        stops: result.stops?.map(s => ({
          id: Math.random().toString(36).substring(7),
          location: s.location,
          date: s.date || "",
          isPickup: s.isPickup
        })) || prev.stops
      }))

      toast({ 
        title: "Smart Extraction Complete", 
        description: "Review the auto-filled details.",
        action: <Sparkles className="h-4 w-4 text-primary" />
      })
      setExtractText("")
      setExtractImage(null)
    } catch (error) {
      console.error(error)
      toast({ title: "Extraction Failed", description: "Could not parse details. Please enter manually.", variant: "destructive" })
    } finally {
      setIsExtracting(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setExtractImage(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleAddStop = () => {
    const newStop: Stop = {
      id: Math.random().toString(36).substring(7),
      location: "",
      date: "",
      isPickup: false
    }
    setFormData(prev => ({
      ...prev,
      stops: [...(prev.stops || []), newStop]
    }))
  }

  const handleRemoveStop = (id: string) => {
    setFormData(prev => ({
      ...prev,
      stops: prev.stops?.filter(s => s.id !== id)
    }))
  }

  const handleUpdateStop = (id: string, field: keyof Stop, value: any) => {
    setFormData(prev => ({
      ...prev,
      stops: prev.stops?.map(s => s.id === id ? { ...s, [field]: value } : s)
    }))
  }

  const currentGroup = groupedLoadsByWeek[currentWeekIndex]
  const hasMultipleWeeks = groupedLoadsByWeek.length > 1 && !searchTerm

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-background">
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border px-4 md:px-6 transition-[width,height] ease-linear">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <h1 className="text-lg md:text-xl font-bold font-headline truncate text-primary uppercase tracking-tighter">HaulSense By Turbo</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" className="bg-primary hover:bg-primary/90 h-8 font-black uppercase text-[10px] tracking-widest shadow-lg" onClick={() => handleOpenDialog()}>
              <Plus className="mr-1 h-3.5 w-3.5" /> New Load
            </Button>
          </div>
        </header>
        
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6 overflow-x-hidden">
          <Tabs defaultValue="list" className="w-full space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between border-b border-border pb-4">
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight text-foreground font-headline leading-none">Trip Operations</h2>
                <p className="text-xs text-muted-foreground mt-1">Manage and calculate owner-operator freight earnings.</p>
              </div>
              <TabsList className="grid w-full grid-cols-2 max-w-[320px] bg-muted/40 p-1 rounded-xl">
                <TabsTrigger value="list" className="font-black uppercase tracking-widest text-[10px] h-8 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
                  All Trips
                </TabsTrigger>
                <TabsTrigger value="landstar" className="font-black uppercase tracking-widest text-[10px] h-8 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
                  Landstar Calculator
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="list" className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative w-full max-md:max-w-none max-w-md shadow-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search load #, origin, status..." 
                className="pl-10 bg-card border-border h-10 rounded-xl"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {hasMultipleWeeks && (
              <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-lg border border-border shadow-sm">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  disabled={currentWeekIndex === groupedLoadsByWeek.length - 1}
                  onClick={() => setCurrentWeekIndex(prev => prev + 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex flex-col items-center px-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                    {currentGroup[0] === "Unscheduled" ? "Unscheduled" : format(parseISO(currentGroup[0]), "MMM d")}
                  </span>
                  {currentGroup[1].length > 0 && (
                    <span className="text-[8px] font-black text-accent uppercase tracking-tighter">
                      Save: ${getWeekSavings(currentGroup[1]).toFixed(2)}
                    </span>
                  )}
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  disabled={currentWeekIndex === 0}
                  onClick={() => setCurrentWeekIndex(prev => prev - 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <Dialog open={isDialogOpen} onOpenChange={(open) => { if(!open) setTimeout(resetForm, 300); setIsDialogOpen(open); }}>
            <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto rounded-2xl">
              <DialogHeader>
                <DialogTitle className="font-headline font-black flex items-center gap-2 text-xl">
                  <Truck className="h-6 w-6 text-primary" />
                  {editingLoad ? "Edit Trip" : "Capture New Trip"}
                </DialogTitle>
                <DialogDescription>Enter load details, route stops, and rate information.</DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-6 py-4">
                {!editingLoad && (
                  <div className="bg-primary/5 p-4 rounded-2xl border border-primary/20 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Smart Capture</Label>
                      </div>
                      {isExtracting && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div 
                        className={cn(
                          "flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-4 transition-all cursor-pointer hover:border-primary/50 hover:bg-primary/10",
                          extractImage && "border-primary/50 bg-primary/10"
                        )}
                        onClick={() => cameraInputRef.current?.click()}
                      >
                        {extractImage ? (
                          <div className="relative w-full aspect-square rounded-lg overflow-hidden border border-primary/20">
                            <img src={extractImage} alt="Preview" className="w-full h-full object-cover" />
                            <Button 
                              variant="destructive" 
                              size="icon" 
                              className="absolute top-1 right-1 h-6 w-6 rounded-full"
                              onClick={(e) => { e.stopPropagation(); setExtractImage(null); }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1 text-muted-foreground text-center">
                            <Camera className="h-5 w-5 text-primary" />
                            <p className="text-[9px] font-bold">Take Photo</p>
                          </div>
                        )}
                        <input 
                          type="file" 
                          ref={cameraInputRef} 
                          className="hidden" 
                          accept="image/*" 
                          capture="environment"
                          onChange={handleFileChange} 
                        />
                      </div>
                      <div 
                        className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-4 transition-all cursor-pointer hover:border-primary/50 hover:bg-primary/10"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="h-5 w-5 text-accent" />
                        <p className="text-[9px] font-bold text-muted-foreground mt-1 text-center">Upload File</p>
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          className="hidden" 
                          accept="image/*" 
                          onChange={handleFileChange} 
                        />
                      </div>
                      <Textarea 
                        placeholder="Or paste rate-con text..." 
                        className="col-span-2 h-20 text-[10px] bg-background resize-none"
                        value={extractText}
                        onChange={(e) => setExtractText(e.target.value)}
                      />
                    </div>

                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full bg-primary/10 border-primary/20 text-primary hover:bg-primary/20 font-black text-[10px] uppercase h-10 gap-2"
                      onClick={handleSmartExtract}
                      disabled={isExtracting || (!extractText && !extractImage)}
                    >
                      {isExtracting ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Analyzing Document...
                        </>
                      ) : (
                        <>
                          <Zap className="h-3.5 w-3.5" />
                          Extract Load Data
                        </>
                      )}
                    </Button>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60">Load Number</Label>
                      <Input value={formData.loadNumber || ""} onChange={e => setFormData({...formData, loadNumber: e.target.value})} placeholder="Trip #" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60">Status</Label>
                      <Select value={formData.status} onValueChange={v => setFormData({...formData, status: v as any})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="upcoming">Upcoming</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60">Origin</Label>
                      <Input value={formData.origin || ""} onChange={e => setFormData({...formData, origin: e.target.value})} placeholder="City, State" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60">Destination</Label>
                      <Input value={formData.destination || ""} onChange={e => setFormData({...formData, destination: e.target.value})} placeholder="City, State" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60">Pickup Date</Label>
                      <Input type="date" value={formData.startDate || ""} onChange={e => setFormData({...formData, startDate: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60">Delivery Date</Label>
                      <Input type="date" value={formData.endDate || ""} onChange={e => setFormData({...formData, endDate: e.target.value})} />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] uppercase font-black tracking-widest text-primary">Financial Details</Label>
                      <Badge variant="outline" className="text-[9px] font-black uppercase text-accent">Auto-Calc</Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-black text-muted-foreground/60">Total Mileage</Label>
                        <Input type="number" value={formData.mileage || ""} onChange={e => setFormData({...formData, mileage: parseFloat(e.target.value) || 0})} placeholder="0" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-black text-muted-foreground/60">Rate Type</Label>
                        <Select value={formData.rateType} onValueChange={v => setFormData({...formData, rateType: v as any})}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="per_mile">Per Mile ($/mi)</SelectItem>
                            <SelectItem value="flat">Flat Rate ($)</SelectItem>
                            <SelectItem value="percentage">Percentage (%)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {formData.rateType === 'percentage' && (
                        <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
                          <Label className="text-[10px] uppercase font-black text-muted-foreground/60">Percentage Base ($)</Label>
                          <Input type="number" value={formData.percentageBase || ""} onChange={e => setFormData({...formData, percentageBase: parseFloat(e.target.value) || 0})} placeholder="e.g. 2000" />
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-black text-muted-foreground/60">Rate Value</Label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input type="number" className="pl-9" value={formData.rateValue || ""} onChange={e => setFormData({...formData, rateValue: parseFloat(e.target.value) || 0})} />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-black text-muted-foreground/60">FSC Type</Label>
                        <Select value={formData.fuelSurchargeType} onValueChange={v => setFormData({...formData, fuelSurchargeType: v as any})}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="per_mile">Per Mile FSC</SelectItem>
                            <SelectItem value="flat">Flat FSC</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-black text-muted-foreground/60">FSC Value</Label>
                        <Input type="number" disabled={formData.fuelSurchargeType === 'none'} value={formData.fuelSurchargeValue || ""} onChange={e => setFormData({...formData, fuelSurchargeValue: parseFloat(e.target.value) || 0})} />
                      </div>
                    </div>

                    <div className="p-4 bg-muted/30 rounded-2xl border border-border">
                      <div className="flex justify-between items-center">
                        <Label className="text-[10px] uppercase font-black text-primary">Final Settlement Estimate</Label>
                        <span className="text-2xl font-black text-primary font-headline tracking-tighter">${formData.rate?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      {formData.fuelSurcharge && formData.fuelSurcharge > 0 ? (
                        <div className="mt-1 text-[10px] font-bold text-accent text-right">
                          Includes ${formData.fuelSurcharge.toFixed(2)} Fuel Surcharge
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] uppercase font-black tracking-widest text-primary">Route Stops (Intermediate)</Label>
                      <Button variant="outline" size="sm" className="h-7 text-[10px] font-black uppercase tracking-widest px-3" onClick={handleAddStop}>
                        <Plus className="h-3 w-3 mr-1.5" /> Add Stop
                      </Button>
                    </div>
                    
                    <div className="space-y-3">
                      {(formData.stops || []).map((stop) => (
                        <div key={stop.id} className="grid grid-cols-12 gap-2 items-end p-3 bg-muted/20 rounded-xl border border-border animate-in fade-in slide-in-from-top-2">
                          <div className="col-span-1 flex flex-col items-center justify-center">
                            <Checkbox 
                              checked={stop.isPickup} 
                              onCheckedChange={(val) => handleUpdateStop(stop.id, 'isPickup', !!val)}
                            />
                            <span className="text-[7px] font-black uppercase text-muted-foreground mt-1">{stop.isPickup ? 'PU' : 'DEL'}</span>
                          </div>
                          <div className="col-span-6 space-y-1">
                            <Label className="text-[8px] uppercase font-black text-muted-foreground/60">Location</Label>
                            <Input 
                              placeholder="City, State" 
                              value={stop.location} 
                              onChange={e => handleUpdateStop(stop.id, 'location', e.target.value)}
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="col-span-4 space-y-1">
                            <Label className="text-[8px] uppercase font-black text-muted-foreground/60">Date</Label>
                            <Input 
                              type="date" 
                              value={stop.date} 
                              onChange={e => handleUpdateStop(stop.id, 'date', e.target.value)}
                              className="h-8 text-xs px-1"
                            />
                          </div>
                          <div className="col-span-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleRemoveStop(stop.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {(!formData.stops || formData.stops.length === 0) && (
                        <div className="text-center py-6 border-2 border-dashed border-border rounded-2xl">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">No intermediate stops added</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="ghost" className="font-bold uppercase text-[10px]" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button className="font-black uppercase text-[10px] tracking-widest" onClick={handleSaveLoad}>
                  {editingLoad ? "Update Trip" : "Save Trip"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isLandstarDialogOpen} onOpenChange={setIsLandstarDialogOpen}>
            <DialogContent className="sm:max-w-[1000px] max-h-[90vh] overflow-y-auto rounded-3xl p-6">
              <DialogHeader className="mb-4">
                <DialogTitle className="font-headline font-black flex items-center gap-2 text-xl">
                  <Truck className="h-6 w-6 text-primary" />
                  {editingLoad ? "Edit Landstar Trip (Calculator)" : "Landstar Calculator"}
                </DialogTitle>
                <DialogDescription>Calculate and update Landstar BCO settlements, linehaul guarantees, and fuel costs.</DialogDescription>
              </DialogHeader>
              <div className="py-2">
                {renderLandstarCalculator()}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
            <DialogContent className="sm:max-w-[450px] rounded-2xl">
              <DialogHeader>
                <DialogTitle className="font-black uppercase tracking-widest text-lg flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-primary" />
                  Expense Details
                </DialogTitle>
                <DialogDescription>Review and manage this transaction.</DialogDescription>
              </DialogHeader>
              {viewingExpense && (
                <div className="space-y-6 py-4">
                  <div className="bg-muted/30 p-4 rounded-2xl border border-border">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <Badge className="bg-primary text-white font-black uppercase text-[10px] tracking-widest">{viewingExpense.category}</Badge>
                        <h3 className="text-sm font-black uppercase mt-2 text-foreground">{viewingExpense.description}</h3>
                        <p className="text-[10px] font-bold text-muted-foreground mt-0.5">{viewingExpense.date}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xl font-black text-destructive font-headline">-${viewingExpense.amount.toFixed(2)}</span>
                      </div>
                    </div>
                    {viewingExpense.truckStop && (
                      <div className="flex items-center gap-2 mb-2">
                        <MapPinned className="h-3.5 w-3.5 text-primary" />
                        <span className="text-[11px] font-black uppercase tracking-tight">{viewingExpense.truckStop}</span>
                        {viewingExpense.location && <span className="text-[10px] font-medium text-muted-foreground">• {viewingExpense.location}</span>}
                      </div>
                    )}
                    {viewingExpense.category === 'Fuel' && (
                      <div className="mt-4 p-3 bg-accent/5 rounded-xl border border-accent/20 space-y-2">
                        <div className="flex items-center gap-2">
                          <Fuel className="h-3.5 w-3.5 text-accent" />
                          <span className="text-[10px] font-black uppercase text-accent tracking-widest">Fuel Breakdown</span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                          {viewingExpense.dieselGallons && (
                            <>
                              <span className="text-muted-foreground">Diesel:</span>
                              <span className="font-bold text-right">{viewingExpense.dieselGallons} gal</span>
                              <span className="text-muted-foreground">Discount Price:</span>
                              <span className="font-bold text-right text-accent">${viewingExpense.dieselDiscountPrice?.toFixed(3)}</span>
                              {viewingExpense.dieselSavings && viewingExpense.dieselSavings > 0 && (
                                <>
                                  <span className="text-accent font-black uppercase">Savings:</span>
                                  <span className="font-black text-right text-accent">+${viewingExpense.dieselSavings.toFixed(2)}</span>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <DialogFooter className="gap-2">
                <Button variant="ghost" className="text-destructive font-bold uppercase text-[10px]" onClick={() => viewingExpense && handleDeleteExpense(viewingExpense.id)}>
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                </Button>
                <div className="flex-1" />
                <Button variant="outline" className="font-bold uppercase text-[10px]" onClick={() => setIsExpenseDialogOpen(false)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {isLoadsLoading ? (
            <div className="flex flex-col items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-8">
              {currentGroup && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <CalendarDays className="h-5 w-5 text-primary" />
                      <h2 className="text-sm font-black uppercase tracking-widest text-foreground font-headline">
                        {currentGroup[0] === "Unscheduled" ? "Unscheduled Trips" : `Week of ${format(parseISO(currentGroup[0]), "MMMM d, yyyy")}`}
                      </h2>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground h-6 bg-muted/20 border-border">
                      {currentGroup[1].length} {currentGroup[1].length === 1 ? 'Trip' : 'Trips'}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {currentGroup[1].map((load) => (
                      <LoadCard 
                        key={load.id} 
                        load={load} 
                        expenses={expenses || []}
                        onEdit={handleOpenDialog} 
                        onDelete={handleDeleteLoad}
                        onViewExpense={(e) => {
                          setViewingExpense(e);
                          setIsExpenseDialogOpen(true);
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          </TabsContent>

          <TabsContent value="landstar" className="space-y-6 animate-in fade-in-50 duration-200">
            {renderLandstarCalculator()}
          </TabsContent>

          </Tabs>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

function LoadCard({ load, expenses, onEdit, onDelete, onViewExpense }: { 
  load: Load, 
  expenses: Expense[], 
  onEdit: (l: Load) => void, 
  onDelete: (id: string) => void,
  onViewExpense: (e: Expense) => void
}) {
  const loadExpenses = expenses.filter(e => e.loadId === load.id);
  const totalExpenses = loadExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalSavings = loadExpenses.reduce((sum, e) => sum + (e.dieselSavings || 0) + (e.reeferSavings || 0), 0);
  const netProfit = (load.rate || 0) - totalExpenses;
  const [isExpensesOpen, setIsExpensesOpen] = useState(false);

  const actualFuelExpenses = loadExpenses.filter(e => e.category === 'Fuel');
  const actualFuelCost = actualFuelExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const actualFuelGallons = actualFuelExpenses.reduce((sum, e) => sum + (e.dieselGallons || 0) + (e.reeferGallons || 0), 0);
  const estFuelCost = load.estimatedFuelCost || 0;
  const estFuelUsed = load.estimatedFuelUsed || 0;
  const fuelDiff = actualFuelCost - estFuelCost;

  return (
    <Card className="border-border/50 hover:border-primary/50 transition-all shadow-md group rounded-2xl overflow-hidden bg-card/40 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-start justify-between pb-2 p-5 bg-muted/5">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-2xl ${load.status === 'completed' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-primary/10 text-primary border border-primary/20'} group-hover:scale-105 transition-transform shadow-sm`}>
            <Truck className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-sm font-black uppercase tracking-wider">
              {load.loadNumber ? `Load #${load.loadNumber}` : `ID: #${load.id.substring(0, 4).toUpperCase()}`}
            </CardTitle>
            <div className="flex gap-2 mt-1 items-center">
              <Badge variant="outline" className="text-[8px] uppercase font-black h-4 px-1.5 tracking-widest border-border/50 bg-background/50">{load.status}</Badge>
              {load.endDate && <span className="text-[9px] text-muted-foreground font-bold tracking-tight">{load.endDate}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <span className="text-[8px] font-black uppercase text-accent/80 block leading-none mb-1 tracking-widest">Trip Save</span>
            <span className="text-sm font-black font-headline text-accent tracking-tighter leading-none">+${totalSavings.toFixed(2)}</span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-muted/50"><MoreVertical className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 font-bold uppercase text-[10px] rounded-xl shadow-xl border-border/50">
              <DropdownMenuItem onClick={() => onEdit(load)} className="gap-2 cursor-pointer"><Edit className="h-3.5 w-3.5" /> Edit Trip</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive gap-2 cursor-pointer" onClick={() => onDelete(load.id)}><Trash2 className="h-3.5 w-3.5" /> Delete Trip</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="p-5 pt-0">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5 mt-2">
            <div className="flex items-center gap-2 text-sm font-black text-foreground leading-tight">
              <div className="h-2.5 w-2.5 rounded-full bg-primary border-2 border-primary/20 shrink-0" />
              <span className="truncate">{load.origin}</span>
            </div>
            {load.stops && load.stops.length > 0 && (
              <div className="pl-4 space-y-2 my-1 border-l-2 border-dashed border-primary/10 ml-1.25 py-1">
                {load.stops.map(stop => (
                  <div key={stop.id} className="flex items-center gap-2 text-[10px] text-muted-foreground group/stop">
                    {stop.isPickup ? <Package className="h-3 w-3 text-primary/70" /> : <MapPinned className="h-3 w-3 text-accent/70" />}
                    <span className={cn("font-bold tracking-tight", stop.isPickup && "text-primary/80")}>{stop.location}</span> 
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 text-sm font-black text-foreground leading-tight">
              <MapPin className="h-4 w-4 text-accent shrink-0" />
              <span className="truncate">{load.destination}</span>
            </div>
          </div>

          <Collapsible open={isExpensesOpen} onOpenChange={setIsExpensesOpen} className="w-full">
            <div className="bg-muted/10 p-3 rounded-2xl border border-border mt-1 shadow-sm transition-all">
              <CollapsibleTrigger asChild>
                <div className="flex justify-between items-center cursor-pointer group/trigger">
                  <div className="flex items-center gap-2">
                    <Receipt className="h-3.5 w-3.5 text-muted-foreground group-hover/trigger:text-primary" />
                    <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Trip Expenses ({loadExpenses.length})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-destructive">-${totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform duration-200", isExpensesOpen && "rotate-180")} />
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 mt-3 animate-in slide-in-from-top-2 duration-200">
                <Separator className="bg-border/30" />
                {loadExpenses.length > 0 ? (
                  <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                    {loadExpenses.map((exp) => (
                      <div 
                        key={exp.id} 
                        className="flex justify-between items-start text-[10px] bg-background/50 p-2 rounded-xl border border-border/30 hover:bg-primary/5 cursor-pointer transition-colors"
                        onClick={() => onViewExpense(exp)}
                      >
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-foreground uppercase tracking-tighter">{exp.category}</span>
                            {exp.truckStop && <span className="text-[8px] font-black text-primary uppercase bg-primary/10 px-1 rounded">{exp.truckStop}</span>}
                          </div>
                          <span className="text-muted-foreground opacity-70 truncate max-w-[150px]">{exp.description}</span>
                          {exp.location && <span className="text-[8px] text-muted-foreground font-bold">{exp.location}</span>}
                          {exp.dieselSavings && exp.dieselSavings > 0 && (
                            <span className="text-[8px] font-black text-accent mt-0.5">Save: ${exp.dieselSavings.toFixed(2)}</span>
                          )}
                        </div>
                        <span className="font-black text-destructive">-${exp.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[9px] text-muted-foreground italic text-center py-2">No expenses assigned.</p>
                )}
                <Separator className="bg-border/30" />
                {estFuelCost > 0 && (
                  <div className="bg-primary/5 p-3 rounded-xl border border-primary/10 space-y-1.5 text-[10px]">
                    <div className="flex justify-between items-center font-bold text-primary">
                      <span>Estimated Fuel Usage:</span>
                      <span>{estFuelUsed.toFixed(1)} gal (${estFuelCost.toFixed(2)})</span>
                    </div>
                    <div className="flex justify-between items-center font-bold text-muted-foreground">
                      <span>Actual Fuel Receipts:</span>
                      <span>${actualFuelCost.toFixed(2)}</span>
                    </div>
                    <Separator className="bg-primary/20 my-1" />
                    <div className="flex justify-between items-center font-black">
                      <span className="text-muted-foreground uppercase tracking-tight">Fuel Variance (Actual vs Est):</span>
                      <span className={cn(fuelDiff > 0 ? "text-destructive" : "text-accent")}>
                        {fuelDiff >= 0 ? `+${fuelDiff.toFixed(2)} over` : `${fuelDiff.toFixed(2)} under`}
                      </span>
                    </div>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    {netProfit >= 0 ? <TrendingUp className="h-3.5 w-3.5 text-accent" /> : <TrendingDown className="h-3.5 w-3.5 text-destructive" />}
                    <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Net Trip Profit</span>
                  </div>
                  <span className={cn("text-sm font-black font-headline tracking-tight", netProfit >= 0 ? "text-accent" : "text-destructive")}>
                    ${netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

          <div className="flex items-center justify-between border-t border-border pt-4 mt-1">
            <div className="flex flex-col">
              <span className="text-[9px] text-muted-foreground uppercase font-black block leading-none mb-1 tracking-widest opacity-70">Net Yield (After Exp.)</span>
              <span className={cn("text-lg font-black font-headline tracking-tighter leading-none", netProfit >= 0 ? "text-accent" : "text-destructive")}>
                ${netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="text-right flex flex-col gap-1 items-end">
              {load.isLandstar && load.landstarGross && load.landstarGross > (load.rate || 0) ? (
                <div className="flex items-center gap-1.5 justify-end">
                  <span className="text-[8px] font-black uppercase text-muted-foreground">Total Gross:</span>
                  <span className="text-xs font-black text-foreground">${load.landstarGross.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              ) : null}
              <div className="flex flex-col items-end">
                <span className="text-[9px] text-muted-foreground uppercase font-black block leading-none mb-1 tracking-widest opacity-70">
                  {load.isLandstar ? "Driver Payout (BCO)" : "Gross Total"}
                </span>
                <div className="flex items-center gap-1.5 justify-end">
                  <BadgeDollarSign className="h-4 w-4 text-primary opacity-80" />
                  <span className="text-xl font-black text-primary font-headline tracking-tighter leading-none">${(load.rate || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
