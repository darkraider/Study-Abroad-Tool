'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogTrigger
} from '@/components/ui/dialog'
import Layout from '@/app/components/layout' // Assuming correct path
import { useRouter } from 'next/navigation'
// Import DB functions
import {
  getDb,
  STORE_NAMES,
  CustomScholarship,
  addCustomScholarshipToDB,
  getAllCustomScholarshipsFromDB,
  updateCustomScholarshipInDB,
  deleteCustomScholarshipFromDB,
  addEventToCalendarDB,
  getAllCalendarEvents
} from '@/lib/db' // Assuming correct path
import { isValid, parseISO, format } from 'date-fns'
import { Pencil, Trash2 } from 'lucide-react'
import Image from 'next/image'
import background from '../../../public/backgrounds/planner-bg.jpg'

// --- Type Definitions ---
type CombinedScholarship = {
  id: number | string
  name: string
  description: string
  additionalInfo?: string
  link: string
  deadlineDate: string | null
  deadlineDisplay: string
  status: 'Not Submitted' | 'Applied' | 'Awarded' | 'Rejected'
  awardedAmount: number | null
  isCustom?: boolean
  categoryType?: 'government' | 'school' | 'thirdParty' | 'custom'
}
type ScholarshipCategory = 'government' | 'school' | 'thirdParty'
type BaseScholarshipData = {
  [key in ScholarshipCategory]: (Omit<
    CombinedScholarship,
    'isCustom' | 'categoryType' | 'id'
  > & { id: number })[]
}
type CalendarEvent = {
  id: string
  title: string
  start: string
  end?: string
  allDay: boolean
}
type BudgetScholarshipItem = { id: string; item: string; cost: number }

// --- Constants ---
const LOCAL_STORAGE_KEY = 'scholarshipStatusData_v1'
const SCHOLARSHIPS_CATEGORY_ID = 4

// --- Base Scholarship Data ---
const baseScholarships: BaseScholarshipData = {
  /* ... same data as before ... */
  government: [
    {
      id: 1,
      name: 'Benjamin A. Gilman International Scholarship',
      description:
        'For U.S. undergrads with financial need (Pell Grant recipients).',
      link: 'https://www.gilmanscholarship.org/',
      deadlineDate: '2025-10-15',
      deadlineDisplay: 'October 2025 (Approx.)',
      status: 'Not Submitted',
      awardedAmount: null
    },
    {
      id: 2,
      name: 'Boren Awards (Undergraduate)',
      description:
        'Funding for studying less common languages in critical regions.',
      link: 'https://www.borenawards.org/',
      deadlineDate: '2026-01-31',
      deadlineDisplay: 'Late January 2026 (Approx.)',
      status: 'Not Submitted',
      awardedAmount: null
    },
    {
      id: 3,
      name: 'Critical Language Scholarship (CLS)',
      description: 'Fully-funded summer language immersion programs.',
      link: 'https://clscholarship.org/',
      deadlineDate: '2025-11-15',
      deadlineDisplay: 'Mid-November 2025 (Approx.)',
      status: 'Not Submitted',
      awardedAmount: null
    }
  ],
  school: [
    {
      id: 4,
      name: 'UT TYLER - IEFS',
      description: 'For UT Tyler students supporting study abroad programs.',
      link: 'https://www.uttyler.edu/student-life/study-abroad/scholarships/',
      deadlineDate: null,
      deadlineDisplay: 'Check UT Tyler Website',
      status: 'Not Submitted',
      awardedAmount: null
    },
    {
      id: 5,
      name: 'UT TYLER - DBB Scholarship',
      description: 'For UT Tyler students supporting international studies.',
      link: 'https://www.uttyler.edu/student-life/study-abroad/scholarships/',
      deadlineDate: null,
      deadlineDisplay: 'Check UT Tyler Website',
      status: 'Not Submitted',
      awardedAmount: null
    }
  ],
  thirdParty: [
    {
      id: 6,
      name: 'Fund for Education Abroad (FEA)',
      description: 'Supports underrepresented students studying abroad.',
      link: 'https://www.fundforeducationabroad.org/',
      deadlineDate: '2025-09-15',
      deadlineDisplay: 'Mid-September 2025 (Approx.)',
      status: 'Not Submitted',
      awardedAmount: null
    },
    {
      id: 7,
      name: 'Freeman-ASIA',
      description:
        'For U.S. undergrads with need studying in East/Southeast Asia.',
      link: 'https://www.iie.org/programs/freeman-asia',
      deadlineDate: '2026-04-01',
      deadlineDisplay: 'Early April (Check Annually)',
      status: 'Not Submitted',
      awardedAmount: null
    },
    {
      id: 8,
      name: 'Diversity Abroad Scholarships',
      description: 'Platform listing scholarships often for diverse students.',
      link: 'https://www.diversityabroad.com/scholarships',
      deadlineDate: null,
      deadlineDisplay: 'Varies (Check Website)',
      status: 'Not Submitted',
      awardedAmount: null
    },
    {
      id: 9,
      name: 'IES Abroad Scholarships & Aid',
      description:
        'Provider offering need-based, merit, and diversity scholarships.',
      link: 'https://www.iesabroad.org/scholarships-aid',
      deadlineDate: '2025-11-01',
      deadlineDisplay: "Nov 1, 2025 (for Spring '26)",
      status: 'Not Submitted',
      awardedAmount: null
    },
    {
      id: 10,
      name: 'CIEE Scholarships & Grants',
      description:
        'Provider offering need-based grants and merit scholarships.',
      link: 'https://www.ciee.org/go-abroad/college-study-abroad/scholarships',
      deadlineDate: '2025-10-15',
      deadlineDisplay: "Oct 15, 2025 (for Spring '26)",
      status: 'Not Submitted',
      awardedAmount: null
    },
    {
      id: 11,
      name: 'Bridging Scholarships (Japan)',
      description:
        'Supports U.S. undergrads studying in Japan (semester/year).',
      link: 'https://www.aatj.org/studyabroad/japan-bridging-scholarships',
      deadlineDate: '2025-10-10',
      deadlineDisplay: 'Early October 2025 (Approx.)',
      status: 'Not Submitted',
      awardedAmount: null
    }
  ]
}

