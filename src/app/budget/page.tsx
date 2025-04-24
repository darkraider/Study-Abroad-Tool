"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from 'next/image'; // Ensure Image is imported
import background from '../../../public/backgrounds/budget-bg.webp'; // Import the specific background

import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose, // Ensure DialogClose is imported
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Trash2, Pencil, XCircle } from "lucide-react"; // Icons for actions
import Layout from "@/app/components/layout";
import { getDb, STORE_NAMES } from "@/lib/db";

// --- Type Definitions ---
type ExpenseItem = {
  id: string;
  item: string;
  cost: number;
};

type ExpenseCategory = {
  id: number;
  category: string;
  type: "expense" | "asset";
  items: ExpenseItem[];
};

// --- Constants ---
const DEFAULT_EXPENSE_CATEGORIES = ["Housing", "Transportation", "Program Fees"];
const DEFAULT_ASSET_CATEGORIES = ["Scholarships"];
const MAX_ITEM_COST = 25000;

// --- Helper Function ---
const formatCurrency = (amount: number | string | undefined | null): string => {
    const num = Number(amount) || 0;
    return num.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

// --- Component ---
const BudgetSheet = () => {
  // --- State ---
  const [expenses, setExpenses] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryType, setNewCategoryType] = useState<"expense" | "asset">("expense");
  const [addCategoryError, setAddCategoryError] = useState<string | null>(null);
  const [isEditCategoryModalOpen, setIsEditCategoryModalOpen] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState<ExpenseCategory | null>(null);
  const [editingCategoryNameValue, setEditingCategoryNameValue] = useState("");
  const [editCategoryError, setEditCategoryError] = useState<string | null>(null);
  const [isDeleteCategoryModalOpen, setIsDeleteCategoryModalOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<ExpenseCategory | null>(null);
  const [deleteCategoryError, setDeleteCategoryError] = useState<string | null>(null);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [addItemTargetCategory, setAddItemTargetCategory] = useState<{ id: number; name: string } | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const [newItemCost, setNewItemCost] = useState("");
  const [addItemError, setAddItemError] = useState<string | null>(null);
  const [editingItemCost, setEditingItemCost] = useState<{ [itemId: string]: string }>({});
  const [itemCostErrors, setItemCostErrors] = useState<{ [itemId: string]: string }>({});

  const router = useRouter();

  // --- Data Loading ---
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const db = await getDb();
      const tx = db.transaction(STORE_NAMES.EXPENSES, "readonly");
      const store = tx.objectStore(STORE_NAMES.EXPENSES);
      const allExpenses = (await store.getAll()) as ExpenseCategory[];
      await tx.done;
      const processedExpenses = allExpenses.map((expense) => ({
        ...expense,
        items: (Array.isArray(expense.items) ? expense.items : []).map(
          (item) => ({
            ...item,
            id: String(item.id),
            cost: Number(item?.cost) || 0,
          })
        ),
      }));
      setExpenses(processedExpenses);
    } catch (err) {
      console.error("Error loading budget data:", err);
      setError("Failed to load budget data. Please try refreshing the page.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);


  // --- Helper ---
  const isDefaultCategory = (category: ExpenseCategory | null): boolean => {
    if (!category) return false;
    return (
      DEFAULT_EXPENSE_CATEGORIES.includes(category.category) ||
      DEFAULT_ASSET_CATEGORIES.includes(category.category)
    );
  };

  // --- Database Callbacks ---
  const handleAddCategory = useCallback(async () => {
        const trimmedName = newCategoryName.trim();
        if (!trimmedName) { setAddCategoryError("Category name cannot be empty."); return; }
        setAddCategoryError(null);
        const categoryId = Date.now();
        const newEntry: ExpenseCategory = { id: categoryId, category: trimmedName, type: newCategoryType, items: [] };
        try {
            const db = await getDb(); const tx = db.transaction(STORE_NAMES.EXPENSES, "readwrite");
            await tx.objectStore(STORE_NAMES.EXPENSES).put(newEntry); await tx.done;
            setExpenses((prev) => [...prev, newEntry]); setNewCategoryName(""); setNewCategoryType("expense");
        } catch (err) { console.error("Add Category Error:", err); setAddCategoryError("Failed to save category."); }
    }, [newCategoryName, newCategoryType]);
    const openEditCategoryModal = useCallback((category: ExpenseCategory) => {
        if (isDefaultCategory(category)) return;
        setCategoryToEdit(category); setEditingCategoryNameValue(category.category);
        setEditCategoryError(null); setIsEditCategoryModalOpen(true);
     }, []);
    const handleSaveCategoryName = useCallback(async () => {
        if (!categoryToEdit) return;
        const trimmedName = editingCategoryNameValue.trim();
        if (!trimmedName) { setEditCategoryError("Category name cannot be empty."); return; }
        setEditCategoryError(null);
        const updatedCategory = { ...categoryToEdit, category: trimmedName };
        try {
            const db = await getDb(); const tx = db.transaction(STORE_NAMES.EXPENSES, "readwrite");
            await tx.objectStore(STORE_NAMES.EXPENSES).put(updatedCategory); await tx.done;
            setExpenses((prev) => prev.map((exp) => (exp.id === categoryToEdit.id ? updatedCategory : exp)));
            setIsEditCategoryModalOpen(false); setCategoryToEdit(null);
        } catch (err) { console.error("Save Category Name Error:", err); setEditCategoryError("Failed to save category name."); }
    }, [categoryToEdit, editingCategoryNameValue]);
     const openDeleteCategoryModal = useCallback((category: ExpenseCategory) => {
        if (isDefaultCategory(category)) { setError("Default categories cannot be deleted."); setTimeout(() => setError(null), 3000); return; }
        setCategoryToDelete(category); setDeleteCategoryError(null); setIsDeleteCategoryModalOpen(true);
    }, []);
    const handleDeleteCategoryConfirm = useCallback(async () => {
        if (!categoryToDelete) return;
        setDeleteCategoryError(null);
        try {
            const db = await getDb(); const tx = db.transaction(STORE_NAMES.EXPENSES, "readwrite");
            await tx.objectStore(STORE_NAMES.EXPENSES).delete(categoryToDelete.id); await tx.done;
            setExpenses((prev) => prev.filter((exp) => exp.id !== categoryToDelete.id));
            setIsDeleteCategoryModalOpen(false); setCategoryToDelete(null);
        } catch (err) { console.error("Delete Category Error:", err); setDeleteCategoryError("Failed to delete category."); }
     }, [categoryToDelete]);
     const openAddItemModal = useCallback((categoryId: number, categoryName: string) => {
        setAddItemTargetCategory({ id: categoryId, name: categoryName });
        setNewItemName(""); setNewItemCost(""); setAddItemError(null); setIsAddItemModalOpen(true);
    }, []);
    const handleAddItemConfirm = useCallback(async () => {
        if (!addItemTargetCategory) return;
        const itemName = newItemName.trim(); const itemCost = parseFloat(newItemCost);
        if (!itemName) { setAddItemError("Item name cannot be empty."); return; }
        if (isNaN(itemCost)) { setAddItemError("Invalid cost amount."); return; }
        if (itemCost < 0 || itemCost > MAX_ITEM_COST) { setAddItemError(`Amount $0-$${MAX_ITEM_COST.toLocaleString()}.`); return; }
        setAddItemError(null);
        const itemId = `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const newItemData: ExpenseItem = { id: itemId, item: itemName, cost: itemCost };
        try {
            const db = await getDb(); const tx = db.transaction(STORE_NAMES.EXPENSES, "readwrite"); const store = tx.objectStore(STORE_NAMES.EXPENSES);
            const category = await store.get(addItemTargetCategory.id);
            if (category) {
                const updatedItems = [...(Array.isArray(category.items) ? category.items : []), newItemData];
                const updatedCategory = { ...category, items: updatedItems };
                await store.put(updatedCategory); await tx.done;
                setExpenses(prev => prev.map(exp => exp.id === addItemTargetCategory.id ? { ...updatedCategory, items: updatedItems.map(i => ({ ...i, id: String(i.id), cost: Number(i.cost) || 0 })) } : exp));
                setIsAddItemModalOpen(false);
            } else { throw new Error(`Category ${addItemTargetCategory.id} not found.`); }
        } catch (err) { console.error("Add Item Error:", err); setAddItemError("Failed to add item."); }
     }, [addItemTargetCategory, newItemName, newItemCost]);
    const handleCostInputChange = (itemId: string, value: string) => {
         setEditingItemCost(prev => ({ ...prev, [itemId]: value }));
         setItemCostErrors(prev => { const newErrors = { ...prev }; delete newErrors[itemId]; return newErrors; });
     };
    const saveCost = useCallback(async (categoryId: number, itemId: string) => {
        const costString = editingItemCost[itemId] ?? ''; let costValue = 0;
        if (costString.trim() !== "") {
            costValue = parseFloat(costString);
            if (isNaN(costValue)) { setItemCostErrors(prev => ({ ...prev, [itemId]: "Invalid number" })); return; }
            if (costValue < 0 || costValue > MAX_ITEM_COST) { setItemCostErrors(prev => ({ ...prev, [itemId]: `$0 - $${MAX_ITEM_COST.toLocaleString()}` })); return; }
        }
        setItemCostErrors(prev => { const newErrors = { ...prev }; delete newErrors[itemId]; return newErrors; });
        try {
            const db = await getDb(); const tx = db.transaction(STORE_NAMES.EXPENSES, 'readwrite'); const store = tx.objectStore(STORE_NAMES.EXPENSES);
            const category = await store.get(categoryId);
            if (category) {
                const updatedItems = (Array.isArray(category.items) ? category.items : []).map(item => item.id === itemId ? { ...item, cost: costValue } : item);
                const updatedCategory = { ...category, items: updatedItems };
                await store.put(updatedCategory); await tx.done;
                setExpenses(prev => prev.map(exp => exp.id === categoryId ? { ...exp, items: updatedItems.map(item => ({ ...item, id: String(item.id) })) } : exp));
                setEditingItemCost(prev => { const newState = {...prev}; delete newState[itemId]; return newState; });
            } else { throw new Error(`Category ${categoryId} not found.`); }
        } catch (err) { console.error("Update Cost Error:", err); setItemCostErrors(prev => ({ ...prev, [itemId]: "Save failed" })); }
    }, [editingItemCost]);
    const removeExpenseItem = useCallback(async (categoryId: number, itemId: string) => {
        setError(null); setItemCostErrors(prev => { const newErrors = { ...prev }; delete newErrors[itemId]; return newErrors; });
        try {
            const db = await getDb(); const tx = db.transaction(STORE_NAMES.EXPENSES, 'readwrite'); const store = tx.objectStore(STORE_NAMES.EXPENSES);
            const category = await store.get(categoryId);
            if (category) {
                const updatedItems = (Array.isArray(category.items) ? category.items : []).filter(item => item.id !== itemId);
                const updatedCategory = { ...category, items: updatedItems };
                await store.put(updatedCategory); await tx.done;
                setExpenses(prev => prev.map(exp => exp.id === categoryId ? { ...updatedCategory, items: updatedCategory.items.map(item => ({ ...item, id: String(item.id) })) } : exp));
            } else { throw new Error(`Category ${categoryId} not found.`); }
        } catch (err) { console.error("Remove Item Error:", err); setError("Failed remove item."); }
     }, []);

  // --- Calculations ---
  const categoryTotals = useMemo(() => {
        const totals: { [categoryId: number]: number } = {};
        expenses.forEach(category => { totals[category.id] = (Array.isArray(category.items) ? category.items : []).reduce((sum, item) => sum + (Number(item.cost) || 0), 0); });
        return totals;
     }, [expenses]);
    const overallTotals = useMemo(() => {
        let totalExp = 0; let totalAss = 0;
        expenses.forEach(category => { const categoryTotal = categoryTotals[category.id] || 0; if (category.type === 'expense') { totalExp += categoryTotal; } else if (category.type === 'asset') { totalAss += categoryTotal; } });
        const netCost = totalExp - totalAss;
        return { totalExpenses: totalExp, totalAssets: totalAss, netCost };
     }, [expenses, categoryTotals]);


  // --- Render Logic ---
  if (loading) return <Layout><div className="p-4 text-center dark:text-gray-200">Loading Budget Sheet...</div></Layout>;
  if (error && expenses.length === 0) return <Layout><div className="p-4 text-center text-red-500">{error}</div></Layout>;

  return (
    <Layout backgroundImageSrc={background}>

     

        {/* Main content alignment container */}
        <div className="max-w-4xl mx-auto p-4">

          {/* Encompassing Container with backdrop blur */}
          <div className="backdrop-blur-lg rounded-xl shadow-lg p-4 md:p-6 bg-white/90 dark:bg-gray-800/90 space-y-6">

            <h1 className="text-3xl font-bold text-center text-gray-900 dark:text-gray-100">Budget Sheet</h1>

            {/* General Error Display */}
            {error && <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 rounded text-center text-sm">{error} <Button variant="ghost" size="sm" onClick={() => setError(null)} className="ml-2 text-xs h-auto p-1 align-middle">Dismiss</Button></div>}

            {/* Add Category Section */}
            <Card className="shadow-sm bg-white/95 border-gray-200 dark:bg-gray-800/95 dark:border-gray-700">
              <CardHeader className="p-4">
                 <CardTitle className="text-lg font-semibold text-gray-700 dark:text-gray-200">Add New Category</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row gap-3 items-start">
                    <div className="flex-grow w-full">
                      <Input
                          placeholder="Category Name" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)}
                          className="bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400" aria-label="New category name"
                      />
                      {addCategoryError && <p className="text-xs text-red-500 dark:text-red-400 mt-1">{addCategoryError}</p>}
                    </div>
                  <Select value={newCategoryType} onValueChange={(value: "expense" | "asset") => setNewCategoryType(value)}>
                    <SelectTrigger className="w-full sm:w-[150px] bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"> <SelectValue placeholder="Type" /> </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-800 dark:text-white dark:border-gray-700"> <SelectItem value="expense">Expense</SelectItem> <SelectItem value="asset">Asset</SelectItem> </SelectContent>
                  </Select>
                  <Button onClick={handleAddCategory} className="px-6 w-full sm:w-auto">Add Category</Button>
                </div>
              </CardContent>
            </Card>

            {/* Assets Section */}
            <section aria-labelledby="assets-heading">
                <h2 id="assets-heading" className="text-2xl font-semibold mb-4 text-green-700 dark:text-green-400">Assets</h2>
                {expenses.filter(c => c.type === "asset").map((category) => (
                    <CategoryCard
                        key={category.id} category={category} categoryTotal={categoryTotals[category.id] || 0}
                        isDefault={isDefaultCategory(category)} onEditCategory={() => openEditCategoryModal(category)}
                        onDeleteCategory={() => openDeleteCategoryModal(category)} onAddItem={() => openAddItemModal(category.id, category.category)}
                        onRemoveItem={removeExpenseItem} onCostChange={handleCostInputChange} onCostSave={saveCost}
                        editingItemCost={editingItemCost} itemCostErrors={itemCostErrors}
                    />
                ))}
                {expenses.filter(c => c.type === "asset").length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 ml-1">No asset categories added yet.</p>}
            </section>

            {/* Expenses Section */}
            <section aria-labelledby="expenses-heading">
                <h2 id="expenses-heading" className="text-2xl font-semibold mb-4 text-red-700 dark:text-red-400">Expenses</h2>
                {expenses.filter(c => c.type === "expense").map((category) => (
                   <CategoryCard
                       key={category.id} category={category} categoryTotal={categoryTotals[category.id] || 0}
                       isDefault={isDefaultCategory(category)} onEditCategory={() => openEditCategoryModal(category)}
                       onDeleteCategory={() => openDeleteCategoryModal(category)} onAddItem={() => openAddItemModal(category.id, category.category)}
                       onRemoveItem={removeExpenseItem} onCostChange={handleCostInputChange} onCostSave={saveCost}
                       editingItemCost={editingItemCost} itemCostErrors={itemCostErrors}
                   />
                ))}
                {expenses.filter(c => c.type === "expense").length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 ml-1">No expense categories added yet.</p>}
            </section>

            {/* Total Section */}
            <Card className="bg-gray-100/90 dark:bg-gray-800/90 shadow-md border-gray-200 dark:border-gray-700 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-xl text-gray-800 dark:text-gray-100">Budget Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-right text-base">
                    <p><span className="font-medium text-gray-600 dark:text-gray-300">Total Assets:</span> <span className="ml-2 font-semibold text-green-600 dark:text-green-400">{formatCurrency(overallTotals.totalAssets)}</span></p>
                    <p><span className="font-medium text-gray-600 dark:text-gray-300">Total Expenses:</span> <span className="ml-2 font-semibold text-red-600 dark:text-red-400">{formatCurrency(overallTotals.totalExpenses)}</span></p>
                    <hr className="my-2 border-gray-300 dark:border-gray-600"/>
                    <p className="text-lg"><span className="font-bold text-gray-800 dark:text-gray-100">Net Cost / (Surplus):</span> <span className={`ml-2 font-bold ${overallTotals.netCost >= 0 ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>{formatCurrency(overallTotals.netCost)}</span></p>
                    {overallTotals.netCost < 0 && <p className="text-xs text-green-600 dark:text-green-400">(Budget Surplus)</p>}
                    <div className="pt-4 text-center sm:text-right"><Button onClick={() => router.push('/savings')}>Track Savings Plan</Button></div>
                </CardContent>
            </Card>

          </div> {/* End Encompassing Container */}
       </div>
    

      {/* --- Modals --- */}
      {/* Edit Category Modal */}
        <Dialog open={isEditCategoryModalOpen} onOpenChange={setIsEditCategoryModalOpen}>
            <DialogContent className="sm:max-w-[425px] bg-white dark:bg-gray-800">
                <DialogHeader>
                    <DialogTitle className="text-gray-900 dark:text-gray-100">Edit Category Name</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <Label htmlFor="edit-category-name" className="text-gray-700 dark:text-gray-300"> Category Name </Label>
                    <Input id="edit-category-name" value={editingCategoryNameValue} onChange={(e) => setEditingCategoryNameValue(e.target.value)} className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100" autoFocus />
                    {editCategoryError && <p className="text-sm text-red-500 dark:text-red-400">{editCategoryError}</p>}
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                    <Button type="button" onClick={handleSaveCategoryName}>Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {/* Delete Category Modal */}
        <Dialog open={isDeleteCategoryModalOpen} onOpenChange={setIsDeleteCategoryModalOpen}>
            <DialogContent className="sm:max-w-[425px] bg-white dark:bg-gray-800">
                <DialogHeader>
                    <DialogTitle className="text-gray-900 dark:text-gray-100">Confirm Deletion</DialogTitle>
                    <DialogDescription> Are you sure you want to delete the category <strong className="text-gray-800 dark:text-gray-200">&quot;{categoryToDelete?.category}&quot;</strong>? All items within this category will also be permanently deleted. This action cannot be undone. </DialogDescription>
                </DialogHeader>
                 {deleteCategoryError && <p className="py-2 text-sm text-red-500 dark:text-red-400 text-center">{deleteCategoryError}</p>}
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                    <Button type="button" variant="destructive" onClick={handleDeleteCategoryConfirm}>Delete Category</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {/* Add Item Modal */}
        <Dialog open={isAddItemModalOpen} onOpenChange={setIsAddItemModalOpen}>
             <DialogContent className="sm:max-w-[425px] bg-white dark:bg-gray-800">
                <DialogHeader>
                    <DialogTitle className="text-gray-900 dark:text-gray-100">Add Item to &quot;{addItemTargetCategory?.name}&quot;</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="new-item-name" className="text-gray-700 dark:text-gray-300">Item Name</Label>
                        <Input id="new-item-name" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100" autoFocus />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="new-item-cost" className="text-gray-700 dark:text-gray-300">Cost ($)</Label>
                        <Input id="new-item-cost" type="number" step="0.01" placeholder="0.00" value={newItemCost} onChange={(e) => setNewItemCost(e.target.value)} className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100" />
                    </div>
                     {addItemError && <p className="text-sm text-red-500 dark:text-red-400">{addItemError}</p>}
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                    <Button type="button" onClick={handleAddItemConfirm}>Add Item</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

    </Layout>
  );
};


// --- Sub-Component for Category Card ---
interface CategoryCardProps { category: ExpenseCategory; categoryTotal: number; isDefault: boolean; onEditCategory: () => void; onDeleteCategory: () => void; onAddItem: () => void; onRemoveItem: (categoryId: number, itemId: string) => void; onCostChange: (itemId: string, value: string) => void; onCostSave: (categoryId: number, itemId: string) => void; editingItemCost: { [itemId: string]: string }; itemCostErrors: { [itemId: string]: string }; }
const CategoryCard: React.FC<CategoryCardProps> = ({ category, categoryTotal, isDefault, onEditCategory, onDeleteCategory, onAddItem, onRemoveItem, onCostChange, onCostSave, editingItemCost, itemCostErrors, }) => {
    return (
        <Card className="mb-6 overflow-hidden bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700">
            <CardHeader className="p-4 bg-gray-50/50 dark:bg-gray-700/50 flex flex-row justify-between items-center">
                <CardTitle className="text-xl text-gray-800 dark:text-gray-100 flex-grow" title={isDefault ? "Default Category" : "Category Name"}>
                    {category.category}
                    <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">({formatCurrency(categoryTotal)})</span>
                </CardTitle>
                 <div className="flex items-center space-x-2 flex-shrink-0">
                    {!isDefault && ( <>
                        <Button onClick={onEditCategory} variant="ghost" size="icon" className="h-7 w-7 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400" title="Edit Category Name"> <Pencil className="h-4 w-4" /> <span className="sr-only">Edit Category</span> </Button>
                        <Button onClick={onDeleteCategory} variant="ghost" size="icon" className="h-7 w-7 text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400" title="Delete Category"> <Trash2 className="h-4 w-4" /> <span className="sr-only">Delete Category</span> </Button>
                    </> )}
                 </div>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader><TableRow><TableHead className="pl-4 w-2/5 text-gray-600 dark:text-gray-300">Item</TableHead><TableHead className="w-1/4 text-right text-gray-600 dark:text-gray-300">Cost ($)</TableHead><TableHead className="w-1/4 text-center pr-4 text-gray-600 dark:text-gray-300">Action</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {(Array.isArray(category.items) ? category.items : []).map((item) => (
                            <TableRow key={item.id}>
                                <TableCell className="pl-4 font-medium text-gray-900 dark:text-gray-100">{item.item}</TableCell>
                                <TableCell className="text-right">
                                    <div className="inline-block relative">
                                        <Input
                                            type="number" step="0.01" min="0" placeholder="0.00"
                                            value={editingItemCost[item.id] ?? item.cost}
                                            onChange={(e) => onCostChange(item.id, e.target.value)}
                                            onBlur={() => onCostSave(category.id, item.id)}
                                            className={`w-28 text-right h-8 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white ${itemCostErrors[item.id] ? 'border-red-500 dark:border-red-400 focus:ring-red-500' : 'border-gray-300 dark:border-gray-600'}`}
                                            aria-label={`Cost for ${item.item}`} aria-invalid={!!itemCostErrors[item.id]}
                                            aria-describedby={itemCostErrors[item.id] ? `item-error-${item.id}` : undefined}
                                        />
                                        {itemCostErrors[item.id] && <p id={`item-error-${item.id}`} className="absolute text-xs text-red-500 dark:text-red-400 mt-1 right-0">{itemCostErrors[item.id]}</p>}
                                    </div>
                                </TableCell>
                                <TableCell className="text-center pr-4">
                                    <Button onClick={() => onRemoveItem(category.id, item.id)} variant="ghost" size="icon" className="text-red-500/80 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 h-7 w-7" title="Remove Item">
                                        <XCircle className="h-4 w-4" />
                                        <span className="sr-only">Remove Item</span>
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {/* Add Item Button Row */}
                        <TableRow>
                            <TableCell colSpan={3} className="pt-3 px-4 pb-3">
                                <Button variant="outline" size="sm" className="w-full text-gray-700 border-gray-300 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700" onClick={onAddItem}>
                                    + Add Item to &quot;{category.category}&quot;
                                </Button>
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

export default BudgetSheet;