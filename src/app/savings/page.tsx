"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Ensure path is correct
import { Button } from "@/components/ui/button"; // Ensure path is correct
import { Input } from "@/components/ui/input"; // Ensure path is correct
import Layout from "@/app/components/layout"; // Ensure path is correct
// Removed useTheme import - styling is now handled by Tailwind dark: variants
// import { useTheme } from "@/context/ThemeContext";
import { useRouter } from "next/navigation";
import { format, differenceInWeeks, parseISO, isValid } from "date-fns";
import { getDb, STORE_NAMES } from "@/lib/db"; // Ensure path is correct

// --- Type Definitions ---
type SavingsEntry = {
  id: number;
  name: string;
  weeklyAmount: number;
  startDate: string; // ISO Date string (YYYY-MM-DD)
  dateAdded: string; // ISO DateTime string
};

// Matches Expense Category structure (needed for budget calculation)
type ExpenseCategory = {
  id: number;
  category: string;
  type: "expense" | "asset";
  items: Array<{ id: number | string; item: string; cost: number }>;
};

// --- Utility Functions ---
const calculateTotalSavedForEntry = (entry: SavingsEntry): number => {
    if (!entry || !entry.startDate || typeof entry.weeklyAmount !== 'number') return 0;
    try {
        const startDate = parseISO(entry.startDate);
        const now = new Date();
        if (!isValid(startDate) || startDate > now) return 0;
        const weeksSaved = differenceInWeeks(now, startDate) + 1;
        return (entry.weeklyAmount || 0) * Math.max(weeksSaved, 0); // Use Math.max(..., 0)
    } catch (e) { console.error("Calc Save Err:", e); return 0; }
};