// --- Data Fetching & Utility Functions ---
const getSavedStatusData = (): {
  [k: string]: Partial<Pick<CombinedScholarship, 'status' | 'awardedAmount'>>
} => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}')
  } catch {
    console.error('LS Read Err')
    return {}
  }
}
const saveStatusData = (dataToSave: {
  [k: string]: Partial<Pick<CombinedScholarship, 'status' | 'awardedAmount'>>
}) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dataToSave))
  } catch (e) {
    console.error('Save Status Err:', e)
  }
}
const getBudgetScholarships = async (): Promise<BudgetScholarshipItem[]> => {
  try {
    const db = await getDb()
    const tx = db.transaction(STORE_NAMES.EXPENSES, 'readonly')
    const store = tx.objectStore(STORE_NAMES.EXPENSES)
    const scholarshipCategory = await store.get(SCHOLARSHIPS_CATEGORY_ID)
    await tx.done
    if (
      scholarshipCategory &&
      scholarshipCategory.type === 'asset' &&
      Array.isArray(scholarshipCategory.items)
    ) {
      return scholarshipCategory.items.map(item => ({
        id: String(item.id),
        item: item.item,
        cost: Number(item.cost) || 0
      }))
    }
    return []
  } catch (error) {
    console.error('Error fetching budget scholarship items:', error)
    return []
  }
}
const syncScholarshipToBudget = async (
  sch: CombinedScholarship
): Promise<boolean> => {
  try {
    const db = await getDb()
    const tx = db.transaction(STORE_NAMES.EXPENSES, 'readwrite')
    const store = tx.objectStore(STORE_NAMES.EXPENSES)
    const category = await store.get(SCHOLARSHIPS_CATEGORY_ID)
    if (!category || category.type !== 'asset') {
      await tx.done
      return false
    }
    const budgetItemId = `scholarship-${sch.id}`
    let items = Array.isArray(category.items) ? [...category.items] : []
    const existingItemIndex = items.findIndex(
      item => String(item.id) === budgetItemId
    )
    if (
      sch.status === 'Awarded' &&
      sch.awardedAmount !== null &&
      sch.awardedAmount > 0
    ) {
      const newItemData = {
        id: budgetItemId,
        item: sch.name,
        cost: sch.awardedAmount
      }
      if (existingItemIndex > -1) {
        items[existingItemIndex] = newItemData
      } else {
        items.push(newItemData)
      }
    } else {
      if (existingItemIndex > -1) {
        items.splice(existingItemIndex, 1)
      } else {
        await tx.done
        return true
      }
    }
    await store.put({ ...category, items: items })
    await tx.done
    return true
  } catch (error) {
    console.error('Error syncing scholarship to budget:', error)
    return false
  }
}
const validateAmount = (amt: string | number | null): string | null => {
  if (amt == null || amt === '') return null
  const num = Number(amt)
  if (isNaN(num)) return 'Invalid'
  if (num < 0) return 'Negative'
  return null
}

const initialCustomData: Omit<CustomScholarship, 'id' | 'isCustom'> = {
  name: '',
  description: '',
  link: '',
  deadlineDate: null,
  deadlineDisplay: '',
  additionalInfo: ''
}

