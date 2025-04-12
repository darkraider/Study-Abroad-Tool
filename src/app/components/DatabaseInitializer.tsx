// components/DatabaseInitializer.tsx
"use client";
import { useEffect, useState } from "react";
import { getDb } from "@/lib/db";

export function DatabaseInitializer() {
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initialize = async () => {
      try {
        await getDb();
        setInitialized(true);
      } catch (err) {
        console.error("Database initialization error:", err);
        setError("Failed to initialize database");
      }
    };

    initialize();
  }, []);

  if (error) {
    return <div className="text-red-500 p-4">Error: {error}</div>;
  }

  if (!initialized) {
    return <div className="p-4">Initializing database...</div>;
  }

  return null;
}