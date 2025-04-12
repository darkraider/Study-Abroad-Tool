// lib/db.ts
import { openDB, DBSchema, IDBPDatabase } from "idb";

// --- Define Custom Scholarship Type ---
// Matches the main Scholarship type, but ID might be string
// Status and awardedAmount are handled by localStorage sync like base scholarships
export type CustomScholarship = {
  id: string; // Use string for custom IDs e.g., "custom-17..."
  name: string;
  description: string;
  additionalInfo?: string;
  link: string;
  deadlineDate: string | null;
  deadlineDisplay: string;
  // Note: status and awardedAmount are NOT stored here directly,
  // they are synced via localStorage just like base scholarships.
  // Add a flag to easily identify custom ones
  isCustom: true;
  // We store the base details here. Status is managed externally.
};

// Define the CalendarEvent type here as well or import if defined centrally
type CalendarEvent = {
  id: string;
  title: string;
  start: string; // ISO String
  end?: string; // ISO String
  allDay: boolean;
};

// Define the structure of your database schema
interface MyDBSchema extends DBSchema {
  calendar: {
    key: string;
    value: { id: string; title: string; start: string; end?: string; allDay: boolean; };
  };
  expenses: {
    key: number;
    value: { id: number; category: string; type: "expense" | "asset"; items: Array<{ id: number | string; item: string; cost: number; }>; };
  };
  savings: {
    key: number;
    value: { id: number; name: string; weeklyAmount: number; startDate: string; dateAdded: string; };
  };
  // --- NEW STORE for Custom Scholarships ---
  customScholarships: {
      key: string; // The unique custom ID (e.g., "custom-17...")
      value: CustomScholarship;
      // Optional index for searching/sorting if needed later
      // indexes: { 'by-name': 'name' };
  }
}

// Constants for database name and version
export const DB_NAME = "studyAbroadDB";
// **** INCREMENT THE VERSION ****
const DB_VERSION = 2; // <<<<------ Increment this number!

// Constants for store names
export const STORE_NAMES = {
  CALENDAR: "calendar" as const,
  EXPENSES: "expenses" as const,
  SAVINGS: "savings" as const,
  CUSTOM_SCHOLARSHIPS: "customScholarships" as const, // New store name
};

// Singleton promise
let dbPromise: Promise<IDBPDatabase<MyDBSchema>> | null = null;

/**
 * Gets the database instance.
 */
export function getDb(): Promise<IDBPDatabase<MyDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<MyDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        console.log(`Upgrading database from version ${oldVersion} to ${newVersion}...`);

        // Create calendar store (if upgrading from version < 1)
        if (oldVersion < 1 && !db.objectStoreNames.contains(STORE_NAMES.CALENDAR)) {
          console.log(`Creating store: ${STORE_NAMES.CALENDAR}`);
          db.createObjectStore(STORE_NAMES.CALENDAR, { keyPath: "id" });
        }

        // Create expenses store (if upgrading from version < 1)
        if (oldVersion < 1 && !db.objectStoreNames.contains(STORE_NAMES.EXPENSES)) {
            console.log(`Creating store: ${STORE_NAMES.EXPENSES}`);
            const expensesStore = db.createObjectStore(STORE_NAMES.EXPENSES, { keyPath: "id" });
             // Add default categories ONLY during the initial creation/upgrade
            console.log(`Adding default data to ${STORE_NAMES.EXPENSES}`);
            const defaultExpenses = [ { id: 1, category: "Housing", type: "expense", items: [] }, { id: 2, category: "Transportation", type: "expense", items: [] }, { id: 3, category: "Program Fees", type: "expense", items: [] }, { id: 4, category: "Scholarships", type: "asset", items: [] }, ];
            Promise.all(defaultExpenses.map(expense => transaction.objectStore(STORE_NAMES.EXPENSES).put(expense))) .catch(err => console.error("Error adding default expenses:", err));
        }

        // Create savings store (if upgrading from version < 1)
        if (oldVersion < 1 && !db.objectStoreNames.contains(STORE_NAMES.SAVINGS)) {
            console.log(`Creating store: ${STORE_NAMES.SAVINGS}`);
            db.createObjectStore(STORE_NAMES.SAVINGS, { keyPath: "id" });
        }

        // --- Create customScholarships store (if upgrading from version < 2) ---
         if (oldVersion < 2 && !db.objectStoreNames.contains(STORE_NAMES.CUSTOM_SCHOLARSHIPS)) {
            console.log(`Creating store: ${STORE_NAMES.CUSTOM_SCHOLARSHIPS}`);
            const customScholarshipStore = db.createObjectStore(STORE_NAMES.CUSTOM_SCHOLARSHIPS, { keyPath: "id" });
             // Add indexes here if needed later, e.g.:
             // customScholarshipStore.createIndex('by-name', 'name');
         }

        console.log("Database upgrade complete.");
      },
      blocked() { console.warn("Database upgrade blocked."); /* ... */ },
      blocking() { console.warn("Database is blocking version change."); /* ... */ },
      terminated() { console.error("Database connection terminated."); dbPromise = null; /* ... */ },
    }).catch((error) => {
        console.error("Failed to open database:", error); dbPromise = null; throw error;
    });
  }
  return dbPromise;
}

