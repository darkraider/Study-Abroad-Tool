'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Image from 'next/image' // Ensure Image is imported
import background from '../../../public/backgrounds/budget-bg.webp' // Import the specific background

import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Trash2, Pencil, XCircle, PlusCircle } from 'lucide-react' // Icons for actions
import Layout from '@/app/components/layout'
import { getDb, STORE_NAMES } from '@/lib/db'

// --- Type Definitions ---
type ExpenseItem = {
  id: string
  item: string
  cost: number
}

type ExpenseCategory = {
  id: number // Keep as number for existing categories, can be string for new ones if needed
  category: string
  type: 'expense' | 'asset'
  items: ExpenseItem[]
}

// --- Constants ---
const DEFAULT_EXPENSE_CATEGORIES_NAMES = ['Housing', 'Transportation', 'Program Fees'] // Renamed for clarity
const DEFAULT_ASSET_CATEGORIES_NAMES = ['Scholarships'] // Renamed for clarity
const MISCELLANEOUS_CATEGORY_NAME = 'Miscellaneous'
const MAX_ITEM_COST = 25000

// --- Helper Function ---
const formatCurrency = (amount: number | string | undefined | null): string => {
  const num = Number(amount) || 0
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

// --- Budget Builder Types (Ensure these are defined before BudgetBuilderModal) ---
type BuilderStep = {
  title: string;
  description: string; 
  fields: BuilderField[];
};

type BuilderField = {
  id: string;
  label: string;
  type: 'select' | 'number' | 'info';
  options?: { value: string; label: string }[];
  placeholder?: string;
  defaultValue?: string | number;
  isCostField?: boolean;
  max?: number; // Added for input validation
};

type BuilderFormData = {
  [key: string]: string | number | undefined;
};

// --- Budget Builder Modal Component ---
interface BudgetBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (builtItems: { categoryName: string; items: Omit<ExpenseItem, 'id'>[] }[]) => void;
}

