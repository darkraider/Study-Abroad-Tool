'use client'

import React, { useState, useEffect, useMemo } from 'react' // Added React explicitly for component type
import { useRouter } from 'next/navigation'
import Layout from '@/app/components/layout' // Verify path
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar'
import 'react-circular-progressbar/dist/styles.css'
import {
  format,
  differenceInWeeks,
  parseISO,
  isValid,
  differenceInCalendarDays
} from 'date-fns'
import { getDb, STORE_NAMES } from '@/lib/db' // Verify path
import { Button } from '@/components/ui/button'
import Image from 'next/image' // Make sure Image is imported
import background from '../../public/backgrounds/home-bg.webp' // Import the specific background

// --- Type Definitions ---
// Define types based on expected DB structure (adjust if your db.ts schema differs)
type CalendarEvent = {
  id: string
  title: string
  start: string // ISO String
  end?: string // ISO String
  allDay: boolean
  // Add other relevant fields if they exist in your DB schema
}

type SavingsEntry = {
  id: number
  name: string
  weeklyAmount: number
  startDate: string // ISO String
  dateAdded: string // ISO String
}

type ExpenseCategory = {
  id: number
  category: string
  type: 'expense' | 'asset'
  items: Array<{
    id: number | string
    item: string
    cost: number
  }>
}

type BudgetProgressData = {
  totalBudget: number
  totalSaved: number
  scholarshipTotal: number
  progress: number
}

// --- Constants ---
const SCHOLARSHIP_CATEGORY = 'Scholarships'
const DAYS_AHEAD_FOR_DEADLINES = 30

// --- Data Fetching Function (Using central DB access) ---
// Added specific types
const getAllDashboardData = async (): Promise<{
  deadlines: CalendarEvent[]
  budgetProgress: BudgetProgressData
}> => {
  let deadlines: CalendarEvent[] = []
  let budgetProgressData: BudgetProgressData = {
    totalBudget: 0,
    totalSaved: 0,
    scholarshipTotal: 0,
    progress: 0
  }

  try {
    const db = await getDb()
    // Ensure all types match the stores defined in db.ts
    const tx = db.transaction(
      [STORE_NAMES.CALENDAR, STORE_NAMES.EXPENSES, STORE_NAMES.SAVINGS],
      'readonly'
    )

    // Destructure with explicit types if possible, though getAll returns arrays
    const [allEvents, allExpenses, allSavings] = await Promise.all([
      tx.objectStore(STORE_NAMES.CALENDAR).getAll() as Promise<CalendarEvent[]>,
      tx.objectStore(STORE_NAMES.EXPENSES).getAll() as Promise<
        ExpenseCategory[]
      >,
      tx.objectStore(STORE_NAMES.SAVINGS).getAll() as Promise<SavingsEntry[]>
      // tx.done // tx.done should not be awaited within Promise.all with store operations
    ])
    await tx.done // Await transaction completion *after* store operations finish

    // Process Deadlines
    const now = new Date()
    const futureDateLimit = new Date()
    futureDateLimit.setDate(now.getDate() + DAYS_AHEAD_FOR_DEADLINES)
    const todayStart = new Date() // For comparison without time
    todayStart.setHours(0, 0, 0, 0)

    deadlines = allEvents
      .filter(event => {
        if (!event?.start) return false // Basic check
        try {
          const deadline = parseISO(event.start)
          // Check if valid, is today or in the future, and within the limit
          return (
            isValid(deadline) &&
            deadline >= todayStart &&
            deadline <= futureDateLimit
          )
        } catch {
          return false
        }
      })
      .sort((a, b) => {
        try {
          // Sort valid dates; handle potential invalid dates defensively
          const dateA = parseISO(a.start)
          const dateB = parseISO(b.start)
          if (!isValid(dateA) && !isValid(dateB)) return 0
          if (!isValid(dateA)) return 1 // Invalid dates sort last
          if (!isValid(dateB)) return -1
          return dateA.getTime() - dateB.getTime()
        } catch {
          return 0
        }
      })
      .slice(0, 5) // Take top 5 upcoming

    // Process Budget
    const totalExpenses = allExpenses
      .filter(cat => cat?.type === 'expense') // Add null check for cat
      .reduce((total, cat) => {
        const items = Array.isArray(cat.items) ? cat.items : []
        // Add null/cost checks for item
        return (
          total +
          items.reduce((sum, item) => sum + (Number(item?.cost) || 0), 0)
        )
      }, 0)

    // Use defined constant for Scholarship category
    const scholarships =
      allExpenses.find(cat => cat?.category === SCHOLARSHIP_CATEGORY)?.items ||
      []
    const scholarshipTotal = scholarships.reduce(
      (sum, item) => sum + (Number(item?.cost) || 0),
      0
    )

    const calculateTotalSavedForEntry = (entry: SavingsEntry): number => {
      // Add basic check for entry and weeklyAmount validity
      if (
        !entry ||
        typeof entry.weeklyAmount !== 'number' ||
        entry.weeklyAmount < 0
      )
        return 0
      // Check startDate validity
      if (!entry.startDate || typeof entry.startDate !== 'string')
        return entry.weeklyAmount // Fallback: return one week if no valid start date

      try {
        const startDate = parseISO(entry.startDate)
        if (!isValid(startDate)) return 0 // Return 0 if date is invalid

        const weeksSaved = differenceInWeeks(new Date(), startDate) // differenceInWeeks calculates *full* weeks passed

        // If start date is in the future, weeksSaved will be negative.
        // We assume saving starts *from* the start date, so 0 saved before then.
        // Add 1 only if the difference is >= 0 to include the starting week.
        const relevantWeeks = weeksSaved >= 0 ? weeksSaved + 1 : 0

        return entry.weeklyAmount * relevantWeeks
      } catch {
        return 0
      } // Return 0 on parsing error
    }

    const totalSavedFromSavings = allSavings.reduce(
      (sum, entry) => sum + calculateTotalSavedForEntry(entry),
      0
    )
    const totalFundsAvailable = totalSavedFromSavings + scholarshipTotal

    budgetProgressData = {
      totalBudget: totalExpenses,
      totalSaved: totalFundsAvailable,
      scholarshipTotal,
      // Ensure progress doesn't exceed 100% visually unless intended
      progress:
        totalExpenses > 0
          ? Math.min(100, (totalFundsAvailable / totalExpenses) * 100)
          : totalFundsAvailable > 0
          ? 100
          : 0
    }
  } catch (error) {
    console.error('Error fetching dashboard data:', error)
    // Return default empty data on error - component handles display
  }
  return { deadlines, budgetProgress: budgetProgressData }
}

