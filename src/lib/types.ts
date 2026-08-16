export interface Stop {
  id: string;
  location: string;
  date: string;
  isPickup?: boolean;
  notes?: string;
}

export interface CustomDeduction {
  id: string;
  name: string;
  amount: number;
  type: 'flat' | 'percentage' | 'per_mile';
  frequency?: 'pay_period' | 'monthly';
}

export interface Load {
  id: string;
  loadNumber?: string;
  origin: string;
  destination: string;
  mileage: number;
  rateType: 'flat' | 'per_mile' | 'percentage';
  rateValue: number; // The base value (e.g., 2.50 for per_mile, 10 for percentage)
  percentageBase?: number; // Base amount for percentage calculation
  fuelSurchargeType?: 'none' | 'flat' | 'per_mile';
  fuelSurchargeValue?: number;
  fuelSurcharge?: number; // The calculated total surcharge amount
  rate: number; // The final calculated total gross revenue (Base + Surcharge)
  startDate: string;
  endDate: string;
  status: 'upcoming' | 'completed' | 'active';
  stops?: Stop[];
  estimatedFuelCost?: number;
  estimatedFuelUsed?: number;
  isLandstar?: boolean;
  landstarTrailerType?: string;
  landstarCustomPercent?: string;
  landstarLinehaul?: number;
  landstarGross?: number;
  landstarCut?: number;
  landstarBcoShare?: number;

  landstarFsc?: number;
  landstarTarp?: number;
  landstarDetention?: number;
  landstarLayover?: number;
  landstarLoadingUnloading?: number;
  landstarStopOff?: number;
  landstarFsc100?: boolean;
  landstarTarp100?: boolean;
  landstarDetention100?: boolean;
  landstarLayover100?: boolean;
  landstarLoadingUnloading100?: boolean;
  landstarStopOff100?: boolean;
  landstarCustomAccessorials?: Array<{
    id: string;
    name: string;
    amount: string;
    paidAt100: boolean;
  }>;
}

export interface Expense {
  id: string;
  description: string;
  location?: string;
  amount: number;
  date: string;
  category: string;
  truckStop?: string;
  loadId?: string; // Reference to associated load
  loadNumber?: string; // Denormalized load number for display
  deductionsSuggested?: string[];
  explanation?: string;
  isRecurring?: boolean;
  isTaxDeductible?: boolean;
  fuelTypes?: string[]; 
  // Diesel
  dieselGallons?: number;
  dieselPumpPrice?: number;
  dieselDiscountPrice?: number;
  dieselSavings?: number;
  // DEF
  defGallons?: number;
  defPumpPrice?: number;
  // Reefer
  reeferGallons?: number;
  reeferPumpPrice?: number;
  reeferDiscountPrice?: number;
  reeferSavings?: number;
  // Totals
  defAmount?: number;
  reeferAmount?: number;
  dieselAmount?: number;
}

export interface AppSettings {
  id: string;
  displayName?: string;
  truckId?: string;
  theme?: 'light' | 'dark' | 'system';
  payPeriodStartDay: string;
  payPeriodStartTime?: string;
  payPeriodTimeZone: string;
  defaultTaxRatePercent: number;
  defaultBrokerFeePercent: number;
  defaultFuelSurchargeType: 'none' | 'flat' | 'per_mile';
  defaultFuelSurchargeValue: number;
  // New Default Rate Fields
  useDefaultRate?: boolean;
  defaultRateType?: 'flat' | 'per_mile' | 'percentage';
  defaultRateValue?: number;
  autoPerDiem: boolean;
  iftaCalculation: boolean;
  customDeductions?: CustomDeduction[];
  updatedAt?: string;
  // Dynamic FSC Fields
  eiaApiKey?: string;
  currentFuelPrice?: number;
}
