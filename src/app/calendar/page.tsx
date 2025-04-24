"use client";

import React, { useState, useEffect, useCallback, useRef } from "react"; // Added useRef
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import Layout from "@/app/components/layout";
import { getDb, STORE_NAMES } from "@/lib/db";
import { isValid, parseISO, format } from "date-fns"; // Added format
import Image from 'next/image';
import background from '../../../public/backgrounds/calendar-bg.webp';

// --- UI Component Imports ---
// Assuming shadcn/ui setup. Adjust paths if necessary.
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,   // Added for explicit close button
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// --- Type Definitions ---
type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
};

// --- Constants --- (Keep PREDEFINED_EVENTS_INIT_FLAG)
const PREDEFINED_EVENTS_INIT_FLAG = "predefinedCalendarEventsInitialized_v1";
const predefinedEvents: CalendarEvent[] = []; // Keep empty or add defaults

// --- Database Interaction Functions ---
// (Keep your DB functions: addEventToDB, updateEventInDB, removeEventFromDB, getAllCalendarEvents)
const addEventToDB = async (newEvent: CalendarEvent): Promise<boolean> => { try { const d = await getDb(); const t = d.transaction(STORE_NAMES.CALENDAR, 'readwrite'); await t.objectStore(STORE_NAMES.CALENDAR).put(newEvent); await t.done; return true; } catch (e) { console.error("Add Ev Err:", e); return false; } };
const updateEventInDB = async (updatedEvent: CalendarEvent): Promise<boolean> => { try { const d = await getDb(); const t = d.transaction(STORE_NAMES.CALENDAR, 'readwrite'); await t.objectStore(STORE_NAMES.CALENDAR).put(updatedEvent); await t.done; return true; } catch (e) { console.error("Upd Ev Err:", e); return false; } };
const removeEventFromDB = async (eventId: string): Promise<boolean> => { try { const d = await getDb(); const t = d.transaction(STORE_NAMES.CALENDAR, 'readwrite'); await t.objectStore(STORE_NAMES.CALENDAR).delete(eventId); await t.done; return true; } catch (e) { console.error("Rem Ev Err:", e); return false; } };
const getAllCalendarEvents = async (): Promise<CalendarEvent[]> => { try { const d=await getDb(); const t=d.transaction(STORE_NAMES.CALENDAR,"readonly"); const s=t.objectStore(STORE_NAMES.CALENDAR); const ev=await s.getAll(); await t.done; return ev.filter(e => e.id !== "predefinedEventsInitialized"); } catch(e){ console.error("Calendar Fetch Err:",e); return[]; } };


