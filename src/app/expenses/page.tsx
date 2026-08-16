"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card"
import { 
  Loader2,
  Trash2,
  Edit,
  DollarSign,
  ChevronRight,
  Receipt,
  MoreHorizontal,
  Link2,
  Sparkles,
  Camera,
  Zap,
  X,
  Upload
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { useCollection, useFirestore, useUser, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase"
import { collection, doc } from "firebase/firestore"
import { Expense, Load } from "@/lib/types"
import { cn } from "@/lib/utils"
import { categorizeExpense } from "@/ai/flows/ai-expense-categorization-flow"

const TRUCK_STOPS = [
  "Pilot",
  "Flying J",
  "Love's Travel Stops",
  "TravelCenters of America (TA)",
  "Petro Stopping Centers",
  "Roady's Truck Stops",
  "AMBEST",
  "Sapp Bros.",
  "Kwik Trip / Kwik Star",
  "Speedway",
  "Sheetz",
  "Maverick",
  "Kum & Go",
  "QuikTrip",
  "Casey's General Store",
  "Buc-ee's",
  "Other"
]

function getEstDateString() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

export default function ExpensesPage() {
  const { user } = useUser()
  const db = useFirestore()
  const { toast } = useToast()
  const [mounted, setMounted] = useState(false)
  
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [date, setDate] = useState("") 
  const [description, setDescription] = useState("")
  const [location, setLocation] = useState("")
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState("Other")
  const [selectedLoadId, setSelectedLoadId] = useState<string>("unassigned")

  // AI Extraction State
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractText, setExtractText] = useState("")
  const [extractImage, setExtractImage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  // Fuel specific state
  const [selectedTruckStop, setSelectedTruckStop] = useState("")
  const [manualTruckStopName, setManualTruckStopName] = useState("")
  const [selectedFuelTypes, setSelectedFuelTypes] = useState<string[]>([])
  const [dieselGallons, setDieselGallons] = useState("")
  const [dieselPumpPrice, setDieselPumpPrice] = useState("")
  const [dieselDiscountPrice, setDieselDiscountPrice] = useState("")
  const [defGallons, setDefGallons] = useState("")
  const [defPumpPrice, setDefPumpPrice] = useState("")
  const [reeferGallons, setReeferGallons] = useState("")
  const [reeferPumpPrice, setReeferPumpPrice] = useState("")
  const [reeferDiscountPrice, setReeferDiscountPrice] = useState("")

  useEffect(() => {
    setMounted(true)
    setDate(getEstDateString())
  }, [])

  const expensesQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "users", user.uid, "expenses")
  }, [db, user])

  const loadsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "users", user.uid, "loads")
  }, [db, user])

  const { data: expenses, isLoading } = useCollection<Expense>(expensesQuery)
  const { data: loads } = useCollection<Load>(loadsQuery)

  const sortedLoads = useMemo(() => {
    if (!loads) return []
    return [...loads].sort((a, b) => (b.endDate || "").localeCompare(a.endDate || ""))
  }, [loads])

  const isFuelCategory = category === "Fuel"
  const round = (num: number) => Math.round(num * 100) / 100

  const fuelTotals = useMemo(() => {
    if (!isFuelCategory) return null
    
    let dieselTotal = 0
    let dieselSavings = 0
    let defTotal = 0
    let reeferTotal = 0
    let reeferSavings = 0

    if (selectedFuelTypes.includes('diesel')) {
      const gal = parseFloat(dieselGallons) || 0
      const pPrice = parseFloat(dieselPumpPrice) || 0
      const dVal = parseFloat(dieselDiscountPrice)
      const dPrice = isNaN(dVal) || dVal === 0 ? pPrice : dVal
      dieselTotal = round(gal * dPrice)
      dieselSavings = round(gal * (pPrice - dPrice))
    }

    if (selectedFuelTypes.includes('def')) {
      const gal = parseFloat(defGallons) || 0
      const pPrice = parseFloat(defPumpPrice) || 0
      defTotal = round(gal * pPrice)
    }

    if (selectedFuelTypes.includes('reefer')) {
      const gal = parseFloat(reeferGallons) || 0
      const pPrice = parseFloat(reeferPumpPrice) || 0
      const dVal = parseFloat(reeferDiscountPrice)
      const dPrice = isNaN(dVal) || dVal === 0 ? pPrice : dVal
      reeferTotal = round(gal * dPrice)
      reeferSavings = round(gal * (pPrice - dPrice))
    }

    const driverPortion = round(dieselTotal + defTotal)
    return { dieselTotal, dieselSavings, defTotal, reeferTotal, reeferSavings, driverPortion }
  }, [isFuelCategory, selectedFuelTypes, dieselGallons, dieselPumpPrice, dieselDiscountPrice, defGallons, defPumpPrice, reeferGallons, reeferPumpPrice, reeferDiscountPrice])

  useEffect(() => {
    if (isFuelCategory && fuelTotals) {
      setAmount(fuelTotals.driverPortion.toFixed(2))
    }
  }, [isFuelCategory, fuelTotals])

  const handleSmartExtract = async () => {
    if (!extractText.trim() && !extractImage) {
      toast({ title: "Input Required", description: "Please take a photo, upload a receipt, or paste details.", variant: "destructive" })
      return
    }

    setIsExtracting(true)
    try {
      const result = await categorizeExpense({ 
        text: extractText || undefined,
        image: extractImage || undefined
      })
      
      if (result.amount) setAmount(result.amount.toString())
      if (result.date) setDate(result.date)
      if (result.description) setDescription(result.description)
      if (result.location) setLocation(result.location)
      if (result.category) setCategory(result.category)

      // Truck Stop Matching
      if (result.truckStop) {
        const stopNameLower = result.truckStop.toLowerCase();
        const foundStop = TRUCK_STOPS.find(s => 
          s.toLowerCase().includes(stopNameLower) || stopNameLower.includes(s.toLowerCase())
        );
        if (foundStop) {
          setSelectedTruckStop(foundStop);
        } else {
          setSelectedTruckStop("Other");
          setManualTruckStopName(result.truckStop);
        }
      }

      // Fuel specific handling
      if (result.category === 'Fuel' && result.fuelDetails) {
        if (result.fuelDetails.fuelTypes) {
          setSelectedFuelTypes(result.fuelDetails.fuelTypes)
        }
        if (result.fuelDetails.diesel) {
          setDieselGallons(result.fuelDetails.diesel.gallons?.toString() || "")
          setDieselPumpPrice(result.fuelDetails.diesel.pumpPrice?.toString() || "")
          setDieselDiscountPrice(result.fuelDetails.diesel.discountPrice?.toString() || "")
        }
        if (result.fuelDetails.def) {
          setDefGallons(result.fuelDetails.def.gallons?.toString() || "")
          setDefPumpPrice(result.fuelDetails.def.pumpPrice?.toString() || "")
        }
        if (result.fuelDetails.reefer) {
          setReeferGallons(result.fuelDetails.reefer.gallons?.toString() || "")
          setReeferPumpPrice(result.fuelDetails.reefer.pumpPrice?.toString() || "")
          setReeferDiscountPrice(result.fuelDetails.reefer.discountPrice?.toString() || "")
        }
      }

      toast({ 
        title: "Smart Extraction Complete", 
        description: "Review and save the auto-filled details.",
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

  const handleSaveExpense = () => {
    if (!user || !db) return
    const parsedAmount = round(parseFloat(amount));
    const finalTruckStop = selectedTruckStop === "Other" ? manualTruckStopName : selectedTruckStop

    const dPump = parseFloat(dieselPumpPrice) || 0
    const dDisc = parseFloat(dieselDiscountPrice)
    const finalDieselDiscount = isNaN(dDisc) || dDisc === 0 ? dPump : dDisc

    const rPump = parseFloat(reeferPumpPrice) || 0
    const rDisc = parseFloat(reeferDiscountPrice)
    const finalReeferDiscount = isNaN(rDisc) || rDisc === 0 ? rPump : rDisc

    const targetLoad = loads?.find(l => l.id === selectedLoadId)

    const expenseData: Partial<Expense> = {
      description, 
      location, 
      amount: parsedAmount, 
      date, 
      category,
      loadId: selectedLoadId === "unassigned" ? "" : selectedLoadId,
      loadNumber: selectedLoadId === "unassigned" ? "" : (targetLoad?.loadNumber || targetLoad?.id.substring(0, 6)),
      truckStop: category === "Fuel" ? finalTruckStop : "",
      fuelTypes: category === "Fuel" ? selectedFuelTypes : [],
      dieselGallons: category === "Fuel" ? (parseFloat(dieselGallons) || 0) : 0,
      dieselPumpPrice: category === "Fuel" ? dPump : 0,
      dieselDiscountPrice: category === "Fuel" ? finalDieselDiscount : 0,
      dieselAmount: category === "Fuel" ? (fuelTotals?.dieselTotal || 0) : 0,
      dieselSavings: category === "Fuel" ? (fuelTotals?.dieselSavings || 0) : 0,
      defGallons: category === "Fuel" ? (parseFloat(defGallons) || 0) : 0,
      defPumpPrice: category === "Fuel" ? (parseFloat(defPumpPrice) || 0) : 0,
      defAmount: category === "Fuel" ? (fuelTotals?.defTotal || 0) : 0,
      reeferGallons: category === "Fuel" ? (parseFloat(reeferGallons) || 0) : 0,
      reeferPumpPrice: category === "Fuel" ? rPump : 0,
      reeferDiscountPrice: category === "Fuel" ? finalReeferDiscount : 0,
      reeferAmount: category === "Fuel" ? (fuelTotals?.reeferTotal || 0) : 0,
      reeferSavings: category === "Fuel" ? (fuelTotals?.reeferSavings || 0) : 0,
      isRecurring: false,
      isTaxDeductible: true
    }

    if (editingExpense) {
      updateDocumentNonBlocking(doc(db, "users", user.uid, "expenses", editingExpense.id), expenseData)
      toast({ title: "Expense Updated" })
    } else {
      const ref = collection(db, "users", user.uid, "expenses")
      const newRef = doc(ref)
      setDocumentNonBlocking(newRef, { ...expenseData, id: newRef.id }, { merge: true })
      toast({ title: "Expense Saved" })
    }
    resetForm()
  }

  const resetForm = () => {
    setEditingExpense(null); setDate(getEstDateString()); setDescription(""); setLocation(""); setAmount("");
    setCategory("Other"); setSelectedTruckStop(""); setManualTruckStopName(""); setSelectedLoadId("unassigned");
    setSelectedFuelTypes([]); setDieselGallons(""); setDieselPumpPrice(""); setDieselDiscountPrice("");
    setDefGallons(""); setDefPumpPrice(""); setReeferGallons(""); setReeferPumpPrice(""); setReeferDiscountPrice("");
    setExtractText(""); setExtractImage(null);
  }

  const handleDeleteExpense = (expenseId: string) => {
    if (!user || !db) return
    deleteDocumentNonBlocking(doc(db, "users", user.uid, "expenses", expenseId))
    toast({ title: "Expense Deleted" })
  }

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense); setDate(expense.date); setDescription(expense.description || ""); setLocation(expense.location || "");
    setAmount(expense.amount.toString()); setCategory(expense.category);
    setSelectedLoadId(expense.loadId || "unassigned");
    if (expense.truckStop) {
      if (TRUCK_STOPS.includes(expense.truckStop)) { setSelectedTruckStop(expense.truckStop); }
      else { setSelectedTruckStop("Other"); setManualTruckStopName(expense.truckStop); }
    }
    setSelectedFuelTypes(expense.fuelTypes || []); setDieselGallons(expense.dieselGallons?.toString() || "");
    setDieselPumpPrice(expense.dieselPumpPrice?.toString() || ""); setDieselDiscountPrice(expense.dieselDiscountPrice?.toString() || "");
    setDefGallons(expense.defGallons?.toString() || ""); setDefPumpPrice(expense.defPumpPrice?.toString() || "");
    setReeferGallons(expense.reeferGallons?.toString() || ""); setReeferPumpPrice(expense.reeferPumpPrice?.toString() || "");
    setReeferDiscountPrice(expense.reeferDiscountPrice?.toString() || "");
    
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (!mounted) return <div className="flex h-svh items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-background">
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border px-4 md:px-6 transition-[width,height] ease-linear">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <h1 className="text-lg md:text-xl font-bold font-headline truncate text-primary uppercase tracking-tighter">HaulSense By Turbo</h1>
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6 overflow-x-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1 border-border/50">
              <CardHeader className="p-4 flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-black uppercase tracking-widest">{editingExpense ? "Edit Expense" : "Add Expense"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-4 pt-0">
                {/* AI Smart Extract Section */}
                {!editingExpense && (
                  <div className="bg-primary/5 p-4 rounded-2xl border border-primary/20 space-y-4 mb-2 overflow-hidden">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Smart Extract</Label>
                      </div>
                      {isExtracting && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
                    </div>

                    <div className="space-y-4">
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
                          <p className="text-[9px] font-bold text-muted-foreground mt-1 text-center">Gallery</p>
                          <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept="image/*" 
                            onChange={handleFileChange} 
                          />
                        </div>
                        <Textarea 
                          placeholder="Or paste details..." 
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
                            Extracting...
                          </>
                        ) : (
                          <>
                            <Zap className="h-3.5 w-3.5" />
                            Smart Extract
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="date">Date</Label>
                    <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="category">Category</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Fuel", "Maintenance", "Tolls", "Food", "Insurance", "Cash Advance", "Other"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground/60 tracking-widest">Assign to Load (Optional)</Label>
                    <Select value={selectedLoadId} onValueChange={setSelectedLoadId}>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {sortedLoads.map(l => (
                          <SelectItem key={l.id} value={l.id}>
                            Load #{l.loadNumber || l.id.substring(0, 6)} ({l.origin.split(',')[0]} → {l.destination.split(',')[0]})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="description">Description</Label>
                    <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What was this for?" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="location">Location</Label>
                    <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, State" />
                  </div>
                </div>

                {isFuelCategory && (
                  <div className="space-y-4 p-4 bg-primary/5 rounded-2xl border border-primary/20 shadow-inner">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Truck Stop</Label>
                      <Select value={selectedTruckStop} onValueChange={setSelectedTruckStop}>
                        <SelectTrigger className="bg-background"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>{TRUCK_STOPS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                      {selectedTruckStop === "Other" && (
                        <Input 
                          placeholder="Enter truck stop name" 
                          value={manualTruckStopName} 
                          onChange={(e) => setManualTruckStopName(e.target.value)} 
                          className="mt-2 text-xs"
                        />
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-black text-muted-foreground/60 tracking-widest">Fuel Types</Label>
                      <div className="flex flex-wrap gap-3">
                        {['diesel', 'def', 'reefer'].map(t => (
                          <div key={t} className="flex items-center gap-2">
                            <Checkbox 
                              id={`fuel-${t}`} 
                              checked={selectedFuelTypes.includes(t)} 
                              onCheckedChange={() => setSelectedFuelTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])} 
                            />
                            <label htmlFor={`fuel-${t}`} className="text-[10px] uppercase cursor-pointer select-none font-black tracking-widest">{t}</label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator className="bg-primary/10" />

                    <div className="space-y-4">
                      {selectedFuelTypes.includes('diesel') && (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="col-span-2 text-[9px] font-black uppercase text-primary tracking-[0.2em]">Diesel</div>
                          <Input type="number" placeholder="Gal" value={dieselGallons} onChange={(e) => setDieselGallons(e.target.value)} className="h-8 text-xs" />
                          <Input type="number" placeholder="Pump" value={dieselPumpPrice} onChange={(e) => setDieselPumpPrice(e.target.value)} className="h-8 text-xs" />
                          <Input type="number" placeholder="Discount Price" value={dieselDiscountPrice} onChange={(e) => setDieselDiscountPrice(e.target.value)} className="col-span-2 h-8 text-xs border-accent/50 bg-background" />
                        </div>
                      )}
                      {selectedFuelTypes.includes('def') && (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="col-span-2 text-[9px] font-black uppercase text-accent tracking-[0.2em]">DEF</div>
                          <Input type="number" placeholder="Gal" value={defGallons} onChange={(e) => setDefGallons(e.target.value)} className="h-8 text-xs" />
                          <Input type="number" placeholder="Pump" value={defPumpPrice} onChange={(e) => setDefPumpPrice(e.target.value)} className="h-8 text-xs" />
                        </div>
                      )}
                      {selectedFuelTypes.includes('reefer') && (
                        <div className="grid grid-cols-2 gap-2 p-2 bg-primary/10 rounded-xl border border-primary/20 shadow-sm">
                          <div className="col-span-2 text-[9px] font-black uppercase text-primary tracking-[0.2em]">Reefer <span className="text-[7px] bg-primary/20 px-1 rounded ml-1">CO. PAID</span></div>
                          <Input type="number" placeholder="Gal" value={reeferGallons} onChange={(e) => setReeferGallons(e.target.value)} className="h-8 text-xs bg-background" />
                          <Input type="number" placeholder="Pump" value={reeferPumpPrice} onChange={(e) => setReeferPumpPrice(e.target.value)} className="h-8 text-xs bg-background" />
                          <Input type="number" placeholder="Discount Price" value={reeferDiscountPrice} onChange={(e) => setReeferDiscountPrice(e.target.value)} className="col-span-2 h-8 text-xs border-accent/50 bg-background" />
                        </div>
                      )}
                    </div>

                    {fuelTotals && fuelTotals.driverPortion > 0 && (
                      <div className="mt-2 p-3 bg-primary text-primary-foreground rounded-xl shadow-md flex justify-between items-center">
                        <span className="text-[10px] font-black uppercase tracking-widest">Net Billed To Driver:</span>
                        <span className="text-lg font-black font-headline tracking-tighter">${fuelTotals.driverPortion.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-1">
                  <Label htmlFor="amount">{isFuelCategory ? "Net Billed ($)" : "Amount ($)"}</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="pl-9 h-11 font-black text-lg" />
                  </div>
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <Button className="w-full bg-primary hover:bg-primary/90 h-11 font-black uppercase tracking-widest text-xs" onClick={handleSaveExpense}>
                    {editingExpense ? "Update Expense" : "Save Expense"}
                  </Button>
                  {editingExpense && <Button variant="ghost" onClick={resetForm} className="h-10 font-bold uppercase text-[10px] tracking-widest">Cancel</Button>}
                </div>
              </CardContent>
            </Card>

            <div className="lg:col-span-2">
              <Card className="border-border/50 h-full overflow-hidden shadow-sm">
                <CardHeader className="p-4 flex flex-row items-center justify-between border-b border-border/50 bg-muted/20">
                  <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-primary" />
                    Expense History
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {isLoading ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/30">
                          <tr className="border-b text-[9px] font-black uppercase text-muted-foreground/70 tracking-widest">
                            <th className="p-4 text-left">Date</th>
                            <th className="p-4 text-left">Details</th>
                            <th className="p-4 text-right">Amount</th>
                            <th className="p-4 text-right"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {(expenses || []).sort((a,b) => b.date.localeCompare(a.date)).map(e => (
                            <tr key={e.id} className="border-b hover:bg-muted/30 transition-colors group">
                              <td className="p-4 whitespace-nowrap text-[10px] font-bold text-muted-foreground">{e.date}</td>
                              <td className="p-4">
                                <div className="font-black text-sm uppercase tracking-tight text-foreground">{e.category}</div>
                                {e.loadNumber && (
                                  <div className="flex items-center gap-1 mt-1 text-[9px] font-black text-primary uppercase tracking-tighter">
                                    <Link2 className="h-2.5 w-2.5" />
                                    Load #{e.loadNumber}
                                  </div>
                                )}
                                <div className="flex flex-col gap-1 mt-1.5">
                                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                                    {e.truckStop && <span className="font-black text-primary/80 uppercase tracking-tighter">{e.truckStop}</span>}
                                    {e.location && <span>• {e.location}</span>}
                                  </div>
                                  
                                  {e.category === 'Fuel' && (
                                    <div className="space-y-1.5 mt-1.5 border-l-2 border-primary/20 pl-3">
                                      {e.dieselGallons && (
                                        <div className="flex flex-col">
                                          <div className="text-[10px] font-black text-primary/90 flex items-center gap-1">
                                            Diesel: {e.dieselGallons} gal
                                          </div>
                                          <div className="flex items-center gap-2 text-[9px] font-bold text-muted-foreground">
                                            {e.dieselDiscountPrice && e.dieselDiscountPrice < (e.dieselPumpPrice || 0) ? (
                                              <>
                                                <span className="line-through opacity-50">Pump: ${e.dieselPumpPrice?.toFixed(3)}</span>
                                                <ChevronRight className="h-2 w-2" />
                                                <span className="font-black text-accent">Paid: ${e.dieselDiscountPrice?.toFixed(3)}</span>
                                                {e.dieselSavings && e.dieselSavings > 0 && (
                                                  <Badge variant="outline" className="text-[8px] h-3.5 px-1.5 border-accent/30 bg-accent/5 text-accent font-black tracking-tighter">
                                                    SAVE ${e.dieselSavings.toFixed(2)}
                                                  </Badge>
                                                )}
                                              </>
                                            ) : (
                                              <span className="font-bold text-accent">Price: ${e.dieselPumpPrice?.toFixed(3)}</span>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="p-4 text-right">
                                <div className="font-black text-destructive text-sm font-headline">-${e.amount.toFixed(2)}</div>
                              </td>
                              <td className="p-4 text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"><MoreHorizontal className="h-4 w-4" /></Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-40 font-bold uppercase text-[10px]">
                                    <DropdownMenuItem onClick={() => handleEditExpense(e)} className="gap-2"><Edit className="h-3.5 w-3.5" /> Edit Expense</DropdownMenuItem>
                                    <DropdownMenuItem className="text-destructive gap-2" onClick={() => handleDeleteExpense(e.id)}><Trash2 className="h-3.5 w-3.5" /> Delete Expense</DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