const BudgetBuilderModal: React.FC<BudgetBuilderModalProps> = ({ isOpen, onClose, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<BuilderFormData>({});
  const [stepErrors, setStepErrors] = useState<{ [key: string]: string }>({});

  const builderSteps: BuilderStep[] = [
    {
      title: 'Housing & Meals',
      description: 'Estimate your total accommodation and food expenses for the entire program duration.',
      fields: [
        { id: 'housingArrangement', label: 'How is your housing arranged?', type: 'select', options: [{ value: 'program_fee', label: 'Included in Program Fee' }, { value: 'separate', label: 'Arranged and Paid Separately' }], placeholder: 'Select arrangement' },
        { id: 'housingTypeSeparate', label: 'If paying separately, what type of housing?', type: 'select', options: [{ value: 'Dorms', label: 'Dorms' }, { value: 'Apartment', label: 'Apartment' }, { value: 'Homestay', label: 'Homestay' }, { value: 'Other', label: 'Other' }], placeholder: 'Select type' },
        { id: 'totalRentSeparate', label: 'Est. Total Rent for Program (if separate, $):', type: 'number', placeholder: 'e.g., 2000', isCostField: true, max: 50000 },
        
        { id: 'mealPlanProvided', label: 'Will a meal plan be provided?', type: 'select', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }], placeholder: 'Select an option' },
        { id: 'totalFoodCostNoMealPlan', label: 'Est. Total Food Costs for Program (if no meal plan, $):', type: 'number', placeholder: 'e.g., 1200', isCostField: true, max: 10000 },

        { id: 'planToCook', label: 'Do you plan to cook for yourself often?', type: 'select', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }], placeholder: 'Select an option' },
        { id: 'needsUtensils', label: 'If cooking, will you need to buy kitchen utensils?', type: 'select', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }], placeholder: 'Select an option' },
        { id: 'utensilsCost', label: 'Est. Kitchen Utensils Cost ($):', type: 'number', placeholder: 'e.g., 50', isCostField: true, max: 300 },

        { id: 'beddingProvided', label: 'Will bedding be provided?', type: 'select', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }], placeholder: 'Select an option' },
        { id: 'beddingCost', label: 'Est. Bedding Cost (if not provided, $):', type: 'number', placeholder: 'e.g., 75', isCostField: true, max: 250 },
        
        { id: 'totalLaundryCost', label: 'Est. Total Laundry Cost for Program ($):', type: 'number', placeholder: 'e.g., 80', isCostField: true, max: 500 },
      ],
    },
    {
      title: 'Program Fees & Academic Costs',
      description: 'Detail your main program fee and any academic expenses not covered by it for the entire program.',
      fields: [
        { id: 'programFeeTotal', label: 'Total Program Fee Amount ($):', type: 'number', placeholder: 'e.g., 5000', isCostField: true, max: 100000 },
        { id: 'programFeeIncludesTuition', label: 'Does this Program Fee include Tuition?', type: 'select', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }], placeholder: 'Select an option' },
        { id: 'separateTuitionCost', label: 'Est. Separate Total Tuition Cost (if not included, $):', type: 'number', placeholder: 'e.g., 3000', isCostField: true, max: 75000 },
        
        // REMOVED: Redundant housing question. Housing arrangement is handled in Step 1.
        // The user will know if their program fee covers housing from answering Step 1.
        // If housingArrangement was 'program_fee', then programFeeTotal implicitly includes it.
        
        { id: 'programFeeIncludesInsurance', label: 'Does Program Fee include Health/Travel Insurance?', type: 'select', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }], placeholder: 'Select an option' },
        { id: 'separateInsuranceCost', label: 'Est. Separate Total Insurance Cost (if not included, $):', type: 'number', placeholder: 'e.g., 300', isCostField: true, max: 5000 },

        { id: 'textbooksSuppliesCost', label: 'Est. Total Textbooks & Academic Supplies Cost ($):', type: 'number', placeholder: 'e.g., 200', isCostField: true, max: 1000 },
      ],
    },
    {
      title: 'Travel & Transportation',
      description: 'Estimate your total costs for flights and local transportation during your program.',
      fields: [
        { id: 'internationalAirfare', label: 'Est. International Airfare (round-trip, $):', type: 'number', placeholder: 'e.g., 1000', isCostField: true, max: 5000 },
        { id: 'localTransportTotalCost', label: 'Est. Total Local Transport Cost for Program ($):', type: 'number', placeholder: 'e.g., 300', isCostField: true, max: 2000 },
      ],
    },
    {
      title: 'Miscellaneous Personal Costs',
      description: 'Consider total one-time setup costs and other personal expenses for your entire trip.',
      fields: [
        { id: 'passportCost', label: 'Passport Cost (if applicable, $):', type: 'number', placeholder: 'e.g., 130', isCostField: true, max: 300 },
        { id: 'visaCost', label: 'Visa Cost (if needed, $):', type: 'number', placeholder: 'e.g., 160', isCostField: true, max: 1000 },
        { id: 'immunizationsCost', label: 'Immunizations Cost (if needed, $):', type: 'number', placeholder: 'e.g., 100', isCostField: true, max: 1000 },
        { id: 'cellPhonePlanTotalCost', label: 'Est. Total Cell Plan/SIM Cost for Program ($):', type: 'number', placeholder: 'e.g., 150', isCostField: true, max: 500 },
        { id: 'luggageCost', label: 'Luggage Cost (if new needed, $):', type: 'number', placeholder: 'e.g., 100', isCostField: true, max: 500 },
        { id: 'personalSpendingTotal', label: 'Est. Total Personal Spending Money (souvenirs, entertainment, etc., $):', type: 'number', placeholder: 'e.g., 800', isCostField: true, max: 10000 },
        { id: 'additionalTravelBudgetTotal', label: 'Total Budget for Additional Travel (if planned, $):', type: 'number', placeholder: 'e.g., 500', isCostField: true, max: 10000 },
      ],
    },
  ];

  const currentFields = builderSteps[currentStep].fields;

  const handleInputChange = (id: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [id]: value }));
    if (stepErrors[id]) {
      setStepErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[id];
        return newErrors;
      });
    }
  };

  const validateStep = () => {
    const errors: { [key: string]: string } = {};
    currentFields.forEach(field => {
        let isVisible = true;
        // Visibility logic based on updated field IDs and conditions
        if (field.id === 'housingTypeSeparate' || field.id === 'totalRentSeparate') isVisible = formData.housingArrangement === 'separate';
        else if (field.id === 'totalFoodCostNoMealPlan') isVisible = formData.mealPlanProvided === 'no';
        else if (field.id === 'needsUtensils') isVisible = formData.planToCook === 'yes';
        else if (field.id === 'utensilsCost') isVisible = formData.planToCook === 'yes' && formData.needsUtensils === 'yes';
        else if (field.id === 'beddingCost') isVisible = formData.beddingProvided === 'no';
        else if (field.id === 'separateTuitionCost') isVisible = formData.programFeeIncludesTuition === 'no';
        else if (field.id === 'separateInsuranceCost') isVisible = formData.programFeeIncludesInsurance === 'no';

        if (isVisible && field.type === 'number') {
            const value = formData[field.id];
            const numValue = Number(value);
            if (value !== undefined && value !== '') {
                if (isNaN(numValue) || numValue < 0) {
                    errors[field.id] = 'Must be a valid positive number.';
                } else if (field.max !== undefined && numValue > field.max) {
                    errors[field.id] = `Value cannot exceed ${field.max}.`;
                }
            }
        }
    });
    setStepErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    if (currentStep < builderSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleFinish = () => {
    if (!validateStep()) return;
    const builtItems: { categoryName: string; items: Omit<ExpenseItem, 'id'>[] }[] = [];

    // Housing Items - using new total cost field IDs
    const housingItems: Omit<ExpenseItem, 'id'>[] = [];
    if (formData.housingArrangement === 'separate' && Number(formData.totalRentSeparate) > 0) {
        housingItems.push({ item: `${formData.housingTypeSeparate || 'External'} Housing (Total)`, cost: Number(formData.totalRentSeparate) });
    }
    if (formData.mealPlanProvided === 'no' && Number(formData.totalFoodCostNoMealPlan) > 0) {
      housingItems.push({ item: 'Food Costs (Total, No Meal Plan)', cost: Number(formData.totalFoodCostNoMealPlan) });
    }
    if (formData.planToCook === 'yes' && formData.needsUtensils === 'yes' && Number(formData.utensilsCost) > 0) {
      housingItems.push({ item: 'Kitchen Utensils', cost: Number(formData.utensilsCost) });
    }
    if (formData.beddingProvided === 'no' && Number(formData.beddingCost) > 0) {
      housingItems.push({ item: 'Bedding', cost: Number(formData.beddingCost) });
    }
    if (Number(formData.totalLaundryCost) > 0) housingItems.push({ item: 'Laundry (Total)', cost: Number(formData.totalLaundryCost) });
    if (housingItems.length > 0) builtItems.push({ categoryName: 'Housing', items: housingItems });

    // Program Fee Related Items
    const programFeeItems: Omit<ExpenseItem, 'id'>[] = [];
    if (Number(formData.programFeeTotal) > 0) programFeeItems.push({ item: 'Main Program Fee (Total)', cost: Number(formData.programFeeTotal) });
    if (formData.programFeeIncludesTuition === 'no' && Number(formData.separateTuitionCost) > 0) {
      programFeeItems.push({ item: 'Separate Tuition (Total)', cost: Number(formData.separateTuitionCost) });
    }
    if (formData.programFeeIncludesInsurance === 'no' && Number(formData.separateInsuranceCost) > 0) {
      programFeeItems.push({ item: 'Separate Insurance (Total)', cost: Number(formData.separateInsuranceCost) });
    }
    if (Number(formData.textbooksSuppliesCost) > 0) programFeeItems.push({ item: 'Textbooks & Supplies (Total)', cost: Number(formData.textbooksSuppliesCost) });
    if (programFeeItems.length > 0) builtItems.push({ categoryName: 'Program Fees', items: programFeeItems });

    // Transportation Items
    const transportItems: Omit<ExpenseItem, 'id'>[] = [];
    if (Number(formData.internationalAirfare) > 0) transportItems.push({ item: 'International Airfare', cost: Number(formData.internationalAirfare) });
    if (Number(formData.localTransportTotalCost) > 0) transportItems.push({ item: 'Local Transport (Total)', cost: Number(formData.localTransportTotalCost) });
    if (transportItems.length > 0) builtItems.push({ categoryName: 'Transportation', items: transportItems });
    
    // Miscellaneous Items - using new total cost field IDs
    const miscItems: Omit<ExpenseItem, 'id'>[] = [];
    if (Number(formData.passportCost) > 0) miscItems.push({ item: 'Passport', cost: Number(formData.passportCost) });
    if (Number(formData.visaCost) > 0) miscItems.push({ item: 'Visa', cost: Number(formData.visaCost) });
    if (Number(formData.immunizationsCost) > 0) miscItems.push({ item: 'Immunizations', cost: Number(formData.immunizationsCost) });
    if (Number(formData.cellPhonePlanTotalCost) > 0) miscItems.push({ item: 'Intl. Cell Plan/SIM (Total)', cost: Number(formData.cellPhonePlanTotalCost) });
    if (Number(formData.luggageCost) > 0) miscItems.push({ item: 'Luggage', cost: Number(formData.luggageCost) });
    if (Number(formData.personalSpendingTotal) > 0) miscItems.push({ item: 'Personal Spending (Total)', cost: Number(formData.personalSpendingTotal) });
    if (Number(formData.additionalTravelBudgetTotal) > 0) miscItems.push({ item: 'Additional Travel (Total)', cost: Number(formData.additionalTravelBudgetTotal) });
    if (miscItems.length > 0) builtItems.push({ categoryName: MISCELLANEOUS_CATEGORY_NAME, items: miscItems });

    onComplete(builtItems);
    handleCloseModal();
  };
  
  const handleCloseModal = () => {
    setFormData({});
    setCurrentStep(0);
    setStepErrors({});
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleCloseModal(); }}>
      <DialogContent className="sm:max-w-lg bg-white dark:bg-gray-800">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-gray-100">Budget Builder - {builderSteps[currentStep].title} ({currentStep + 1}/{builderSteps.length})</DialogTitle>
          <DialogDescription className="text-sm text-gray-600 dark:text-gray-400">{builderSteps[currentStep].description}</DialogDescription>
        </DialogHeader>
        {/* Ensure this div has overflow-y-auto and padding for scrollbar */}
        <div className="custom-scrollbar grid gap-4 py-4 max-h-[60vh] overflow-y-auto px-4">
          {currentFields.map(field => {
            let shouldRender = true;
            if (field.id === 'housingTypeSeparate' || field.id === 'totalRentSeparate') shouldRender = formData.housingArrangement === 'separate';
            else if (field.id === 'totalFoodCostNoMealPlan') shouldRender = formData.mealPlanProvided === 'no';
            else if (field.id === 'needsUtensils') shouldRender = formData.planToCook === 'yes';
            else if (field.id === 'utensilsCost') shouldRender = formData.planToCook === 'yes' && formData.needsUtensils === 'yes';
            else if (field.id === 'beddingCost') shouldRender = formData.beddingProvided === 'no';
            else if (field.id === 'separateTuitionCost') shouldRender = formData.programFeeIncludesTuition === 'no';
            else if (field.id === 'separateInsuranceCost') shouldRender = formData.programFeeIncludesInsurance === 'no';

            if (!shouldRender) return null;

            return (
              <div key={field.id} className="space-y-2">
                <Label htmlFor={field.id} className="text-gray-700 dark:text-gray-300">{field.label}</Label>
                {field.type === 'select' && (
                  <Select 
                    value={String(formData[field.id] || field.defaultValue || '')}
                    onValueChange={(value) => handleInputChange(field.id, value)}
                  >
                    <SelectTrigger id={field.id} className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                      <SelectValue placeholder={field.placeholder || "Select an option"} />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-800 dark:text-white dark:border-gray-700">
                      {field.options?.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                {field.type === 'number' && (
                  <Input
                    id={field.id}
                    type="number"
                    placeholder={field.placeholder || "0.00"}
                    value={String(formData[field.id] || field.defaultValue || '')}
                    onChange={(e) => handleInputChange(field.id, e.target.value)}
                    className={`bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 ${field.isCostField ? 'font-medium' : ''}`}
                    min="0" // Min value
                    max={field.max !== undefined ? String(field.max) : undefined} // Max value
                    step="0.01" // Step for currency
                  />
                )}
                {stepErrors[field.id] && <p className="text-xs text-red-500 dark:text-red-400">{stepErrors[field.id]}</p>}
              </div>
            );
          })}
        </div>
        <DialogFooter>
          {currentStep > 0 && <Button type="button" variant="outline" onClick={handlePrevious}>Previous</Button>}
          {currentStep < builderSteps.length - 1 ? (
            <Button type="button" onClick={handleNext}>Next</Button>
          ) : (
            <Button type="button" onClick={handleFinish}>Finish & Add to Budget</Button>
          )}
           <DialogClose asChild>
            <Button type="button" variant="ghost" onClick={handleCloseModal}>Cancel</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// --- Main BudgetSheet Component ---
const BudgetSheet = () => {
  // ... (all existing state: expenses, loading, error, newCategoryName, etc.)
  const [expenses, setExpenses] = useState<ExpenseCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryType, setNewCategoryType] = useState<'expense' | 'asset'>('expense')
  const [addCategoryError, setAddCategoryError] = useState<string | null>(null)
  const [isEditCategoryModalOpen, setIsEditCategoryModalOpen] = useState(false)
  const [categoryToEdit, setCategoryToEdit] = useState<ExpenseCategory | null>(null)
  const [editingCategoryNameValue, setEditingCategoryNameValue] = useState('')
  const [editCategoryError, setEditCategoryError] = useState<string | null>(null)
  const [isDeleteCategoryModalOpen, setIsDeleteCategoryModalOpen] = useState(false)
  const [categoryToDelete, setCategoryToDelete] = useState<ExpenseCategory | null>(null)
  const [deleteCategoryError, setDeleteCategoryError] = useState<string | null>(null)
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false)
  const [addItemTargetCategory, setAddItemTargetCategory] = useState<{ id: number; name: string } | null>(null)
  const [newItemName, setNewItemName] = useState('')
  const [newItemCost, setNewItemCost] = useState('')
  const [addItemError, setAddItemError] = useState<string | null>(null)
  const [editingItemCost, setEditingItemCost] = useState<{ [itemId: string]: string }>({})
  const [itemCostErrors, setItemCostErrors] = useState<{ [itemId: string]: string }>({})

  // --- Budget Builder State ---
  const [isBuilderModalOpen, setIsBuilderModalOpen] = useState(false);
  const router = useRouter(); // Make sure router is initialized

  // ... (loadData, isDefaultCategory, handleAddCategory, openEditCategoryModal, handleSaveCategoryName, etc. - Keep these mostly as is)
  // Minor adjustment might be needed in handleAddCategory if builder creates categories.
  // The handleCompleteBuilder function below is the primary integration point.
  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const db = await getDb()
      const tx = db.transaction(STORE_NAMES.EXPENSES, 'readonly')
      const store = tx.objectStore(STORE_NAMES.EXPENSES)
      const allExpenses = (await store.getAll()) as ExpenseCategory[]
      await tx.done
      const processedExpenses = allExpenses.map(expense => ({
        ...expense,
        items: (Array.isArray(expense.items) ? expense.items : []).map(item => ({
          ...item,
          id: String(item.id),
          cost: Number(item?.cost) || 0
        })),
      }))
      setExpenses(processedExpenses)
    } catch (err) {
      console.error('Error loading budget data:', err)
      setError('Failed to load budget data. Please try refreshing the page.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const isDefaultCategory = (category: ExpenseCategory | null): boolean => {
    if (!category) return false
    return (
      DEFAULT_EXPENSE_CATEGORIES_NAMES.includes(category.category) ||
      DEFAULT_ASSET_CATEGORIES_NAMES.includes(category.category)
    )
  }

  const handleAddCategory = useCallback(async (categoryToAdd?: Partial<ExpenseCategory>) => {
    const trimmedName = categoryToAdd?.category || newCategoryName.trim()
    if (!trimmedName) {
      setAddCategoryError('Category name cannot be empty.')
      return null 
    }
    setAddCategoryError(null)
    
    const existingCategory = expenses.find(exp => exp.category.toLowerCase() === trimmedName.toLowerCase());
    if (existingCategory && !categoryToAdd) { 
        setAddCategoryError(`Category "${trimmedName}" already exists.`);
        return existingCategory; 
    }

    const categoryId = categoryToAdd?.id || Date.now()
    const typeToUse = categoryToAdd?.type || newCategoryType;
    const itemsToUse = categoryToAdd?.items || [];

    const newEntry: ExpenseCategory = {
      id: categoryId,
      category: trimmedName,
      type: typeToUse,
      items: itemsToUse.map(item => ({...item, id: String(item.id || `item-${Date.now()}-${Math.random().toString(16).slice(2)}`)})),
    }
    try {
      const db = await getDb()
      const tx = db.transaction(STORE_NAMES.EXPENSES, 'readwrite')
      await tx.objectStore(STORE_NAMES.EXPENSES).put(newEntry)
      await tx.done
      
      if (!existingCategory) {
          setExpenses(prev => [...prev, newEntry])
      } else { 
           setExpenses(prev => prev.map(exp => exp.id === newEntry.id ? newEntry : exp));
      }

      setNewCategoryName('')
      setNewCategoryType('expense')
      return newEntry; 
    } catch (err) {
      console.error('Add/Update Category Error:', err)
      setAddCategoryError('Failed to save category.')
      return null; 
    }
  }, [newCategoryName, newCategoryType, expenses, setExpenses, setAddCategoryError, setNewCategoryName, setNewCategoryType]) 

  const openEditCategoryModal = useCallback((category: ExpenseCategory) => {
    if (isDefaultCategory(category)) return
    setCategoryToEdit(category)
    setEditingCategoryNameValue(category.category)
    setEditCategoryError(null)
    setIsEditCategoryModalOpen(true)
  }, [])
  const handleSaveCategoryName = useCallback(async () => {
    if (!categoryToEdit) return
    const trimmedName = editingCategoryNameValue.trim()
    if (!trimmedName) {
      setEditCategoryError('Category name cannot be empty.')
      return
    }
    setEditCategoryError(null)
    const updatedCategory = { ...categoryToEdit, category: trimmedName }
    try {
      const db = await getDb()
      const tx = db.transaction(STORE_NAMES.EXPENSES, 'readwrite')
      await tx.objectStore(STORE_NAMES.EXPENSES).put(updatedCategory)
      await tx.done
      setExpenses(prev =>
        prev.map(exp => (exp.id === categoryToEdit.id ? updatedCategory : exp))
      )
      setIsEditCategoryModalOpen(false)
      setCategoryToEdit(null)
    } catch (err) {
      console.error('Save Category Name Error:', err)
      setEditCategoryError('Failed to save category name.')
    }
  }, [categoryToEdit, editingCategoryNameValue])

  const openDeleteCategoryModal = useCallback((category: ExpenseCategory) => {
    if (isDefaultCategory(category)) {
      setError('Default categories cannot be deleted.')
      setTimeout(() => setError(null), 3000)
      return
    }
    setCategoryToDelete(category)
    setDeleteCategoryError(null)
    setIsDeleteCategoryModalOpen(true)
  }, [])

  const handleDeleteCategoryConfirm = useCallback(async () => {
    if (!categoryToDelete) return
    setDeleteCategoryError(null)
    try {
      const db = await getDb()
      const tx = db.transaction(STORE_NAMES.EXPENSES, 'readwrite')
      await tx.objectStore(STORE_NAMES.EXPENSES).delete(categoryToDelete.id)
      await tx.done
      setExpenses(prev => prev.filter(exp => exp.id !== categoryToDelete.id))
      setIsDeleteCategoryModalOpen(false)
      setCategoryToDelete(null)
    } catch (err) {
      console.error('Delete Category Error:', err)
      setDeleteCategoryError('Failed to delete category.')
    }
  }, [categoryToDelete])

  const openAddItemModal = useCallback(
    (categoryId: number, categoryName: string) => {
      setAddItemTargetCategory({ id: categoryId, name: categoryName })
      setNewItemName('')
      setNewItemCost('')
      setAddItemError(null)
      setIsAddItemModalOpen(true)
    },
    []
  )

  const handleAddItemConfirm = useCallback(async (itemToAdd?: Omit<ExpenseItem, 'id'>, targetCatId?: number) => {
    const categoryInfo = addItemTargetCategory;
    const finalTargetCatId = targetCatId || categoryInfo?.id;

    if (!finalTargetCatId && !targetCatId) {
        setAddItemError("Target category not specified.");
        return;
    }

    const itemName = itemToAdd?.item || newItemName.trim();
    const itemCostInput = itemToAdd?.cost !== undefined ? String(itemToAdd.cost) : newItemCost;
    const itemCost = parseFloat(itemCostInput);

    if (!itemName) {
      setAddItemError('Item name cannot be empty.')
      return
    }
    if (isNaN(itemCost)) {
      setAddItemError('Invalid cost amount.')
      return
    }
    if (itemCost < 0 || itemCost > MAX_ITEM_COST) {
      setAddItemError(`Amount $0-$${MAX_ITEM_COST.toLocaleString()}.`)
      return
    }
    setAddItemError(null)
    const itemId = `item-${Date.now()}-${Math.random().toString(16).slice(2)}`
    const newItemData: ExpenseItem = {
      id: itemId,
      item: itemName,
      cost: itemCost
    }
    try {
      const db = await getDb()
      const tx = db.transaction(STORE_NAMES.EXPENSES, 'readwrite')
      const store = tx.objectStore(STORE_NAMES.EXPENSES)
      const category = await store.get(finalTargetCatId!) 
      if (category) {
        const updatedItems = [
          ...(Array.isArray(category.items) ? category.items : []),
          newItemData
        ]
        const updatedCategory = { ...category, items: updatedItems }
        await store.put(updatedCategory)
        await tx.done
        setExpenses(prev =>
          prev.map(exp =>
            exp.id === finalTargetCatId
              ? {
                  ...updatedCategory,
                  items: updatedItems.map(i => ({ ...i, id: String(i.id), cost: Number(i.cost) || 0 }))
                }
              : exp
          )
        )
        if (!itemToAdd) { 
            setIsAddItemModalOpen(false);
            setNewItemName('');
            setNewItemCost('');
        }
      } else {
        throw new Error(`Category ${finalTargetCatId} not found.`)
      }
    } catch (err) {
      console.error('Add Item Error:', err)
      setAddItemError('Failed to add item.')
    }
  }, [addItemTargetCategory, newItemName, newItemCost, setExpenses, setAddItemError, setIsAddItemModalOpen, setNewItemName, setNewItemCost]) 


  const handleCostInputChange = (itemId: string, value: string) => {
    setEditingItemCost(prev => ({ ...prev, [itemId]: value }))
    setItemCostErrors(prev => {
      const newErrors = { ...prev }
      delete newErrors[itemId]
      return newErrors
    })
  }

  const saveCost = useCallback(
    async (categoryId: number, itemId: string) => {
      const costString = editingItemCost[itemId] ?? ''
      let costValue = 0
      if (costString.trim() !== '') {
        costValue = parseFloat(costString)
        if (isNaN(costValue)) {
          setItemCostErrors(prev => ({ ...prev, [itemId]: 'Invalid number' }))
          return
        }
        if (costValue < 0 || costValue > MAX_ITEM_COST) {
          setItemCostErrors(prev => ({ ...prev, [itemId]: `$0 - $${MAX_ITEM_COST.toLocaleString()}` }))
          return
        }
      }
      setItemCostErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[itemId]
        return newErrors
      })
      try {
        const db = await getDb()
        const tx = db.transaction(STORE_NAMES.EXPENSES, 'readwrite')
        const store = tx.objectStore(STORE_NAMES.EXPENSES)
        const category = await store.get(categoryId)
        if (category) {
          const updatedItems = (Array.isArray(category.items) ? category.items : []).map(item =>
            item.id === itemId ? { ...item, cost: costValue } : item
          )
          const updatedCategory = { ...category, items: updatedItems }
          await store.put(updatedCategory)
          await tx.done
          setExpenses(prev =>
            prev.map(exp =>
              exp.id === categoryId
                ? { ...exp, items: updatedItems.map(item => ({ ...item, id: String(item.id) })) }
                : exp
            )
          )
          setEditingItemCost(prev => {
            const newState = { ...prev }
            delete newState[itemId]
            return newState
          })
        } else {
          throw new Error(`Category ${categoryId} not found.`)
        }
      } catch (err) {
        console.error('Update Cost Error:', err)
        setItemCostErrors(prev => ({ ...prev, [itemId]: 'Save failed' }))
      }
    },
    [editingItemCost, setExpenses, setItemCostErrors, setEditingItemCost] 
  )

  const removeExpenseItem = useCallback(
    async (categoryId: number, itemId: string) => {
      setError(null)
      setItemCostErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[itemId]
        return newErrors
      })
      try {
        const db = await getDb()
        const tx = db.transaction(STORE_NAMES.EXPENSES, 'readwrite')
        const store = tx.objectStore(STORE_NAMES.EXPENSES)
        const category = await store.get(categoryId)
        if (category) {
          const updatedItems = (Array.isArray(category.items) ? category.items : []).filter(item => item.id !== itemId)
          const updatedCategory = { ...category, items: updatedItems }
          await store.put(updatedCategory)
          await tx.done
          setExpenses(prev =>
            prev.map(exp =>
              exp.id === categoryId
                ? { ...updatedCategory, items: updatedCategory.items.map(item => ({ ...item, id: String(item.id) })) }
                : exp
            )
          )
        } else {
          throw new Error(`Category ${categoryId} not found.`)
        }
      } catch (err) {
        console.error('Remove Item Error:', err)
        setError('Failed remove item.')
      }
    },
    [setExpenses, setError, setItemCostErrors] 
  )


  // --- Budget Builder Completion Handler ---
  const handleCompleteBuilder = useCallback(async (builtCategoriesFromBuilder: { categoryName: string; items: Omit<ExpenseItem, 'id'>[] }[]) => {
    let currentProcessedExpenses = [...expenses]; // Start with current state
    const db = await getDb();
    const tx = db.transaction(STORE_NAMES.EXPENSES, 'readwrite');
    const store = tx.objectStore(STORE_NAMES.EXPENSES);
    let changesMade = false;

    for (const builtCat of builtCategoriesFromBuilder) {
        if (builtCat.items.length === 0) continue; // Skip if no items to add for this category

        let categoryInState = currentProcessedExpenses.find(ec => ec.category === builtCat.categoryName);
        let newItemsForCategory = builtCat.items.map(item => ({
            ...item,
            id: `item-${Date.now()}-${Math.random().toString(16).slice(2)}` // Ensure unique ID
        }));

        if (!categoryInState) {
            // Category doesn't exist, create it
            const newCatId = Date.now() + Math.random(); // Unique ID for new category
            const newCategoryEntry: ExpenseCategory = {
                id: newCatId,
                category: builtCat.categoryName,
                // Determine type based on name or default to 'expense'
                type: DEFAULT_ASSET_CATEGORIES_NAMES.includes(builtCat.categoryName) ? 'asset' : 'expense',
                items: newItemsForCategory
            };
            try {
                await store.put(newCategoryEntry);
                currentProcessedExpenses.push(newCategoryEntry);
                changesMade = true;
            } catch (error) {
                console.error(`Error adding new category '${builtCat.categoryName}' from builder:`, error);
                setError(`Failed to add category: ${builtCat.categoryName}`);
            }
        } else {
            // Category exists, merge items
            const updatedCategoryItems = [...categoryInState.items, ...newItemsForCategory];
            const updatedCategoryInDb: ExpenseCategory = { ...categoryInState, items: updatedCategoryItems };
            try {
                await store.put(updatedCategoryInDb);
                currentProcessedExpenses = currentProcessedExpenses.map(exp =>
                    exp.id === categoryInState!.id ? updatedCategoryInDb : exp
                );
                changesMade = true;
            } catch (error) {
                console.error(`Error updating category '${builtCat.categoryName}' from builder:`, error);
                setError(`Failed to update items in category: ${builtCat.categoryName}`);
            }
        }
    }

    if (changesMade) {
        try {
            await tx.done; // Commit all changes
            setExpenses(currentProcessedExpenses); // Update state once after all DB operations
        } catch (error) {
            console.error("Error committing builder changes to DB:", error);
            setError("Failed to save all budget changes from builder. Please check console.");
            // Optionally, reload data to revert to pre-builder state on transaction failure
            // loadData(); 
        }
    }

    setIsBuilderModalOpen(false);
    // setError(null); // Clear general error if successful, or rely on specific errors set above
  }, [expenses, setExpenses, setError, setIsBuilderModalOpen]); // Removed loadData from deps for this specific handler

  // ... (categoryTotals, overallTotals, and the rest of the JSX for BudgetSheet)
  const categoryTotals = useMemo(() => {
    const totals: { [categoryId: number]: number } = {}
    expenses.forEach(category => {
      totals[category.id] = (Array.isArray(category.items) ? category.items : []).reduce(
        (sum, item) => sum + (Number(item.cost) || 0),
        0
      )
    })
    return totals
  }, [expenses])

  const overallTotals = useMemo(() => {
    let totalExp = 0
    let totalAss = 0
    expenses.forEach(category => {
      const categoryTotal = categoryTotals[category.id] || 0
      if (category.type === 'expense') {
        totalExp += categoryTotal
      } else if (category.type === 'asset') {
        totalAss += categoryTotal
      }
    })
    const netCost = totalExp - totalAss
    return { totalExpenses: totalExp, totalAssets: totalAss, netCost }
  }, [expenses, categoryTotals])


  if (loading) return <Layout><div className='p-4 text-center dark:text-gray-200'>Loading Budget Sheet...</div></Layout>
  if (error && expenses.length === 0) return <Layout><div className='p-4 text-center text-red-500'>{error}</div></Layout>
  
  return (
    <Layout backgroundImageSrc={background}>
      <div className='max-w-4xl mx-auto p-4'>
        <div className='backdrop-blur-lg rounded-xl shadow-lg p-4 md:p-6 bg-white/90 dark:bg-gray-800/90 space-y-6'>
          <h1 className='text-3xl font-bold text-center text-gray-900 dark:text-gray-100'>Budget Sheet</h1>

          {error && (
            <div className='p-3 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 rounded text-center text-sm'>
              {error} <Button variant='ghost' size='sm' onClick={() => setError(null)} className='ml-2 text-xs h-auto p-1 align-middle'>Dismiss</Button>
            </div>
          )}
           <Card className='shadow-sm bg-white/95 border-gray-200 dark:bg-gray-800/95 dark:border-gray-700'>
            <CardHeader className='p-4'>
              <CardTitle className='text-lg font-semibold text-gray-700 dark:text-gray-200'>New to Budgeting?</CardTitle>
            </CardHeader>
            <CardContent className='p-4'>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                Use our step-by-step builder to help you think through common study abroad expenses.
              </p>
              <Button onClick={() => setIsBuilderModalOpen(true)} className="w-full sm:w-auto">
                <PlusCircle className="mr-2 h-4 w-4" /> Start Budget Builder
              </Button>
            </CardContent>
          </Card>

          <Card className='shadow-sm bg-white/95 border-gray-200 dark:bg-gray-800/95 dark:border-gray-700'>
            <CardHeader className='p-4'>
              <CardTitle className='text-lg font-semibold text-gray-700 dark:text-gray-200'>Add Custom Category</CardTitle>
            </CardHeader>
            <CardContent className='p-4'>
              <div className='flex flex-col sm:flex-row gap-3 items-start'>
                <div className='flex-grow w-full'>
                  <Input
                    placeholder='Category Name'
                    value={newCategoryName}
                    onChange={e => setNewCategoryName(e.target.value)}
                    className='bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400'
                    aria-label='New category name'
                  />
                  {addCategoryError && <p className='text-xs text-red-500 dark:text-red-400 mt-1'>{addCategoryError}</p>}
                </div>
                <Select value={newCategoryType} onValueChange={(value: 'expense' | 'asset') => setNewCategoryType(value)}>
                  <SelectTrigger className='w-full sm:w-[150px] bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white'> <SelectValue placeholder='Type' /> </SelectTrigger>
                  <SelectContent className='bg-white dark:bg-gray-800 dark:text-white dark:border-gray-700'> <SelectItem value='expense'>Expense</SelectItem> <SelectItem value='asset'>Asset</SelectItem> </SelectContent>
                </Select>
                <Button onClick={()=> handleAddCategory()} className='px-6 w-full sm:w-auto'>Add Category</Button>
              </div>
            </CardContent>
          </Card>

          <section aria-labelledby='assets-heading'>
            <h2 id='assets-heading' className='text-2xl font-semibold mb-4 text-green-700 dark:text-green-400'>Assets</h2>
            {expenses.filter(c => c.type === 'asset').map(category => (
              <CategoryCard
                key={category.id}
                category={category}
                categoryTotal={categoryTotals[category.id] || 0}
                isDefault={isDefaultCategory(category)}
                onEditCategory={() => openEditCategoryModal(category)}
                onDeleteCategory={() => openDeleteCategoryModal(category)}
                onAddItem={() => openAddItemModal(category.id, category.category)}
                onRemoveItem={removeExpenseItem}
                onCostChange={handleCostInputChange}
                onCostSave={saveCost}
                editingItemCost={editingItemCost}
                itemCostErrors={itemCostErrors}
              />
            ))}
            {expenses.filter(c => c.type === 'asset').length === 0 && <p className='text-sm text-gray-500 dark:text-gray-400 mb-6 ml-1'>No asset categories added yet.</p>}
          </section>

          <section aria-labelledby='expenses-heading'>
            <h2 id='expenses-heading' className='text-2xl font-semibold mb-4 text-red-700 dark:text-red-400'>Expenses</h2>
            {expenses.filter(c => c.type === 'expense').map(category => (
              <CategoryCard
                key={category.id}
                category={category}
                categoryTotal={categoryTotals[category.id] || 0}
                isDefault={isDefaultCategory(category)}
                onEditCategory={() => openEditCategoryModal(category)}
                onDeleteCategory={() => openDeleteCategoryModal(category)}
                onAddItem={() => openAddItemModal(category.id, category.category)}
                onRemoveItem={removeExpenseItem}
                onCostChange={handleCostInputChange}
                onCostSave={saveCost}
                editingItemCost={editingItemCost}
                itemCostErrors={itemCostErrors}
              />
            ))}
            {expenses.filter(c => c.type === 'expense').length === 0 && <p className='text-sm text-gray-500 dark:text-gray-400 mb-6 ml-1'>No expense categories added yet.</p>}
          </section>

          <Card className='bg-gray-100/90 dark:bg-gray-800/90 shadow-md border-gray-200 dark:border-gray-700 backdrop-blur-sm'>
            <CardHeader><CardTitle className='text-xl text-gray-800 dark:text-gray-100'>Budget Summary</CardTitle></CardHeader>
            <CardContent className='space-y-2 text-right text-base'>
              <p><span className='font-medium text-gray-600 dark:text-gray-300'>Total Assets:</span> <span className='ml-2 font-semibold text-green-600 dark:text-green-400'>{formatCurrency(overallTotals.totalAssets)}</span></p>
              <p><span className='font-medium text-gray-600 dark:text-gray-300'>Total Expenses:</span> <span className='ml-2 font-semibold text-red-600 dark:text-red-400'>{formatCurrency(overallTotals.totalExpenses)}</span></p>
              <hr className='my-2 border-gray-300 dark:border-gray-600' />
              <p className='text-lg'><span className='font-bold text-gray-800 dark:text-gray-100'>Net Cost / (Surplus):</span> <span className={`ml-2 font-bold ${overallTotals.netCost >= 0 ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>{formatCurrency(overallTotals.netCost)}</span></p>
              {overallTotals.netCost < 0 && <p className='text-xs text-green-600 dark:text-green-400'>(Budget Surplus)</p>}
              <div className='pt-4 text-center sm:text-right'><Button onClick={() => router.push('/savings')}>Track Savings Plan</Button></div>
            </CardContent>
          </Card>
        </div>
      </div>

      <BudgetBuilderModal
        isOpen={isBuilderModalOpen}
        onClose={() => setIsBuilderModalOpen(false)}
        onComplete={handleCompleteBuilder}
      />

      {/* ... (Other Modals: EditCategory, DeleteCategory, AddItem - Keep as is) ... */}
      <Dialog open={isEditCategoryModalOpen} onOpenChange={setIsEditCategoryModalOpen}>
        <DialogContent className='sm:max-w-[425px] bg-white dark:bg-gray-800'>
          <DialogHeader><DialogTitle className='text-gray-900 dark:text-gray-100'>Edit Category Name</DialogTitle></DialogHeader>
          <div className='grid gap-4 py-4'>
            <Label htmlFor='edit-category-name' className='text-gray-700 dark:text-gray-300'> Category Name </Label>
            <Input id='edit-category-name' value={editingCategoryNameValue} onChange={e => setEditingCategoryNameValue(e.target.value)} className='bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100' autoFocus />
            {editCategoryError && <p className='text-sm text-red-500 dark:text-red-400'>{editCategoryError}</p>}
          </div>
          <DialogFooter><DialogClose asChild><Button type='button' variant='outline'>Cancel</Button></DialogClose><Button type='button' onClick={handleSaveCategoryName}>Save Changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteCategoryModalOpen} onOpenChange={setIsDeleteCategoryModalOpen}>
        <DialogContent className='sm:max-w-[425px] bg-white dark:bg-gray-800'>
          <DialogHeader>
            <DialogTitle className='text-gray-900 dark:text-gray-100'>Confirm Deletion</DialogTitle>
            <DialogDescription> Are you sure you want to delete the category <strong className='text-gray-800 dark:text-gray-200'>&quot;{categoryToDelete?.category}&quot;</strong>? All items within this category will also be permanently deleted. This action cannot be undone. </DialogDescription>
          </DialogHeader>
          {deleteCategoryError && <p className='py-2 text-sm text-red-500 dark:text-red-400 text-center'>{deleteCategoryError}</p>}
          <DialogFooter><DialogClose asChild><Button type='button' variant='outline'>Cancel</Button></DialogClose><Button type='button' variant='destructive' onClick={handleDeleteCategoryConfirm}>Delete Category</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddItemModalOpen} onOpenChange={setIsAddItemModalOpen}>
        <DialogContent className='sm:max-w-[425px] bg-white dark:bg-gray-800'>
          <DialogHeader><DialogTitle className='text-gray-900 dark:text-gray-100'>Add Item to &quot;{addItemTargetCategory?.name}&quot;</DialogTitle></DialogHeader>
          <div className='grid gap-4 py-4'>
            <div className='space-y-2'><Label htmlFor='new-item-name' className='text-gray-700 dark:text-gray-300'>Item Name</Label><Input id='new-item-name' value={newItemName} onChange={e => setNewItemName(e.target.value)} className='bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100' autoFocus /></div>
            <div className='space-y-2'><Label htmlFor='new-item-cost' className='text-gray-700 dark:text-gray-300'>Cost ($)</Label><Input id='new-item-cost' type='number' step='0.01' placeholder='0.00' value={newItemCost} onChange={e => setNewItemCost(e.target.value)} className='bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100' /></div>
            {addItemError && <p className='text-sm text-red-500 dark:text-red-400'>{addItemError}</p>}
          </div>
          <DialogFooter><DialogClose asChild><Button type='button' variant='outline'>Cancel</Button></DialogClose><Button type='button' onClick={()=> handleAddItemConfirm()}>Add Item</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

// --- Sub-Component for Category Card (CategoryCardProps and CategoryCard component) ---
// ... (Keep as is)
interface CategoryCardProps {
  category: ExpenseCategory
  categoryTotal: number
  isDefault: boolean
  onEditCategory: () => void
  onDeleteCategory: () => void
  onAddItem: () => void
  onRemoveItem: (categoryId: number, itemId: string) => void
  onCostChange: (itemId: string, value: string) => void
  onCostSave: (categoryId: number, itemId: string) => void
  editingItemCost: { [itemId: string]: string }
  itemCostErrors: { [itemId: string]: string }
}
const CategoryCard: React.FC<CategoryCardProps> = ({
  category, categoryTotal, isDefault, onEditCategory, onDeleteCategory, onAddItem, onRemoveItem, onCostChange, onCostSave, editingItemCost, itemCostErrors
}) => {
  return (
    <Card className='mb-6 overflow-hidden bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700'>
      <CardHeader className='p-4 bg-gray-50/50 dark:bg-gray-700/50 flex flex-row justify-between items-center'>
        <CardTitle className='text-xl text-gray-800 dark:text-gray-100 flex-grow' title={isDefault ? 'Default Category' : 'Category Name'}>
          {category.category}
          <span className='ml-2 text-sm font-normal text-gray-500 dark:text-gray-400'>({formatCurrency(categoryTotal)})</span>
        </CardTitle>
        <div className='flex items-center space-x-2 flex-shrink-0'>
          {!isDefault && (
            <>
              <Button onClick={onEditCategory} variant='ghost' size='icon' className='h-7 w-7 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400' title='Edit Category Name'> <Pencil className='h-4 w-4' /> <span className='sr-only'>Edit Category</span> </Button>
              <Button onClick={onDeleteCategory} variant='ghost' size='icon' className='h-7 w-7 text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400' title='Delete Category'> <Trash2 className='h-4 w-4' /> <span className='sr-only'>Delete Category</span> </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className='p-0'>
        <Table>
          <TableHeader><TableRow><TableHead className='pl-4 w-2/5 text-gray-600 dark:text-gray-300'>Item</TableHead><TableHead className='w-1/4 text-right text-gray-600 dark:text-gray-300'>Cost ($)</TableHead><TableHead className='w-1/4 text-center pr-4 text-gray-600 dark:text-gray-300'>Action</TableHead></TableRow></TableHeader>
          <TableBody>
            {(Array.isArray(category.items) ? category.items : []).map(item => (
              <TableRow key={item.id}>
                <TableCell className='pl-4 font-medium text-gray-900 dark:text-gray-100'>{item.item}</TableCell>
                <TableCell className='text-right'>
                  <div className='inline-block relative'>
                    <Input
                      type='number' step='0.01' min='0' placeholder='0.00'
                      value={editingItemCost[item.id] ?? item.cost}
                      onChange={e => onCostChange(item.id, e.target.value)}
                      onBlur={() => onCostSave(category.id, item.id)}
                      className={`w-28 text-right h-8 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white ${itemCostErrors[item.id] ? 'border-red-500 dark:border-red-400 focus:ring-red-500' : 'border-gray-300 dark:border-gray-600'}`}
                      aria-label={`Cost for ${item.item}`} aria-invalid={!!itemCostErrors[item.id]} aria-describedby={itemCostErrors[item.id] ? `item-error-${item.id}` : undefined}
                    />
                    {itemCostErrors[item.id] && <p id={`item-error-${item.id}`} className='absolute text-xs text-red-500 dark:text-red-400 mt-1 right-0'>{itemCostErrors[item.id]}</p>}
                  </div>
                </TableCell>
                <TableCell className='text-center pr-4'>
                  <Button onClick={() => onRemoveItem(category.id, item.id)} variant='ghost' size='icon' className='text-red-500/80 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 h-7 w-7' title='Remove Item'><XCircle className='h-4 w-4' /><span className='sr-only'>Remove Item</span></Button>
                </TableCell>
              </TableRow>
            ))}
            <TableRow><TableCell colSpan={3} className='pt-3 px-4 pb-3'><Button variant='outline' size='sm' className='w-full text-gray-700 border-gray-300 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700' onClick={onAddItem}>+ Add Item to &quot;{category.category}&quot;</Button></TableCell></TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export default BudgetSheet;