// --- Main Calendar Page Component ---
export default function CalendarPage() {
  // --- State ---
  const [weekendsVisible, setWeekendsVisible] = useState(true);
  const [currentEvents, setCurrentEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addModalData, setAddModalData] = useState<{ startStr: string; endStr: string; allDay: boolean } | null>(null);
  const [newEventTitle, setNewEventTitle] = useState("");

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<CalendarEvent | null>(null);

  const calendarRef = useRef<FullCalendar>(null); // Ref to access FullCalendar API

  // --- Data Loading Effect ---
  useEffect(() => {
    // (Keep your initializeAndFetchEvents function as it was)
    const initializeAndFetchEvents = async () => {
      setLoading(true); setError(null);
      try {
        const db = await getDb();
        const initialized = localStorage.getItem(PREDEFINED_EVENTS_INIT_FLAG);
        if (!initialized) {
          console.log("Adding predefined calendar events...");
          const tx = db.transaction(STORE_NAMES.CALENDAR, "readwrite");
          const store = tx.objectStore(STORE_NAMES.CALENDAR);
          await Promise.all(predefinedEvents.map(event => store.put(event)));
          await tx.done;
          localStorage.setItem(PREDEFINED_EVENTS_INIT_FLAG, "true");
        }
        const allEvents = await getAllCalendarEvents();
        setCurrentEvents(allEvents);
      } catch (err) { console.error("Init/Fetch Err:", err); setError("Failed load."); setCurrentEvents([]);
      } finally { setLoading(false); }
    };
    initializeAndFetchEvents();
  }, []);

  // --- Event Handlers ---

  // **MODIFIED**: Opens the Add Event modal instead of using prompt()
  const handleDateSelect = useCallback((selectInfo: any) => {
    // Clear any previous title and store selection info
    setNewEventTitle("");
    setAddModalData({
      startStr: selectInfo.startStr,
      endStr: selectInfo.endStr,
      allDay: selectInfo.allDay,
    });
    setIsAddModalOpen(true); // Open the modal

    // Unselect dates on the calendar
    const calendarApi = selectInfo.view.calendar;
    calendarApi.unselect();
  }, []); // No dependencies, relies on state setters

  // **NEW**: Handles saving the event from the Add modal
  const handleAddEventConfirm = async () => {
    if (!newEventTitle || !addModalData) {
      setError("Event title cannot be empty."); // Or handle inline validation
      return;
    }
    setError(null); // Clear previous errors

    const newEvent: CalendarEvent = {
      id: `event-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: newEventTitle,
      start: addModalData.startStr,
      end: addModalData.endStr,
      allDay: addModalData.allDay,
    };

    const success = await addEventToDB(newEvent);
    if (success) {
      setCurrentEvents(prev => [...prev, newEvent]);
      setIsAddModalOpen(false); // Close modal on success
      setNewEventTitle(""); // Clear title field
      setAddModalData(null);
    } else {
      setError("Failed to save new event."); // Keep modal open on error
    }
  };

  // **MODIFIED**: Opens the Delete confirmation modal instead of using confirm()
  const handleEventClick = useCallback((clickInfo: any) => {
    const eventData: CalendarEvent = {
        id: clickInfo.event.id,
        title: clickInfo.event.title,
        start: clickInfo.event.startStr,
        end: clickInfo.event.endStr || undefined,
        allDay: clickInfo.event.allDay
        // Copy other relevant props if needed
    };
    setEventToDelete(eventData); // Store the event to be deleted
    setIsDeleteModalOpen(true); // Open the modal
  }, []); // No dependencies, relies on state setters

  // **NEW**: Handles deleting the event from the confirmation modal
  const handleDeleteEventConfirm = async () => {
    if (!eventToDelete) return;
    setError(null); // Clear previous errors

    const success = await removeEventFromDB(eventToDelete.id);
    if (success) {
      setCurrentEvents(prev => prev.filter(e => e.id !== eventToDelete.id));
      setIsDeleteModalOpen(false); // Close modal on success
      setEventToDelete(null);
    } else {
      setError("Failed to delete event."); // Keep modal open on error
    }
  };

  // (Keep handleEventChange as it was for drag/resize)
   const handleEventChange = useCallback(async (changeInfo: any /* Use type from FullCalendar */) => {
    const plainEventObject = changeInfo.event.toPlainObject() as any;
    const updatedEvent: CalendarEvent = {
        id: plainEventObject.id,
        title: plainEventObject.title,
        start: changeInfo.event.startStr,
        end: changeInfo.event.endStr || undefined,
        allDay: plainEventObject.allDay,
    };
    const success = await updateEventInDB(updatedEvent);
    if (success) { setCurrentEvents(prev => prev.map(e => (e.id === updatedEvent.id ? updatedEvent : e))); }
    else { setError("Failed to update event."); /* Optionally revert change */ }
  }, []);

  // --- Render Logic ---
  if (loading) return <Layout><div className="p-4 text-center dark:text-gray-200">Loading Calendar...</div></Layout>;

  // Format selected date range for Add Modal
  const formatModalDateRange = (data: typeof addModalData) => {
    if (!data) return "";
    const start = parseISO(data.startStr);
    const end = parseISO(data.endStr); // Might be invalid if it's just a date click

    if (!isValid(start)) return "Invalid date";

    const formatOptions: Intl.DateTimeFormatOptions = {
        year: 'numeric', month: 'long', day: 'numeric',
        ...( !data.allDay && { hour: 'numeric', minute: '2-digit', hour12: true } )
    };

    // Check if end is valid and different from start (more than just the time part)
    const endDateForCompare = new Date(end); // Copy end date
    endDateForCompare.setSeconds(endDateForCompare.getSeconds() -1); // Decrement by 1 sec to handle end-exclusive ranges

    if (isValid(end) && endDateForCompare > start ) {
        return `${format(start, 'PPp')} - ${format(end, 'PPp')}`; // Example: Apr 12, 2025, 1:00 PM - Apr 13, 2025, 1:00 PM
    } else {
        return format(start, 'PPp'); // Example: Apr 12, 2025, 1:00 PM (or just date if allDay)
    }
  };


  return (
    <Layout backgroundImageSrc={background}>



      
        {/* Background */}
          

        {/* Main container */}
        <div className="flex flex-col md:flex-row gap-4 p-4 max-w-7xl mx-auto">
          {/* Sidebar */}
          <Sidebar
            weekendsVisible={weekendsVisible}
            setWeekendsVisible={setWeekendsVisible}
            currentEvents={currentEvents}
          />
          {/* Calendar Area */}
          <div className="flex-grow">
             {/* Top-level error display area */}
            {error && !isAddModalOpen && !isDeleteModalOpen && (
               <div className="mb-2 p-3 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 rounded text-center text-sm">
                   {error} <Button variant="ghost" size="sm" onClick={() => setError(null)} className="ml-2 text-xs h-auto p-1">Dismiss</Button>
               </div>
            )}
            <div className="fc-wrapper bg-white/95 dark:bg-gray-900/95 rounded-lg shadow-lg p-4 min-h-[600px]">
              <FullCalendar
                ref={calendarRef} // Assign ref
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" }}
                initialView="dayGridMonth"
                editable={true}
                selectable={true}
                selectMirror={true}
                dayMaxEvents={true}
                weekends={weekendsVisible}
                events={currentEvents}
                select={handleDateSelect} // Opens Add Modal
                eventClick={handleEventClick} // Opens Delete Modal
                eventDrop={handleEventChange}
                eventResize={handleEventChange}
              />
            </div>
          </div>
        </div>
      

      {/* Add Event Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-[425px] bg-white dark:bg-gray-800">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-gray-100">Add New Event</DialogTitle>
            <DialogDescription>
                Enter a title for your new event. Selected time: <br />
                <span className="font-medium text-gray-700 dark:text-gray-300">{formatModalDateRange(addModalData)}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="event-title" className="text-right text-gray-700 dark:text-gray-300">
                Title
              </Label>
              <Input
                id="event-title"
                value={newEventTitle}
                onChange={(e) => setNewEventTitle(e.target.value)}
                className="col-span-3 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                autoFocus
              />
            </div>
             {/* Display error specific to this modal */}
             {error && isAddModalOpen && <p className="col-span-4 text-sm text-red-500 dark:text-red-400 text-center">{error}</p>}
          </div>
          <DialogFooter>
            <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="button" onClick={handleAddEventConfirm}>Save Event</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="sm:max-w-[425px] bg-white dark:bg-gray-800">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-gray-100">Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the event: <br />
              <span className="font-medium text-gray-700 dark:text-gray-300">{eventToDelete?.title || 'this event'}</span>?
              <br />
              <span className="text-xs text-gray-500 dark:text-gray-400">This action cannot be undone.</span>
            </DialogDescription>
          </DialogHeader>
           {/* Display error specific to this modal */}
           {error && isDeleteModalOpen && <p className="py-2 text-sm text-red-500 dark:text-red-400 text-center">{error}</p>}
          <DialogFooter>
             <DialogClose asChild>
                 <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="button" variant="destructive" onClick={handleDeleteEventConfirm}>Delete Event</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </Layout>
  );
}

// --- Sidebar Component ---
// (Keep Sidebar component as it was)
function Sidebar({ weekendsVisible, setWeekendsVisible, currentEvents = [] }: {
    weekendsVisible: boolean;
    setWeekendsVisible: (visible: boolean) => void;
    currentEvents: CalendarEvent[];
}) {
  return (
    <div className="flex-shrink-0 w-full md:w-64 p-4 rounded-lg shadow bg-gray-50 text-gray-900 border border-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700">
      <div className="mb-6">
        <h2 className="font-semibold text-lg mb-2 text-gray-900 dark:text-gray-100">Instructions</h2>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-300">
          <li>Select dates to create events.</li>
          <li>Drag, drop, and resize events.</li>
          <li>Click an event to delete it.</li>
        </ul>
      </div>
      <div className="mb-6">
        <label className="flex items-center space-x-2 cursor-pointer">
          <input type="checkbox" checked={weekendsVisible} onChange={() => setWeekendsVisible(!weekendsVisible)} className="form-checkbox h-4 w-4 rounded text-blue-600 border-gray-300 dark:text-blue-400 dark:bg-gray-600 dark:border-gray-500 focus:ring-blue-500 dark:focus:ring-blue-400" />
          <span className="text-sm text-gray-700 dark:text-gray-200">Toggle Weekends</span>
        </label>
      </div>
      <div>
        <h2 className="font-semibold text-lg mb-2 text-gray-900 dark:text-gray-100">All Events ({currentEvents.length})</h2>
        <ul className="space-y-2 max-h-60 overflow-y-auto pr-2"> {/* Added scroll */}
          {currentEvents.length > 0 ? (
            currentEvents.map((event) => ( <SidebarEvent key={event.id} event={event} /> ))
          ) : ( <li className="text-sm text-gray-500 dark:text-gray-400">No events found.</li> )}
        </ul>
      </div>
    </div>
  );
}

// --- Sidebar Event Component ---
// (Keep SidebarEvent component as it was)
function SidebarEvent({ event }: { event: CalendarEvent }) {
  let formattedDate = 'Invalid Date';
  try {
    const date = parseISO(event.start);
    if(isValid(date)) {
        // Use a more user-friendly format, adjust as needed
        formattedDate = format(date, 'PP'); // e.g., Apr 12, 2025
    }
  } catch (e) {
      console.error("Error formatting sidebar date:", e);
  }

  return (
    <li className="p-2 rounded-md text-xs bg-white hover:bg-gray-100 shadow-sm text-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-100">
      <b className="text-gray-800 dark:text-gray-100">{formattedDate}: </b>
      <i className="text-gray-700 dark:text-gray-200">{event.title}</i>
    </li>
  );
}