// --- Component ---
export default function ScholarshipPlan () {
  // --- Hooks defined at top level ---
  const [scholarships, setScholarships] = useState<CombinedScholarship[]>([])
  const [selectedScholarship, setSelectedScholarship] =
    useState<CombinedScholarship | null>(null)
  const [filter, setFilter] = useState<'all' | ScholarshipCategory | 'custom'>(
    'all'
  )
  const [sort, setSort] = useState<'deadline' | 'name'>('deadline')
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [errors, setErrors] = useState<{ [key: string]: string | null }>({})
  const [successMessage, setSuccessMessage] = useState('')
  const [lastActionScholarshipId, setLastActionScholarshipId] = useState<
    number | string | null
  >(null)
  const [loading, setLoading] = useState(true)
  const [initError, setInitError] = useState<string | null>(null)
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add')
  const [currentCustomData, setCurrentCustomData] = useState(initialCustomData)
  const [editingCustomId, setEditingCustomId] = useState<string | null>(null)
  const [customFormError, setCustomFormError] = useState<string | null>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [scholarshipToDelete, setScholarshipToDelete] =
    useState<CombinedScholarship | null>(null)

  const router = useRouter()

  // --- Filtering/Sorting Logic --- (useCallback Hook)
  const getDisplayedScholarships = useCallback((): CombinedScholarship[] => {
    try {
      const currentScholarships = Array.isArray(scholarships)
        ? scholarships
        : []
      if (currentScholarships.length === 0) return []
      const filtered = currentScholarships.filter(sch => {
        if (!sch) return false
        if (filter === 'all') return true
        return sch.categoryType === filter
      })
      if (!Array.isArray(filtered)) return []
      const sorted = filtered.sort((a, b) => {
        if (!a || !b) return 0
        if (sort === 'deadline') {
          const dateA = a.deadlineDate ? parseISO(a.deadlineDate) : null
          const timeA = dateA && isValid(dateA) ? dateA.getTime() : Infinity
          const dateB = b.deadlineDate ? parseISO(b.deadlineDate) : null
          const timeB = dateB && isValid(dateB) ? dateB.getTime() : Infinity
          if (timeA === Infinity && timeB === Infinity)
            return (a.name || '').localeCompare(b.name || '')
          return timeA - timeB
        } else {
          return (a.name || '').localeCompare(b.name || '')
        }
      })
      return sorted
    } catch (e) {
      console.error('Error in getDisplayedScholarships:', e)
      return []
    }
  }, [scholarships, filter, sort])

  // --- Memoized Derived State --- (useMemo Hook)
  const displayedScholarships = useMemo(() => {
    return getDisplayedScholarships() || []
  }, [getDisplayedScholarships])

  // --- Data Loading Effect --- (useEffect Hook)
  useEffect(() => {
    // Replacement for the original single line 106:
    const loadInitialData = async () => {
      setLoading(true)
      setInitError(null)

      try {
        // --- Fetch all required data concurrently ---
        const [budgetResult, eventsResult, savedStatusResult, customDbResult] =
          await Promise.all([
            getBudgetScholarships().catch(err => {
              console.error('Error fetching budget scholarships:', err)
              return [] // Return empty array on error
            }),
            getAllCalendarEvents().catch(err => {
              console.error('Error fetching calendar events:', err)
              return [] // Return empty array on error
            }),
            Promise.resolve(getSavedStatusData()), // Already handles errors internally/returns {}
            getAllCustomScholarshipsFromDB().catch(err => {
              console.error('Error fetching custom scholarships:', err)
              return [] // Return empty array on error
            })
          ])

        // --- Process results (handle potential nulls from catches) ---
        const budgetItems: BudgetScholarshipItem[] = budgetResult ?? []
        const events: CalendarEvent[] = eventsResult ?? []
        const savedStatus = savedStatusResult ?? {} // Should be {} from getSavedStatusData on error
        const customDb: CustomScholarship[] = customDbResult ?? []

        const combinedList: CombinedScholarship[] = []

        // --- Process Base Scholarships ---
        Object.entries(baseScholarships).forEach(
          ([categoryKey, scholarshipArray]) => {
            const categoryType = categoryKey as ScholarshipCategory // Assert type
            scholarshipArray.forEach(baseSch => {
              const savedData = savedStatus[baseSch.id]
              const budgetItemId = `scholarship-${baseSch.id}`
              const budgetItem = budgetItems.find(
                item => item && String(item.id) === budgetItemId
              )

              // Determine Status and Awarded Amount
              let currentStatus: CombinedScholarship['status'] =
                savedData?.status ?? baseSch.status ?? 'Not Submitted'
              let currentAmount: number | null = null

              if (currentStatus === 'Awarded') {
                // Prioritize budget item cost if available, then saved amount
                currentAmount =
                  budgetItem?.cost ?? savedData?.awardedAmount ?? null

                // Awarded specific logic: Ensure budget item exists and amount is valid
                if (!budgetItem) {
                  // If awarded but no corresponding budget item, reset status
                  currentStatus = 'Not Submitted'
                  currentAmount = null
                } else {
                  // Recalculate amount based *primarily* on budget item if possible
                  const budgetCostNum =
                    budgetItem.cost != null && !isNaN(Number(budgetItem.cost))
                      ? Number(budgetItem.cost)
                      : null
                  currentAmount = budgetCostNum // Start with budget cost

                  // Fallback to saved amount only if budget cost is null/invalid
                  if (
                    currentAmount == null &&
                    savedData?.awardedAmount != null
                  ) {
                    currentAmount = savedData.awardedAmount
                  }

                  // Ensure awarded amount is positive, otherwise nullify
                  if (currentAmount != null && currentAmount <= 0) {
                    currentAmount = null
                    // Optional: Consider if status should also reset if amount becomes invalid
                    // currentStatus = 'Not Submitted';
                  }
                }
              } else {
                // If status is not 'Awarded', amount must be null
                currentAmount = null
              }

              // Create the combined object explicitly
              const combinedItem: CombinedScholarship = {
                ...baseSch, // Spread base scholarship data (Omit<...> & {id: number})
                status: currentStatus,
                awardedAmount: currentAmount,
                isCustom: false,
                categoryType: categoryType
              }
              combinedList.push(combinedItem)
            })
          }
        )

        // --- Process Custom Scholarships ---
        customDb.forEach(customSch => {
          // customSch is type CustomScholarship
          const savedData = savedStatus[customSch.id]
          const budgetItemId = `scholarship-${customSch.id}`
          const budgetItem = budgetItems.find(
            item => item && String(item.id) === budgetItemId
          )

          // Determine Status and Awarded Amount (Logic mirrored from base scholarships)
          let currentStatus: CombinedScholarship['status'] =
            savedData?.status ?? 'Not Submitted' // Custom starts as Not Submitted if no saved data
          let currentAmount: number | null = null

          if (currentStatus === 'Awarded') {
            currentAmount = budgetItem?.cost ?? savedData?.awardedAmount ?? null

            if (!budgetItem) {
              currentStatus = 'Not Submitted'
              currentAmount = null
            } else {
              const budgetCostNum =
                budgetItem.cost != null && !isNaN(Number(budgetItem.cost))
                  ? Number(budgetItem.cost)
                  : null
              currentAmount = budgetCostNum
              if (currentAmount == null && savedData?.awardedAmount != null) {
                currentAmount = savedData.awardedAmount
              }
              if (currentAmount != null && currentAmount <= 0) {
                currentAmount = null
              }
            }
          } else {
            currentAmount = null
          }

          // Create the combined object explicitly (incorporating the debugging step)
          const combinedItem: CombinedScholarship = {
            ...customSch, // Spread custom scholarship data (CustomScholarship type)
            status: currentStatus,
            awardedAmount: currentAmount,
            // isCustom is already true in customSch from db.ts type
            categoryType: 'custom' // Explicitly set categoryType
            // Ensure all non-optional fields from CombinedScholarship are present
            // CustomSch provides: id, name, description, link, deadlineDate, deadlineDisplay, isCustom, additionalInfo?
            // We add: status, awardedAmount, categoryType
          }
          combinedList.push(combinedItem) // Push the explicitly typed object
        })

        // --- Update State ---
        setScholarships(combinedList)
        setCalendarEvents(events)
      } catch (error) {
        console.error('Init Load Err:', error)
        setInitError(
          'Failed to load scholarship data. Please try refreshing the page.'
        )
        // Clear potentially partial data on error
        setScholarships([])
        setCalendarEvents([])
      } finally {
        setLoading(false)
      }
    } // End of loadInitialData function definition
    loadInitialData()
  }, [])

  // --- Update Scholarship Status --- (useCallback Hook)
  // ** MODIFIED AGAIN to fix modal state sync **
  const updateScholarshipStatus = useCallback(
    async (
      schId: number | string,
      newStatus: CombinedScholarship['status'],
      amtInput: string | number | null = null
    ) => {
      setErrors(prev => ({ ...prev, [String(schId)]: null, general: null }))
      setSuccessMessage('')
      setLastActionScholarshipId(schId)

      let awardedAmount: number | null = null
      let amountError: string | null = null

      // Use selectedScholarship if it matches the ID, otherwise find from the main array
      // This ensures we have the MOST RECENT data before validation/update
      const scholarshipToUpdate =
        selectedScholarship?.id === schId
          ? selectedScholarship
          : scholarships.find(s => s.id === schId)

      if (!scholarshipToUpdate) {
        console.error('Cannot update status: Scholarship not found', schId)
        setErrors(prev => ({
          ...prev,
          general: 'An error occurred finding the scholarship.'
        }))
        return
      }

      // Validate amount if Awarded
      if (newStatus === 'Awarded') {
        amountError = validateAmount(amtInput)
        if (amountError) {
          setErrors(prev => ({ ...prev, [String(schId)]: amountError }))
          // Keep existing amount if validation fails for immediate UI feedback,
          // but the actual saved amount will depend on logic below.
          // For consistency, we calculate the final awardedAmount *before* updating state.
          awardedAmount = scholarshipToUpdate.awardedAmount // Keep old amount for now
        } else {
          // If valid or becomes valid, calculate the new amount
          const numAmt =
            amtInput !== null && amtInput !== '' ? Number(amtInput) : null
          awardedAmount = numAmt !== null && numAmt > 0 ? numAmt : null
        }
      } else {
        awardedAmount = null // Clear amount if not awarded
      }

      // --- Create the final updated scholarship data ---
      const finalUpdatedData: CombinedScholarship = {
        ...scholarshipToUpdate, // Base on the most recent data we found
        status: newStatus,
        // Use the calculated awardedAmount based on validation logic above
        awardedAmount:
          newStatus === 'Awarded' && !amountError && awardedAmount !== null
            ? awardedAmount
            : null
      }

      // --- Update the main scholarships array state ---
      setScholarships(prevData =>
        prevData.map(sch => {
          if (sch.id === schId) {
            return finalUpdatedData // Return the final data object
          }
          return sch
        })
      )

      // --- FIX: Update selectedScholarship state DIRECTLY if it's the one being edited ---
      if (selectedScholarship?.id === schId) {
        // Update the selectedScholarship state with the final data object
        setSelectedScholarship(finalUpdatedData)
      }
      // --- END FIX ---

      // --- Persist changes ---
      // Prepare data for saving localStorage and syncing budget
      const currentStatusData = getSavedStatusData()
      const statusToSave = finalUpdatedData.status // Use status from final data
      // Amount to save/sync depends on final status and *successful validation*
      const amountToSaveOrSync =
        finalUpdatedData.status === 'Awarded'
          ? finalUpdatedData.awardedAmount
          : null

      const updatedStatusEntry: Partial<
        Pick<CombinedScholarship, 'status' | 'awardedAmount'>
      > = { status: statusToSave }
      if (statusToSave === 'Awarded' && amountToSaveOrSync !== null) {
        updatedStatusEntry.awardedAmount = amountToSaveOrSync
      } else {
        // Ensure amount is removed from LS if status changes from Awarded or amount becomes invalid/null
        delete updatedStatusEntry.awardedAmount
      }

      saveStatusData({
        ...currentStatusData,
        [String(schId)]: updatedStatusEntry
      })

      // Construct object for syncing using final validated data
      const dataToSync: CombinedScholarship = {
        ...scholarshipToUpdate, // Base other details on original
        status: statusToSave,
        awardedAmount: amountToSaveOrSync // Use the final validated/nulled amount for sync
      }

      console.log('Data being sent to sync:', dataToSync)
      const syncSuccess = await syncScholarshipToBudget(dataToSync)

      if (syncSuccess) {
        setSuccessMessage(
          statusToSave === 'Awarded' && amountToSaveOrSync
            ? 'Status & Budget Updated!'
            : 'Status Updated!'
        )
      } else {
        if (!amountError) {
          // Don't show sync error if there was an amount validation error
          setErrors(prev => ({
            ...prev,
            general: 'Failed to sync with budget.'
          }))
          setSuccessMessage('Status Updated (Sync Failed)')
        }
      }

      if (!amountError) {
        setTimeout(() => {
          if (lastActionScholarshipId === schId) {
            setSuccessMessage('')
            setLastActionScholarshipId(null)
          }
        }, 3000)
      }
      // Update dependencies
    },
    [
      scholarships,
      selectedScholarship,
      setSelectedScholarship,
      lastActionScholarshipId /* Other setters are stable */
    ]
  )

  // --- Add/Edit/Delete Custom Scholarship Callbacks --- (useCallback Hooks)
  const openCustomModal = useCallback(
    (mode: 'add' | 'edit', scholarship?: CombinedScholarship) => {
      setModalMode(mode)
      setCustomFormError(null)

      if (mode === 'edit' && scholarship) {
        setCurrentCustomData({
          name: scholarship.name || '',
          description: scholarship.description || '',
          link: scholarship.link || '',
          deadlineDate: scholarship.deadlineDate || null,
          deadlineDisplay: scholarship.deadlineDisplay || '',
          additionalInfo: scholarship.additionalInfo || ''
        })
        setEditingCustomId(String(scholarship.id))
      } else {
        setCurrentCustomData(initialCustomData)
        setEditingCustomId(null)
      }
      setIsCustomModalOpen(true)
    },
    [
      initialCustomData /* Stable setters omitted for brevity, add if linting requires */
    ]
  )

  const handleCustomFormChange = useCallback(
    (field: keyof typeof initialCustomData, value: string | null) => {
      setCurrentCustomData(prev => ({ ...prev, [field]: value }))
      setCustomFormError(null)
    },
    [setCurrentCustomData, setCustomFormError]
  )

  const handleSaveCustomScholarship = useCallback(async () => {
    setCustomFormError(null)
    if (!currentCustomData.name) {
      setCustomFormError('Scholarship Name is required.')
      return
    }

    const scholarshipData: Omit<CustomScholarship, 'id' | 'isCustom'> & {
      id?: string
    } = {
      name: currentCustomData.name,
      description: currentCustomData.description,
      link: currentCustomData.link,
      deadlineDate: currentCustomData.deadlineDate,
      deadlineDisplay:
        currentCustomData.deadlineDisplay ||
        (currentCustomData.deadlineDate &&
        isValid(parseISO(currentCustomData.deadlineDate))
          ? format(parseISO(currentCustomData.deadlineDate), 'MMM dd, yyyy')
          : 'N/A'), // Ensure valid date before formatting
      additionalInfo: currentCustomData.additionalInfo
    }

    let success = false
    let finalId: string | null = null

    try {
      if (modalMode === 'edit' && editingCustomId) {
        const updatedScholarship: CustomScholarship = {
          ...scholarshipData,
          id: editingCustomId,
          isCustom: true
        }
        success = await updateCustomScholarshipInDB(updatedScholarship)
        finalId = editingCustomId
      } else {
        finalId = `custom-${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 8)}`
        const newScholarship: CustomScholarship = {
          ...scholarshipData,
          id: finalId,
          isCustom: true
        }
        success = await addCustomScholarshipToDB(newScholarship)
      }

      if (success && finalId) {
        setScholarships(prev => {
          const existingIndex = prev.findIndex(s => s.id === finalId)
          const updatedEntry: CombinedScholarship = {
            ...scholarshipData,
            id: finalId!,
            isCustom: true,
            categoryType: 'custom',
            status: 'Not Submitted',
            awardedAmount: null
          }

          if (modalMode === 'edit' && existingIndex > -1) {
            const newState = [...prev]
            newState[existingIndex] = updatedEntry
            return newState
          } else {
            return [...prev, updatedEntry]
          }
        })

        setIsCustomModalOpen(false)
        setSuccessMessage(
          modalMode === 'edit'
            ? 'Custom scholarship updated!'
            : 'Custom scholarship added!'
        )
        setLastActionScholarshipId(finalId)
        setTimeout(() => {
          if (lastActionScholarshipId === finalId) setSuccessMessage('')
        }, 3000)
      } else {
        setCustomFormError('Failed to save scholarship to the database.')
      }
    } catch (error) {
      console.error('Error saving custom scholarship:', error)
      setCustomFormError('An unexpected error occurred.')
    }
  }, [
    modalMode,
    editingCustomId,
    currentCustomData,
    scholarships,
    setScholarships,
    setIsCustomModalOpen,
    setSuccessMessage,
    setLastActionScholarshipId,
    setCustomFormError
  ])

  const openDeleteModal = useCallback(
    (scholarship: CombinedScholarship) => {
      if (!scholarship.isCustom) return
      setScholarshipToDelete(scholarship)
      setIsDeleteModalOpen(true)
    },
    [setScholarshipToDelete, setIsDeleteModalOpen]
  )

  const handleDeleteConfirm = useCallback(async () => {
    if (!scholarshipToDelete || !scholarshipToDelete.isCustom) return
    const idToDelete = String(scholarshipToDelete.id)
    try {
      const dbSuccess = await deleteCustomScholarshipFromDB(idToDelete)
      if (dbSuccess) {
        setScholarships(prev => prev.filter(s => s.id !== idToDelete))
        const currentStatusData = getSavedStatusData()
        if (currentStatusData[idToDelete]) {
          delete currentStatusData[idToDelete]
          saveStatusData(currentStatusData)
        }
        const dataToSyncForDelete: CombinedScholarship = {
          ...scholarshipToDelete,
          status: 'Not Submitted',
          awardedAmount: null
        }
        await syncScholarshipToBudget(dataToSyncForDelete)
        setIsDeleteModalOpen(false)
        setScholarshipToDelete(null)
        setSuccessMessage('Custom scholarship deleted.')
        setTimeout(() => setSuccessMessage(''), 3000)
      } else {
        console.error('Failed to delete from DB:', idToDelete)
        alert('Failed to delete scholarship from the database.')
      }
    } catch (error) {
      console.error('Error during custom scholarship deletion:', error)
      alert('An unexpected error occurred while deleting.')
    }
  }, [
    scholarshipToDelete,
    setScholarships,
    setIsDeleteModalOpen,
    setScholarshipToDelete,
    setSuccessMessage
  ])

  // --- Add to Calendar Callback --- (useCallback Hook)
  const addDeadlineToCalendar = useCallback(
    async (scholarship: CombinedScholarship) => {
      if (
        !scholarship ||
        !scholarship.id ||
        !scholarship.name ||
        !scholarship.deadlineDate
      ) {
        console.error(
          'Add to Calendar: Invalid scholarship data provided.',
          scholarship
        )
        setErrors(prev => ({
          ...prev,
          deadline: 'Cannot add: Invalid scholarship data.'
        }))
        setLastActionScholarshipId(scholarship?.id ?? null)
        return
      }
      const dateObj = parseISO(scholarship.deadlineDate)
      if (!isValid(dateObj)) {
        console.error(
          'Add to Calendar: Invalid date format.',
          scholarship.deadlineDate
        )
        setErrors(prev => ({ ...prev, deadline: 'Cannot add: Invalid date.' }))
        setLastActionScholarshipId(scholarship.id)
        return
      }
      setErrors(prev => ({ ...prev, deadline: null, general: null }))
      setSuccessMessage('')
      setLastActionScholarshipId(scholarship.id)
      const newEvent: CalendarEvent = {
        id: `sch-${scholarship.id}`,
        title: `Deadline: ${scholarship.name}`,
        start: scholarship.deadlineDate,
        allDay: true
      }
      try {
        const success = await addEventToCalendarDB(newEvent)
        if (success) {
          setCalendarEvents(prevEvents => {
            if (prevEvents.some(e => e.id === newEvent.id)) return prevEvents
            return [...prevEvents, newEvent]
          })
          setSuccessMessage('Deadline added to calendar!')
          setTimeout(() => {
            if (lastActionScholarshipId === scholarship.id)
              setSuccessMessage('')
          }, 3000)
        } else {
          console.error(
            'Failed to add event to DB for scholarship:',
            scholarship.id
          )
          setErrors(prev => ({ ...prev, deadline: 'Failed to add deadline.' }))
        }
      } catch (error) {
        console.error('Error adding deadline to calendar:', error)
        setErrors(prev => ({ ...prev, deadline: 'Error adding deadline.' }))
      }
    },
    [
      lastActionScholarshipId,
      setCalendarEvents,
      setErrors,
      setSuccessMessage,
      setLastActionScholarshipId
    ]
  )

  // --- Modal Handling --- (useCallback Hooks)
  const handleCardClick = useCallback((sch: CombinedScholarship) => {
    console.log('Card clicked:', sch.id)
    setSelectedScholarship(sch)
    setErrors(prev => ({ ...prev, [String(sch.id)]: null, deadline: null }))
    setSuccessMessage('')
  }, [])

  const closeModal = useCallback(() => setSelectedScholarship(null), [])

  // --- Render Logic ---
  if (loading)
    return (
      <Layout>
        <div className='p-4 text-center dark:text-gray-200'>
          Loading Scholarship Planner...
        </div>
      </Layout>
    )
  if (initError)
    return (
      <Layout>
        <div className='p-4 text-center text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 rounded border border-red-300 dark:border-red-700'>
          {initError}
        </div>
      </Layout>
    )

  return (
    <Layout backgroundImageSrc={background}>
      


      <div className='relative min-h-screen'>
        {/* Optional Background */}
        {/* Main Content Area */}
        <div className='relative z-0 max-w-7xl mx-auto p-4 sm:p-6 backdrop-blur-md rounded-xl shadow-lg bg-white/90 dark:bg-gray-900/85 text-gray-900 dark:text-gray-100 my-8'>
          <h1 className='text-3xl font-bold mb-4 text-center text-gray-900 dark:text-white'>
            Scholarship Planner
          </h1>
          <p className='mb-8 text-center text-lg text-gray-700 dark:text-gray-300 opacity-90 dark:opacity-80'>
            Track applications, manage deadlines, and sync awarded funds.
          </p>

          {errors['general'] && (
            <div
              className='my-4 p-3 bg-red-100 dark:bg-red-900/40 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 rounded text-center text-sm'
              role='alert'
            >
              {' '}
              {errors['general']}{' '}
            </div>
          )}

          {/* Controls Row */}
          <div className='flex flex-col sm:flex-row justify-center items-center gap-4 mb-8 flex-wrap'>
            <Dialog
              open={isCustomModalOpen}
              onOpenChange={setIsCustomModalOpen}
            >
              <DialogTrigger asChild>
                <Button
                  onClick={() => openCustomModal('add')}
                  variant='outline'
                  className={'hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-200'}
                >
                  + Add Custom Scholarship
                </Button>
              </DialogTrigger>
              <DialogContent className='sm:max-w-lg bg-white dark:bg-gray-800'>
                <DialogHeader>
                  <DialogTitle className='text-gray-900 dark:text-gray-100'>
                    {modalMode === 'add'
                      ? 'Add Custom Scholarship'
                      : 'Edit Custom Scholarship'}
                  </DialogTitle>
                  <DialogDescription> Enter details below. </DialogDescription>
                </DialogHeader>
                <div className='grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-3'>
                  <div className='grid grid-cols-4 items-center gap-4'>
                    {' '}
                    <Label
                      htmlFor='custom-name'
                      className='text-right text-gray-700 dark:text-gray-300'
                    >
                      Name*
                    </Label>{' '}
                    <Input
                      id='custom-name'
                      value={currentCustomData.name}
                      onChange={e =>
                        handleCustomFormChange('name', e.target.value)
                      }
                      className='col-span-3 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600'
                    />{' '}
                  </div>
                  <div className='grid grid-cols-4 items-start gap-4'>
                    {' '}
                    <Label
                      htmlFor='custom-desc'
                      className='text-right pt-2 text-gray-700 dark:text-gray-300'
                    >
                      Description
                    </Label>{' '}
                    <Textarea
                      id='custom-desc'
                      value={currentCustomData.description}
                      onChange={e =>
                        handleCustomFormChange('description', e.target.value)
                      }
                      className='col-span-3 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600'
                      rows={3}
                    />{' '}
                  </div>
                  <div className='grid grid-cols-4 items-center gap-4'>
                    {' '}
                    <Label
                      htmlFor='custom-link'
                      className='text-right text-gray-700 dark:text-gray-300'
                    >
                      Link
                    </Label>{' '}
                    <Input
                      id='custom-link'
                      value={currentCustomData.link}
                      onChange={e =>
                        handleCustomFormChange('link', e.target.value)
                      }
                      className='col-span-3 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600'
                      placeholder='Optional'
                    />{' '}
                  </div>
                  <div className='grid grid-cols-4 items-center gap-4'>
                    {' '}
                    <Label
                      htmlFor='custom-date'
                      className='text-right text-gray-700 dark:text-gray-300'
                    >
                      Deadline Date
                    </Label>{' '}
                    <Input
                      id='custom-date'
                      type='date'
                      value={currentCustomData.deadlineDate || ''}
                      onChange={e =>
                        handleCustomFormChange(
                          'deadlineDate',
                          e.target.value || null
                        )
                      }
                      className='col-span-3 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600'
                      placeholder='YYYY-MM-DD'
                    />{' '}
                  </div>
                  <div className='grid grid-cols-4 items-center gap-4'>
                    {' '}
                    <Label
                      htmlFor='custom-display'
                      className='text-right text-gray-700 dark:text-gray-300'
                    >
                      Deadline Text
                    </Label>{' '}
                    <Input
                      id='custom-display'
                      value={currentCustomData.deadlineDisplay}
                      onChange={e =>
                        handleCustomFormChange(
                          'deadlineDisplay',
                          e.target.value
                        )
                      }
                      className='col-span-3 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600'
                      placeholder='Optional'
                    />{' '}
                  </div>
                  <div className='grid grid-cols-4 items-start gap-4'>
                    {' '}
                    <Label
                      htmlFor='custom-info'
                      className='text-right pt-2 text-gray-700 dark:text-gray-300'
                    >
                      Add. Info
                    </Label>{' '}
                    <Textarea
                      id='custom-info'
                      value={currentCustomData.additionalInfo || ''}
                      onChange={e =>
                        handleCustomFormChange('additionalInfo', e.target.value)
                      }
                      className='col-span-3 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600'
                      rows={2}
                    />{' '}
                  </div>
                  {customFormError && (
                    <p className='col-span-4 text-sm text-red-500 dark:text-red-400 text-center pt-2'>
                      {customFormError}
                    </p>
                  )}
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type='button' variant='outline'>
                      Cancel
                    </Button>
                  </DialogClose>
                  <Button type='button' onClick={handleSaveCustomScholarship}>
                    {modalMode === 'add' ? 'Add Scholarship' : 'Save Changes'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <div className='flex gap-4'>
              <label htmlFor='filter-select' className='sr-only'>
                Filter
              </label>
              <select
                id='filter-select'
                value={filter}
                onChange={e => setFilter(e.target.value as any)}
                className='p-2 border rounded shadow-sm bg-white text-gray-900 border-gray-300 dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none min-w-[150px]'
              >
                {' '}
                <option value='all'>All</option>{' '}
                <option value='government'>Gov</option>{' '}
                <option value='school'>School</option>{' '}
                <option value='thirdParty'>Third Party</option>{' '}
                <option value='custom'>Custom</option>{' '}
              </select>
              <label htmlFor='sort-select' className='sr-only'>
                Sort
              </label>
              <select
                id='sort-select'
                value={sort}
                onChange={e => setSort(e.target.value as any)}
                className='p-2 border rounded shadow-sm bg-white text-gray-900 border-gray-300 dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none min-w-[120px]'
              >
                {' '}
                <option value='deadline'>Deadline</option>{' '}
                <option value='name'>Name</option>{' '}
              </select>
            </div>
          </div>

          {/* Grid Display Logic */}
          {displayedScholarships.length === 0 && !loading && (
            <p className='text-center text-gray-600 dark:text-gray-400 mt-8'>
              No scholarships match filter.
            </p>
          )}
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8'>
            {Array.isArray(displayedScholarships) &&
              displayedScholarships.map(scholarship => {
                if (!scholarship) return null
                const schIdStr = String(scholarship.id)
                const isCalendarAdded =
                  Array.isArray(calendarEvents) &&
                  calendarEvents.some(e => e?.id === `sch-${schIdStr}`)
                const amountErr = errors[schIdStr]
                const deadlineErr =
                  errors['deadline'] &&
                  lastActionScholarshipId === scholarship.id
                const showSuccess =
                  successMessage && lastActionScholarshipId === scholarship.id
                const deadlineDateObj = scholarship.deadlineDate
                  ? parseISO(scholarship.deadlineDate)
                  : null
                const isValidDate = deadlineDateObj && isValid(deadlineDateObj)
                const isPast =
                  isValidDate &&
                  deadlineDateObj < new Date(new Date().setHours(0, 0, 0, 0))
                const canAddToCalendar =
                  !!scholarship.deadlineDate && isValidDate
                const deadlineDisplayString = isValidDate
                  ? format(deadlineDateObj, 'MMM dd, yyyy')
                  : scholarship.deadlineDisplay
                return (
                  <Card
                    key={schIdStr}
                    onClick={() => handleCardClick(scholarship)}
                    className={`relative flex flex-col cursor-pointer hover:shadow-lg transition-shadow duration-300 rounded-lg overflow-hidden bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700 ${
                      isPast ? 'opacity-75 filter grayscale-[50%]' : ''
                    }`}
                    title={
                      isPast && isValidDate
                        ? `Deadline Passed: ${deadlineDisplayString}`
                        : scholarship.name
                    }
                    aria-label={`View details for ${scholarship.name}`}
                  >
                    {scholarship.isCustom && (
                      <div className='absolute top-2 right-2 z-10 flex space-x-1'>
                        <Button
                          onClick={e => {
                            e.stopPropagation()
                            openCustomModal('edit', scholarship)
                          }}
                          variant='ghost'
                          size='icon'
                          className='h-6 w-6 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400'
                          title='Edit'
                        >
                          {' '}
                          <Pencil className='h-4 w-4' />{' '}
                        </Button>
                        <Button
                          onClick={e => {
                            e.stopPropagation()
                            openDeleteModal(scholarship)
                          }}
                          variant='ghost'
                          size='icon'
                          className='h-6 w-6 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400'
                          title='Delete'
                        >
                          {' '}
                          <Trash2 className='h-4 w-4' />{' '}
                        </Button>
                      </div>
                    )}
                    <CardHeader className='pb-3 pt-4 pr-12'>
                      <CardTitle className='text-lg font-semibold text-gray-800 dark:text-gray-100'>
                        {scholarship.name || 'Unnamed'}
                      </CardTitle>
                      <p
                        className={`text-sm mt-1 ${
                          isPast
                            ? 'text-red-600 dark:text-red-400 font-medium'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {' '}
                        Deadline:{' '}
                        {scholarship.deadlineDisplay ||
                          (isValidDate ? deadlineDisplayString : 'N/A')}{' '}
                        {isPast && isValidDate ? '(Passed)' : ''}{' '}
                      </p>
                      {scholarship.isCustom && (
                        <span className='text-xs text-blue-500 dark:text-blue-400'>
                          (Custom)
                        </span>
                      )}
                    </CardHeader>
                    <CardContent className='flex-grow pb-4 text-sm'>
                      <p className='mb-4 text-gray-600 dark:text-gray-300'>
                        {scholarship.description}
                      </p>
                      <div className='flex items-center gap-2 mb-3'>
                        <label
                          htmlFor={`status-${schIdStr}`}
                          className='text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap'
                        >
                          Status:
                        </label>
                        <select
                          id={`status-${schIdStr}`}
                          value={scholarship.status}
                          onChange={e =>
                            updateScholarshipStatus(
                              scholarship.id,
                              e.target.value as CombinedScholarship['status'],
                              scholarship.awardedAmount
                            )
                          }
                          onClick={e => e.stopPropagation()}
                          className='p-1 text-sm border rounded shadow-sm bg-white text-gray-900 border-gray-300 dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:ring-1 focus:ring-blue-500 focus:outline-none min-w-[140px]'
                          aria-label={`Update status for ${scholarship.name}`}
                        >
                          <option value='Not Submitted'>Not Submitted</option>
                          <option value='Applied'>Applied</option>
                          <option value='Awarded'>Awarded</option>
                          <option value='Rejected'>Rejected</option>
                        </select>
                      </div>
                      {scholarship.status === 'Awarded' && (
                        <div className='mt-2 space-y-1'>
                          <label
                            htmlFor={`amount-${schIdStr}`}
                            className='flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300'
                          >
                            Amount ($):
                          </label>
                          {/* === INPUT STEP FIX APPLIED HERE === */}
                          <Input
                            id={`amount-${schIdStr}`}
                            type='number'
                            step='0.01'
                            min='0'
                            placeholder='Enter amount'
                            value={scholarship.awardedAmount ?? ''}
                            onChange={e =>
                              updateScholarshipStatus(
                                scholarship.id,
                                'Awarded',
                                e.target.value
                              )
                            }
                            onClick={e => e.stopPropagation()}
                            className={`w-36 p-1 text-sm h-8 border rounded bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:outline-none ${
                              amountErr
                                ? 'border-red-500 dark:border-red-400'
                                : 'border-gray-300 dark:border-gray-600'
                            }`}
                            aria-label={`Awarded amount for ${scholarship.name}`}
                            aria-invalid={!!amountErr}
                            aria-describedby={
                              amountErr ? `amount-error-${schIdStr}` : undefined
                            }
                          />
                          {amountErr && (
                            <p
                              id={`amount-error-${schIdStr}`}
                              className='text-xs text-red-500 dark:text-red-400'
                            >
                              {amountErr}
                            </p>
                          )}
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className='pt-3 border-t mt-auto flex flex-col items-start space-y-2 dark:border-gray-700/50 px-4 pb-3'>
                      <Button
                        variant='outline'
                        size='sm'
                        className={`w-full text-xs h-8 ${
                          isCalendarAdded
                            ? 'text-green-600 border-green-500 dark:text-green-400 dark:border-green-600 cursor-not-allowed'
                            : !canAddToCalendar
                            ? 'text-gray-400 border-gray-300 dark:text-gray-500 dark:border-gray-600 cursor-not-allowed opacity-60'
                            : 'border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-gray-200'
                        }`}
                        onClick={e => {
                          e.stopPropagation()
                          if (canAddToCalendar && !isCalendarAdded)
                            addDeadlineToCalendar(scholarship)
                        }}
                        disabled={isCalendarAdded || !canAddToCalendar}
                        title={
                          !canAddToCalendar
                            ? 'No valid date'
                            : isCalendarAdded
                            ? 'Added'
                            : 'Add deadline'
                        }
                      >
                        {isCalendarAdded
                          ? '✓ Added'
                          : canAddToCalendar
                          ? 'Add to Calendar'
                          : 'No Valid Date'}
                      </Button>
                      <div className='h-4 w-full text-center text-xs mt-1'>
                        {showSuccess && (
                          <p className='text-green-600 dark:text-green-400'>
                            {successMessage}
                          </p>
                        )}
                        {deadlineErr && (
                          <p className='text-red-500 dark:text-red-400'>
                            {errors['deadline']}
                          </p>
                        )}
                      </div>
                    </CardFooter>
                  </Card>
                )
              })}
          </div>
        </div>{' '}
        {/* End Main content container */}
        {/* Delete Custom Scholarship Modal */}
        <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
          <DialogContent className='sm:max-w-[425px] bg-white dark:bg-gray-800'>
            <DialogHeader>
              {' '}
              <DialogTitle>Confirm Deletion</DialogTitle>{' '}
              <DialogDescription>
                {' '}
                Delete{' '}
                <strong className='...'>
                  "{scholarshipToDelete?.name}"
                </strong>?{' '}
              </DialogDescription>{' '}
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button type='button' variant='outline'>
                  Cancel
                </Button>
              </DialogClose>
              <Button
                type='button'
                variant='destructive'
                onClick={handleDeleteConfirm}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Detail Modal */}
        {selectedScholarship && (
          <div
            className='fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center p-4 z-50'
            onClick={closeModal}
            role='dialog'
            aria-modal='true'
            aria-labelledby='modal-title'
          >
            <Card
              className='w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white border border-gray-300 text-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 shadow-2xl rounded-lg'
              onClick={e => e.stopPropagation()}
            >
              <CardHeader className='border-b pb-4 dark:border-gray-700/50 sticky top-0 bg-white dark:bg-gray-800 z-10'>
                {' '}
                <CardTitle
                  id='modal-title'
                  className='text-xl sm:text-2xl text-gray-900 dark:text-gray-100'
                >
                  {selectedScholarship.name}
                </CardTitle>{' '}
              </CardHeader>
              <CardContent className='px-6 pt-6 pb-4 space-y-4'>
                <p className='text-base text-gray-700 dark:text-gray-300'>
                  {selectedScholarship.description}
                </p>
                {selectedScholarship.additionalInfo && (
                  <p className='text-sm text-gray-600 dark:text-gray-400'>
                    {selectedScholarship.additionalInfo}
                  </p>
                )}
                <div className='text-sm text-gray-700 dark:text-gray-300'>
                  <strong>Deadline:</strong>{' '}
                  {selectedScholarship.deadlineDisplay ||
                    (selectedScholarship.deadlineDate &&
                    isValid(parseISO(selectedScholarship.deadlineDate))
                      ? format(
                          parseISO(selectedScholarship.deadlineDate),
                          'MMM dd, yyyy'
                        )
                      : 'N/A')}
                </div>
                <div className='space-y-3 border-t pt-4 dark:border-gray-700/50'>
                  <label className='flex items-center gap-2 text-sm'>
                    {' '}
                    <span className='font-medium text-gray-700 dark:text-gray-300 w-20'>
                      Status:
                    </span>{' '}
                    <select
                      value={selectedScholarship.status}
                      onChange={e =>
                        updateScholarshipStatus(
                          selectedScholarship.id,
                          e.target.value as any,
                          selectedScholarship.awardedAmount
                        )
                      }
                      className='p-1 rounded border shadow-sm bg-white text-gray-900 border-gray-300 dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:ring-1 focus:ring-blue-500 focus:outline-none min-w-[140px]'
                      aria-label={`Update status for ${selectedScholarship.name} in modal`}
                    >
                      {' '}
                      <option value='Not Submitted'>Not Submitted</option>{' '}
                      <option value='Applied'>Applied</option>{' '}
                      <option value='Awarded'>Awarded</option>{' '}
                      <option value='Rejected'>Rejected</option>{' '}
                    </select>{' '}
                  </label>
                  {selectedScholarship.status === 'Awarded' && (
                    <div className='space-y-1 pl-2'>
                      <label className='flex items-center gap-2 text-sm'>
                        {' '}
                        <span className='font-medium text-gray-700 dark:text-gray-300 w-[72px]'>
                          Awarded ($):
                        </span>
                        {/* === INPUT STEP FIX APPLIED HERE === */}
                        <Input
                          type='number'
                          step='0.01'
                          min='0'
                          placeholder='Amount'
                          value={selectedScholarship.awardedAmount ?? ''}
                          onChange={e =>
                            updateScholarshipStatus(
                              selectedScholarship.id,
                              'Awarded',
                              e.target.value
                            )
                          }
                          className={`w-32 p-1 text-sm h-8 border rounded bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:outline-none ${
                            errors[String(selectedScholarship.id)]
                              ? 'border-red-500 dark:border-red-400'
                              : 'border-gray-300 dark:border-gray-600'
                          }`}
                          aria-label={`Awarded amount for ${selectedScholarship.name} in modal`}
                          aria-invalid={
                            !!errors[String(selectedScholarship.id)]
                          }
                          aria-describedby={
                            errors[String(selectedScholarship.id)]
                              ? `modal-amount-error-${selectedScholarship.id}`
                              : undefined
                          }
                        />
                      </label>
                      {errors[String(selectedScholarship.id)] && (
                        <p
                          id={`modal-amount-error-${selectedScholarship.id}`}
                          className='text-xs text-red-500 dark:text-red-400 pl-[80px]'
                        >
                          {errors[String(selectedScholarship.id)]}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                {selectedScholarship.link && (
                  <a
                    href={
                      selectedScholarship.link.startsWith('http')
                        ? selectedScholarship.link
                        : `//${selectedScholarship.link}`
                    }
                    target='_blank'
                    rel='noopener noreferrer'
                    className='inline-block text-sm underline mt-3 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300'
                  >
                    {' '}
                    Visit Website →{' '}
                  </a>
                )}
                <div className='h-5 text-center text-sm mt-3'>
                  {successMessage &&
                    selectedScholarship.id === lastActionScholarshipId && (
                      <p className='text-green-600 dark:text-green-400'>
                        {successMessage}
                      </p>
                    )}
                  {errors['deadline'] &&
                    selectedScholarship.id === lastActionScholarshipId && (
                      <p className='text-red-500 dark:text-red-400'>
                        {errors['deadline']}
                      </p>
                    )}
                </div>
              </CardContent>
              <CardFooter className='flex flex-col sm:flex-row justify-end gap-3 border-t pt-4 dark:border-gray-700/50 sticky bottom-0 bg-white dark:bg-gray-800 z-10 px-6 pb-4'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => {
                    const d = selectedScholarship.deadlineDate
                      ? parseISO(selectedScholarship.deadlineDate)
                      : null
                    const v = d && isValid(d)
                    if (v) addDeadlineToCalendar(selectedScholarship)
                  }}
                  disabled={
                    !selectedScholarship.deadlineDate ||
                    !isValid(parseISO(selectedScholarship.deadlineDate)) ||
                    calendarEvents.some(e =>
                      e.id?.startsWith(`sch-${selectedScholarship.id}`)
                    )
                  }
                  className={`text-xs h-8 ${
                    !selectedScholarship.deadlineDate ||
                    !isValid(parseISO(selectedScholarship.deadlineDate))
                      ? 'text-gray-400 dark:text-gray-500 border-gray-300 dark:border-gray-600 cursor-not-allowed opacity-60'
                      : calendarEvents.some(e =>
                          e.id?.startsWith(`sch-${selectedScholarship.id}`)
                        )
                      ? 'text-green-600 dark:text-green-400 border-green-500 dark:border-green-600 cursor-not-allowed'
                      : 'border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-gray-200'
                  }`}
                  title={
                    !selectedScholarship.deadlineDate ||
                    !isValid(parseISO(selectedScholarship.deadlineDate))
                      ? 'No valid date'
                      : calendarEvents.some(e =>
                          e.id?.startsWith(`sch-${selectedScholarship.id}`)
                        )
                      ? 'Added'
                      : 'Add deadline'
                  }
                >
                  {!selectedScholarship.deadlineDate ||
                  !isValid(parseISO(selectedScholarship.deadlineDate))
                    ? 'No Valid Date'
                    : calendarEvents.some(e =>
                        e.id?.startsWith(`sch-${selectedScholarship.id}`)
                      )
                    ? '✓ Added'
                    : 'Add Deadline'}
                </Button>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => router.push('/calendar')}
                  className='text-xs h-8 border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-gray-200'
                >
                  View Calendar
                </Button>
                <Button
                  variant='default'
                  size='sm'
                  onClick={closeModal}
                  className='text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500 dark:hover:bg-blue-600'
                >
                  Close
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  )
}