// --- Component ---
export default function SavingsCalculator() {
  const router = useRouter();
  // Input State
  const [contributionName, setContributionName] = useState("");
  const [weeklyAmount, setWeeklyAmount] = useState("");
  const [startDate, setStartDate] = useState("");
  // Data State
  const [savingsEntries, setSavingsEntries] = useState<SavingsEntry[]>([]);
  const [totalCost, setTotalCost] = useState(0);
  const [fundsAvailable, setFundsAvailable] = useState(0);
  // Derived State
  const [totalWeekly, setTotalWeekly] = useState(0);
  const [totalSaved, setTotalSaved] = useState(0);
  const [timeEstimate, setTimeEstimate] = useState("");
  const [fundingPercentage, setFundingPercentage] = useState(0);
  // UI State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Data Loading ---
  useEffect(() => {
    const loadData = async () => {
      setLoading(true); setError(null);
      try {
        const db = await getDb();
        const tx = db.transaction([STORE_NAMES.SAVINGS, STORE_NAMES.EXPENSES], "readonly");
        const savingsStore = tx.objectStore(STORE_NAMES.SAVINGS);
        const expensesStore = tx.objectStore(STORE_NAMES.EXPENSES);
        const [entries, allBudgetCategories] = await Promise.all([
            savingsStore.getAll(), expensesStore.getAll(),
        ]);
        await tx.done;

        const validEntries = entries.filter(e => e && typeof e.weeklyAmount==='number' && !isNaN(e.weeklyAmount) && e.startDate);
        setSavingsEntries(validEntries);

        let calculatedTotalExpenses = 0; let calculatedScholarshipTotal = 0;
        allBudgetCategories.forEach(cat => {
            const items = Array.isArray(cat.items) ? cat.items : [];
            const categoryTotal = items.reduce((s, i) => s + (Number(i?.cost) || 0), 0);
            if (cat.category === "Scholarships" || cat.type === "asset") { calculatedScholarshipTotal += categoryTotal; }
            else if (cat.type === "expense") { calculatedTotalExpenses += categoryTotal; }
        });
        setTotalCost(calculatedTotalExpenses); setFundsAvailable(calculatedScholarshipTotal);
      } catch (err) { console.error("Load Err:", err); setError("Failed load."); setSavingsEntries([]); setTotalCost(0); setFundsAvailable(0);
      } finally { setLoading(false); }
    };
    loadData();
  }, []);

  // --- Calculations (Derived State Updates) ---
  useEffect(() => {
    const weekly = savingsEntries.reduce((a, e) => a + (e.weeklyAmount || 0), 0);
    const saved = savingsEntries.reduce((a, e) => a + calculateTotalSavedForEntry(e), 0);
    setTotalWeekly(weekly); setTotalSaved(saved);

    const remain = Math.max(totalCost - fundsAvailable - saved, 0);
    if (weekly <= 0 || remain <= 0) { setTimeEstimate(remain <= 0 && totalCost > 0 ? "Goal Reached!" : "Add contributions"); }
    else { const w = Math.ceil(remain / weekly); const y = Math.floor(w / 52); const m = Math.floor((w % 52) / 4); const rw = w % 4; let p: string[] = []; if (y > 0) p.push(`${y} yr${y > 1 ? "s" : ""}`); if (m > 0) p.push(`${m} mo${m > 1 ? "s" : ""}`); if (rw > 0) p.push(`${rw} wk${rw > 1 ? "s" : ""}`); setTimeEstimate(p.length > 0 ? p.join(" ") : "< 1 wk"); }

    if (totalCost <= 0) { setFundingPercentage(fundsAvailable + saved > 0 ? 100 : 0); }
    else { const perc = ((fundsAvailable + saved) / totalCost) * 100; setFundingPercentage(Math.max(0, Math.min(perc, 100))); }
  }, [savingsEntries, totalCost, fundsAvailable]);

  // --- Event Handlers (DB Write Operations) ---
  const handleAddSavings = useCallback(async () => {
    setError(null);
    if (!contributionName.trim() || !weeklyAmount || !startDate) { setError("All fields required."); return; }
    const amount = parseFloat(weeklyAmount);
    if (isNaN(amount)) { setError("Invalid amount."); return; }
    if (amount <= 0) { setError("Amount > 0."); return; }
    if (amount > 25000) { setError("Max $25k."); return; }
    try { if(!isValid(parseISO(startDate))) throw new Error("Invalid date"); } catch (e) { setError("Invalid start date."); return; }

    const newEntry: SavingsEntry = { id: Date.now(), name: contributionName.trim(), weeklyAmount: amount, startDate: startDate, dateAdded: new Date().toISOString() };
    try {
        const db = await getDb();
        const tx = db.transaction(STORE_NAMES.SAVINGS, "readwrite");
        await tx.objectStore(STORE_NAMES.SAVINGS).put(newEntry);
        await tx.done;
        setSavingsEntries(prev => [...prev, newEntry]);
        setContributionName(""); setWeeklyAmount(""); setStartDate("");
    } catch (err) { console.error("Add Save Err:", err); setError("Failed add."); }
  }, [contributionName, weeklyAmount, startDate]); // Dependencies for adding

  const handleRemoveSavings = useCallback(async (id: number) => {
    setError(null);
    try {
        const db = await getDb();
        const tx = db.transaction(STORE_NAMES.SAVINGS, "readwrite");
        await tx.objectStore(STORE_NAMES.SAVINGS).delete(id);
        await tx.done;
        setSavingsEntries(prev => prev.filter(e => e.id !== id));
    } catch (err) { console.error("Remove Save Err:", err); setError("Failed remove."); }
  }, []); // No dependencies needed for remove by ID


  // --- Render Logic ---
  if (loading) return <Layout><div className="p-4 text-center dark:text-gray-200">Loading Calculator...</div></Layout>;

  return (
    <Layout>
      <div className="relative min-h-screen">
         {/* Background Image - Using -z-9 as requested */}
        {/* <div className="fixed inset-0 -z-9 bg-[url('/backgrounds/savings-bg.jpg')] bg-cover blur-sm" style={{ filter: 'brightness(0.8)' }} /> */}

        {/* Main container uses dark: variants */}
        <div className="max-w-4xl mx-auto p-6 backdrop-blur-lg rounded-xl shadow-lg bg-white/95 text-gray-900 dark:bg-gray-900/90 dark:text-gray-100">
          <h1 className="text-3xl font-bold mb-8 text-center text-black dark:text-white">Savings Calculator</h1>
          {error && <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 rounded text-center">{error}</div>}

          {/* How to Use - Uses dark: variants */}
          <Card className="mb-6 bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700">
             <CardHeader><CardTitle className="text-xl text-gray-800 dark:text-gray-100">How it Works</CardTitle></CardHeader>
             <CardContent className="space-y-2 text-sm">
               <p className="text-gray-600 dark:text-gray-300">1. Budget data (Total Cost, Scholarships) is pulled from your Budget Sheet.</p>
               <p className="text-gray-600 dark:text-gray-300">2. Add your weekly savings contributions below.</p>
               <p className="text-gray-600 dark:text-gray-300">3. See progress, total saved (based on start dates), and time to goal.</p>
               <p className="text-gray-600 dark:text-gray-300">4. Update budget via the <Button variant="link" className="p-0 h-auto text-blue-600 dark:text-blue-400" onClick={()=>router.push('/budget')}>Budget Sheet</Button>.</p>
             </CardContent>
          </Card>

          {/* Progress Overview Section - Uses dark: variants */}
          <Card className="mb-6 bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700">
            <CardHeader><CardTitle className="text-xl text-gray-800 dark:text-gray-100">Progress Overview</CardTitle></CardHeader>
            <CardContent>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                   <div className="text-center p-3 rounded bg-gray-100/80 dark:bg-gray-700/60">
                       <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Remaining Need</div>
                       <div className="text-2xl font-bold text-red-600 dark:text-red-400">${Math.max(totalCost - fundsAvailable - totalSaved, 0).toFixed(2)}</div>
                   </div>
                   <div className="text-center p-3 rounded bg-gray-100/80 dark:bg-gray-700/60">
                       <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Est. Time to Goal</div>
                       <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">{timeEstimate}</div>
                   </div>
               </div>
               <div className="space-y-1 text-sm mb-4 text-gray-700 dark:text-gray-300">
                 <p><span className="font-semibold">Total Cost:</span> ${totalCost.toFixed(2)}</p>
                 <p><span className="font-semibold">Funds/Scholarships:</span> ${fundsAvailable.toFixed(2)}</p>
                 <p><span className="font-semibold">Currently Saved:</span> ${totalSaved.toFixed(2)}</p>
                 <p><span className="font-semibold">Total Weekly Savings:</span> ${totalWeekly.toFixed(2)}</p>
               </div>
               <div className="relative pt-1">
                 <div className="flex mb-2 items-center justify-between">
                   <div><span className="text-xs font-semibold inline-block text-blue-600 dark:text-blue-400">Progress</span></div>
                   <div className="text-right"><span className="text-xs font-semibold inline-block text-blue-600 dark:text-blue-400">{fundingPercentage.toFixed(1)}%</span></div>
                 </div>
                 <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-blue-200 dark:bg-gray-700">
                   <div style={{ width: `${fundingPercentage}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500 transition-all duration-500"></div>
                 </div>
               </div>
             </CardContent>
          </Card>

          {/* Add Contribution Section - Uses dark: variants */}
          <Card className="mb-6 bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700">
            <CardHeader><CardTitle className="text-xl text-gray-800 dark:text-gray-100">Add Savings Contribution</CardTitle></CardHeader>
            <CardContent>
              {/* === MODIFICATION START === */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-6 mb-4"> {/* Increased gap-y */}
                <div>
                  <Input
                    placeholder="Name (e.g., Job)"
                    value={contributionName}
                    onChange={(e) => setContributionName(e.target.value)}
                    className="bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                    aria-describedby="contribution-name-description"
                  />
                  <p id="contribution-name-description" className="text-xs text-gray-500 dark:text-gray-400 mt-1 px-1">
                    Enter a name for this savings source (e.g., Paycheck, Side Job).
                  </p>
                </div>
                <div>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01" // Keeping step 0.01 here as it's currency
                    max="25000"
                    placeholder="Weekly amount ($)"
                    value={weeklyAmount}
                    onChange={(e) => setWeeklyAmount(e.target.value)}
                    className="bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                    aria-describedby="weekly-amount-description"
                  />
                   {/* Optional description if needed, placeholder seems clear */}
                   {/* <p id="weekly-amount-description" className="text-xs text-gray-500 dark:text-gray-400 mt-1 px-1">How much you save from this source per week.</p> */}
                </div>
                <div>
                  <Input
                    type="date"
                    // Removed placeholder as type="date" often shows native placeholder
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white" // Date input text color might need specific browser handling
                    aria-describedby="start-date-description"
                  />
                   <p id="start-date-description" className="text-xs text-gray-500 dark:text-gray-400 mt-1 px-1">
                    Date you began (or will begin) saving this amount weekly.
                  </p>
                </div>
              </div>
               {/* === MODIFICATION END === */}
              <Button onClick={handleAddSavings} className="w-full md:w-auto">Add Contribution</Button>
            </CardContent>
          </Card>

          {/* Active Contributions List - Uses dark: variants */}
          <Card className="bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700">
            <CardHeader><CardTitle className="text-xl text-gray-800 dark:text-gray-100">Active Contributions</CardTitle></CardHeader>
            <CardContent>
               {savingsEntries.length === 0 ? (
                   <p className="text-center text-gray-500 dark:text-gray-400">No contributions added yet.</p>
               ) : (
                 <div className="space-y-3">
                   {savingsEntries.map((entry) => {
                     const savedForEntry = calculateTotalSavedForEntry(entry);
                     const startDateObj = parseISO(entry.startDate);
                     return (
                       <div key={entry.id} className="flex justify-between items-center p-3 rounded-lg shadow-sm bg-gray-50 text-gray-900 dark:bg-gray-700 dark:text-gray-100">
                         <div>
                           <span className="font-semibold block">{entry.name}</span>
                           <span className="text-sm block text-gray-700 dark:text-gray-300">${entry.weeklyAmount?.toFixed(2) || "0.00"} / week</span>
                           {isValid(startDateObj) && <span className="text-xs opacity-80 block dark:opacity-70">Since: {format(startDateObj, 'MMM dd, yy')}</span>} {/* Shortened year */}
                           <span className="text-xs opacity-80 block dark:opacity-70">Total Saved: ${savedForEntry.toFixed(2)}</span>
                         </div>
                         <Button onClick={() => handleRemoveSavings(entry.id)} variant="ghost" size="sm" className="text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 px-2 py-1 h-auto">Remove</Button>
                       </div>
                     );
                   })}
                 </div>
               )}
             </CardContent>
          </Card>

        </div>
      </div>
    </Layout>
  );
}