// --- Deadline Item Component ---
// Encapsulates the rendering logic for a single deadline item
const DeadlineItem: React.FC<{ event: CalendarEvent }> = ({ event }) => {
  let formattedStart = 'Invalid Date'
  let formattedEnd = ''
  let daysRemainingText = ''

  try {
    const startDate = parseISO(event.start)
    if (isValid(startDate)) {
      formattedStart = format(startDate, 'MMM dd, yyyy') // Format date

      // Calculate days remaining relative to the start of today
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const eventStartDay = new Date(startDate)
      eventStartDay.setHours(0, 0, 0, 0)

      // Use differenceInCalendarDays for more intuitive "days left"
      const daysRemaining = differenceInCalendarDays(eventStartDay, todayStart)

      if (daysRemaining >= 0) {
        daysRemainingText = `${daysRemaining} day${
          daysRemaining !== 1 ? 's' : ''
        } remaining`
      } else {
        // Handle past events if they somehow slip through filter (shouldn't happen)
        daysRemainingText = 'Past Due'
      }

      // Format end date if present and valid
      if (event.end) {
        const endDate = parseISO(event.end)
        if (isValid(endDate)) {
          formattedEnd = ` - ${format(endDate, 'MMM dd, yyyy')}`
        }
      }
    }
  } catch (e) {
    console.error('Date Format Err in DeadlineItem:', e)
    // Keep default 'Invalid Date' text
  }

  return (
    <li
      key={event.id}
      className='p-3 rounded-lg bg-gray-100 hover:bg-gray-200/80 dark:bg-gray-700 dark:hover:bg-gray-600/80 transition-colors text-gray-900 dark:text-gray-100'
    >
      <div className='font-semibold text-base'>
        {event.title || 'Untitled Event'}
      </div>
      <div className='text-sm opacity-90 dark:opacity-80'>
        {formattedStart}
        {formattedEnd}
      </div>
      {daysRemainingText && (
        <div className='text-xs opacity-75 mt-1'>{daysRemainingText}</div>
      )}
    </li>
  )
}