// --- NEW DB Functions for Custom Scholarships ---

export const addCustomScholarshipToDB = async (scholarship: CustomScholarship): Promise<boolean> => {
    try {
        const db = await getDb();
        const tx = db.transaction(STORE_NAMES.CUSTOM_SCHOLARSHIPS, 'readwrite');
        await tx.objectStore(STORE_NAMES.CUSTOM_SCHOLARSHIPS).put(scholarship);
        await tx.done;
        console.log("Custom scholarship added/updated:", scholarship.id);
        return true;
    } catch (error) {
        console.error("Error adding/updating custom scholarship:", error);
        return false;
    }
};

export const getAllCustomScholarshipsFromDB = async (): Promise<CustomScholarship[]> => {
    try {
        const db = await getDb();
        const tx = db.transaction(STORE_NAMES.CUSTOM_SCHOLARSHIPS, 'readonly');
        const store = tx.objectStore(STORE_NAMES.CUSTOM_SCHOLARSHIPS);
        const allCustom = await store.getAll();
        await tx.done;
        return allCustom;
    } catch (error) {
        console.error("Error fetching custom scholarships:", error);
        return [];
    }
};

export const deleteCustomScholarshipFromDB = async (id: string): Promise<boolean> => {
     try {
        const db = await getDb();
        const tx = db.transaction(STORE_NAMES.CUSTOM_SCHOLARSHIPS, 'readwrite');
        await tx.objectStore(STORE_NAMES.CUSTOM_SCHOLARSHIPS).delete(id);
        await tx.done;
         console.log("Custom scholarship deleted:", id);
        return true;
    } catch (error) {
        console.error("Error deleting custom scholarship:", error);
        return false;
    }
};

export const addEventToCalendarDB = async (newEvent: CalendarEvent): Promise<boolean> => {
  console.log("Attempting to add event to calendar DB:", newEvent);
  try {
    const db = await getDb(); // Get DB instance
    const tx = db.transaction(STORE_NAMES.CALENDAR, 'readwrite'); // Start transaction
    const store = tx.objectStore(STORE_NAMES.CALENDAR);
    await store.put(newEvent); // Use put to add or update based on key (event.id)
    await tx.done; // Commit transaction
    console.log("Event successfully added/updated in DB:", newEvent.id);
    return true;
  } catch (error) {
    console.error("Error adding event to calendar DB:", error);
    // Transaction likely automatically aborted on error
    return false;
  }
};

export const getAllCalendarEvents = async (): Promise<CalendarEvent[]> => {
  console.log("Attempting to fetch all calendar events from DB...");
  try {
    const db = await getDb(); // Get DB instance
    const tx = db.transaction(STORE_NAMES.CALENDAR, 'readonly'); // Start readonly transaction
    const store = tx.objectStore(STORE_NAMES.CALENDAR);
    const allEvents = await store.getAll(); // Fetch all records
    await tx.done; // Complete transaction
    console.log(`Workspaceed ${allEvents.length} calendar events.`);
    // Filter out any potentially null/undefined values just in case
    return allEvents.filter(e => e != null);
  } catch (error) {
    console.error("Error fetching all calendar events:", error);
    return []; // Return empty array on error
  }
};


// Note: updateCustomScholarshipInDB is the same as addCustomScholarshipToDB because put() handles both add and update.
export const updateCustomScholarshipInDB = addCustomScholarshipToDB;

