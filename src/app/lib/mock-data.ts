import { Load, Expense } from '@/lib/types';

export const MOCK_LOADS: Load[] = [
  {
    id: '1',
    origin: 'Chicago, IL',
    destination: 'Denver, CO',
    mileage: 1000,
    rateType: 'flat',
    rateValue: 2500,
    rate: 2500,
    startDate: '2024-05-13',
    endDate: '2024-05-15',
    status: 'completed'
  },
  {
    id: '2',
    origin: 'Denver, CO',
    destination: 'Salt Lake City, UT',
    mileage: 500,
    rateType: 'flat',
    rateValue: 1200,
    rate: 1200,
    startDate: '2024-05-16',
    endDate: '2024-05-17',
    status: 'completed'
  },
  {
    id: '3',
    origin: 'Salt Lake City, UT',
    destination: 'Seattle, WA',
    mileage: 800,
    rateType: 'flat',
    rateValue: 2100,
    rate: 2100,
    startDate: '2024-05-20',
    endDate: '2024-05-22',
    status: 'active'
  },
  {
    id: '4',
    origin: 'Seattle, WA',
    destination: 'Portland, OR',
    mileage: 180,
    rateType: 'flat',
    rateValue: 600,
    rate: 600,
    startDate: '2024-05-23',
    endDate: '2024-05-23',
    status: 'upcoming'
  }
];

export const MOCK_EXPENSES: Expense[] = [
  {
    id: 'e1',
    description: 'Fuel Refill - Love\'s',
    amount: 450.00,
    date: '2024-05-14',
    category: 'Fuel',
    deductionsSuggested: ['Business Fuel Deduction']
  },
  {
    id: 'e2',
    description: 'Oil Change',
    amount: 120.00,
    date: '2024-05-10',
    category: 'Maintenance',
    deductionsSuggested: ['Maintenance & Repairs']
  },
  {
    id: 'e3',
    description: 'Monthly Insurance',
    amount: 800.00,
    date: '2024-05-01',
    category: 'Insurance',
    isRecurring: true
  }
];