// --- HomeScreen Component ---
export default function HomeScreen () {
  const router = useRouter()

  // Use specific types for state
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<CalendarEvent[]>(
    []
  )
  const [budgetProgress, setBudgetProgress] = useState<BudgetProgressData>({
    totalBudget: 0,
    totalSaved: 0,
    scholarshipTotal: 0,
    progress: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const navigateTo = (path: string) => {
    router.push(path)
  }

  // Fetch data on component mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        const { deadlines, budgetProgress: progressData } =
          await getAllDashboardData()
        setUpcomingDeadlines(deadlines)
        setBudgetProgress(progressData)
      } catch (err) {
        console.error('Error loading dashboard data in useEffect:', err)
        setError('Failed to load dashboard data. Please try again later.')
        setUpcomingDeadlines([]) // Reset on error
        setBudgetProgress({
          totalBudget: 0,
          totalSaved: 0,
          scholarshipTotal: 0,
          progress: 0
        }) // Reset on error
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, []) // Empty dependency array ensures this runs once on mount

  // Derived calculations (using useMemo for slight optimization/readability, though optional here)
  const remainingBudget = useMemo(() => {
    return budgetProgress.totalBudget - budgetProgress.totalSaved
  }, [budgetProgress.totalBudget, budgetProgress.totalSaved])

  const savedAmountExcludingScholarships = useMemo(() => {
    return budgetProgress.totalSaved - budgetProgress.scholarshipTotal
  }, [budgetProgress.totalSaved, budgetProgress.scholarshipTotal])

  return (
    <Layout backgroundImageSrc={background}>
      {/* Background Image: Fixed, Covers viewport, behind content */}

      {/* Main Content Area: Relative positioning with padding-top for nav */}
      <div className='relative z-0'>
        {' '}
        {/* Added min-h-screen here ensures content area can fill viewport height if needed */}
        {/* Main Grid Layout */}
        <div className='max-w-7xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6'>
          {/* Left Panel: Budget Progress */}
          <div className='backdrop-blur-lg rounded-xl shadow-lg p-6 bg-white/95 dark:bg-gray-800/90'>
            <h3 className='text-xl font-bold mb-4 text-gray-900 dark:text-gray-100'>
              Budget Progress
            </h3>
            {loading ? (
              <div className='flex justify-center items-center h-40 text-gray-600 dark:text-gray-400'>
                <p>Loading Budget...</p>
              </div>
            ) : error ? (
              <div className='flex justify-center items-center h-40 text-red-500 p-4 text-center'>
                <p>{error}</p>
              </div>
            ) : (
              <div className='flex flex-col md:flex-row items-center gap-6'>
                <div className='w-32 h-32 flex-shrink-0'>
                  <CircularProgressbar
                    value={budgetProgress.progress}
                    text={`${Math.round(budgetProgress.progress)}%`}
                    styles={buildStyles({
                      // Colors should adapt based on theme via CSS variables defined in globals.css
                      pathColor: `rgba(62, 152, 199, ${Math.max(
                        0.1,
                        budgetProgress.progress / 100
                      )})`, // Example color, adjust as needed
                      textColor: 'var(--progress-text-color)', // Uses CSS variable
                      trailColor: 'var(--progress-trail-color)', // Uses CSS variable
                      backgroundColor: '#3e98c7'
                    })}
                  />
                </div>
                <div className='space-y-2 text-center md:text-left text-sm'>
                  <p className='font-medium text-gray-900 dark:text-gray-100'>
                    <span className='text-gray-600 dark:text-gray-400'>
                      Target Budget:
                    </span>
                    <span className='ml-2'>
                      ${budgetProgress.totalBudget.toFixed(2)}
                    </span>
                  </p>
                  <p className='font-medium text-gray-900 dark:text-gray-100'>
                    <span className='text-gray-600 dark:text-gray-400'>
                      Scholarships:
                    </span>
                    <span className='ml-2'>
                      ${budgetProgress.scholarshipTotal.toFixed(2)}
                    </span>
                  </p>
                  <p className='font-medium text-gray-900 dark:text-gray-100'>
                    <span className='text-gray-600 dark:text-gray-400'>
                      Personal Savings:
                    </span>
                    <span className='ml-2'>
                      $
                      {Math.max(0, savedAmountExcludingScholarships).toFixed(2)}
                    </span>
                  </p>
                  <p className='font-bold text-gray-900 dark:text-gray-100'>
                    <span className='text-gray-600 dark:text-gray-400 font-medium'>
                      Total Funds:
                    </span>
                    <span className='ml-2'>
                      ${budgetProgress.totalSaved.toFixed(2)}
                    </span>
                  </p>
                  <p
                    className={`font-bold ${
                      remainingBudget > 0
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-green-600 dark:text-green-400'
                    }`}
                  >
                    <span className='text-gray-600 dark:text-gray-400 font-medium'>
                      Remaining Need:
                    </span>
                    <span className='ml-2'>
                      ${Math.max(0, remainingBudget).toFixed(2)}
                    </span>
                    {remainingBudget < 0 && (
                      <span className='ml-2 text-xs font-medium'>
                        (Surplus: ${(-remainingBudget).toFixed(2)})
                      </span>
                    )}
                  </p>
                  <Button
                    onClick={() => navigateTo('/budget')}
                    size='sm'
                    className='mt-2'
                  >
                    View Budget Details
                  </Button>
                  <Button
                    onClick={() => navigateTo('/savings')}
                    size='sm'
                    className='mt-2 ml-2'
                  >
                    View Savings Plan
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Center Panel: Main Content/Info */}
          <div className='backdrop-blur-lg rounded-xl shadow-lg p-6 bg-white/95 dark:bg-gray-800/90'>
            <h1 className='text-2xl lg:text-3xl font-bold mb-4 text-center text-gray-900 dark:text-gray-100'>
              Plan Your Study Abroad Journey
            </h1>
            <p className='text-base lg:text-lg mb-6 text-center text-gray-700 dark:text-gray-300'>
              Use these tools to manage funding, track deadlines, and stay
              organized:
            </p>
            <ul className='space-y-4 text-sm lg:text-base'>
              <li className='flex items-start'>
                <span className='text-blue-600 dark:text-blue-400 font-bold text-xl mr-2 mt-[-2px]'>
                  •
                </span>
                <p className='text-gray-800 dark:text-gray-200'>
                  <strong className='font-semibold'>
                    Explore Scholarships:
                  </strong>{' '}
                  Browse opportunities and track your application status.
                </p>
              </li>
              <Button
                onClick={() => navigateTo('/scholarshipplan')}
                variant='link'
                className='text-blue-600 dark:text-blue-400 h-auto p-0 ml-5 text-sm lg:text-base'
              >
                Go to Scholarship Planner →
              </Button>

              <li className='flex items-start mt-3'>
                <span className='text-blue-600 dark:text-blue-400 font-bold text-xl mr-2 mt-[-2px]'>
                  •
                </span>
                <p className='text-gray-800 dark:text-gray-200'>
                  <strong className='font-semibold'>Track Deadlines:</strong>{' '}
                  Add important dates to the calendar so you never miss out.
                </p>
              </li>
              <Button
                onClick={() => navigateTo('/calendar')}
                variant='link'
                className='text-blue-600 dark:text-blue-400 h-auto p-0 ml-5 text-sm lg:text-base'
              >
                Go to Calendar →
              </Button>

              <li className='flex items-start mt-3'>
                <span className='text-blue-600 dark:text-blue-400 font-bold text-xl mr-2 mt-[-2px]'>
                  •
                </span>
                <p className='text-gray-800 dark:text-gray-200'>
                  <strong className='font-semibold'>Manage Your Budget:</strong>{' '}
                  Organize expenses and track funds to stay financially
                  prepared.
                </p>
              </li>
              <Button
                onClick={() => navigateTo('/budget')}
                variant='link'
                className='text-blue-600 dark:text-blue-400 h-auto p-0 ml-5 text-sm lg:text-base'
              >
                Go to Budget →
              </Button>
            </ul>
          </div>

          {/* Right Panel: Upcoming Deadlines */}
          <div className='backdrop-blur-lg rounded-xl shadow-lg p-6 bg-white/95 dark:bg-gray-800/90'>
            <h3 className='text-xl font-bold mb-4 text-gray-900 dark:text-gray-100'>
              Upcoming Deadlines{' '}
              <span className='text-sm font-normal text-gray-500 dark:text-gray-400'>
                (Next {DAYS_AHEAD_FOR_DEADLINES} Days)
              </span>
            </h3>
            {loading ? (
              <div className='flex justify-center items-center h-40 text-gray-600 dark:text-gray-400'>
                <p>Loading Deadlines...</p>
              </div>
            ) : error ? (
              <div className='flex justify-center items-center h-40 text-red-500 p-4 text-center'>
                <p>{error}</p>
              </div>
            ) : upcomingDeadlines.length > 0 ? (
              <ul className='space-y-3'>
                {/* Use the DeadlineItem component */}
                {upcomingDeadlines.map(event => (
                  <DeadlineItem key={event.id} event={event} />
                ))}
              </ul>
            ) : (
              <div className='text-center py-6'>
                <p className='text-gray-600 dark:text-gray-400'>
                  No upcoming deadlines found.
                </p>
                <Button
                  onClick={() => navigateTo('/calendar')}
                  size='sm'
                  className='mt-4'
                >
                  View Full Calendar
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}

// Reminder for CSS Variables needed for CircularProgressbar in globals.css
/*
:root {
  --progress-text-color: #1f2937; // e.g., gray-800
  --progress-trail-color: #e5e7eb; // e.g., gray-200
}
html.dark {
  --progress-text-color: #f3f4f6; // e.g., gray-100
  --progress-trail-color: #374151; // e.g., gray-700
}
*/
