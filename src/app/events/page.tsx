
"use client"; // This component uses hooks

import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, Timestamp, where, collectionGroup } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from 'next/link';
import { ArrowRight, Calendar, MapPin, Users, Car, Loader2, CheckCircle, XCircle } from "lucide-react"; // Added CheckCircle, XCircle
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns'; // For date formatting
import { useAuth } from '@/context/auth-context'; // Import useAuth
import { useRouter } from 'next/navigation'; // Import useRouter
import { AuthDialog } from '@/components/auth/auth-dialog'; // Import AuthDialog
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Added Alert components

interface Event {
  id: string;
  name: string;
  city: string;
  state: string;
  startDate: Timestamp;
  endDate: Timestamp;
  // Removed placeholder counts as they should come from real data/aggregation
  // attendeeCount?: number;
  // rideCount?: number;
}

// Define Attendance type (simplified for this component)
interface AttendanceStatus {
  attending: boolean;
}

// Helper to format Firestore Timestamps
const formatDateRange = (start: Timestamp, end: Timestamp): string => {
  const startDate = start.toDate();
  const endDate = end.toDate();
  // Handle cases where dates might be invalid before formatting
  try {
    const startFormat = format(startDate, 'MMM d');
    const endFormat = format(endDate, 'd, yyyy');
    return `${startFormat}-${endFormat}`;
  } catch (e) {
    console.error("Error formatting date range:", e);
    return "Invalid Date Range";
  }
};


export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [attendanceStatuses, setAttendanceStatuses] = useState<Record<string, boolean>>({}); // Store attendance by eventId
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authDialogOpen, setAuthDialogOpen] = useState(false); // State for AuthDialog

  const { user, loading: authLoading } = useAuth(); // Get user status
  const router = useRouter(); // Get router instance

  const fetchEventsAndAttendance = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Events
      const eventsRef = collection(db, 'events');
      const now = Timestamp.now();
      const q = query(
        eventsRef,
        where('endDate', '>=', now), // Only show events ending today or later
        orderBy('endDate', 'asc'),
        orderBy('startDate', 'asc')
      );
      const querySnapshot = await getDocs(q);
      const eventsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Event));
      setEvents(eventsData);

      // 2. Fetch Attendance Statuses if user is logged in and events exist
      const statuses: Record<string, boolean> = {};
      if (user && eventsData.length > 0) {
        const eventIds = eventsData.map(e => e.id);
        // --- Correction: Use collection() instead of collectionGroup() ---
        const attendanceRef = collection(db, 'attendance'); 
        // Query the top-level 'attendance' collection
        const attendanceQuery = query(
            attendanceRef, 
            where('userId', '==', user.uid), 
            where('eventId', 'in', eventIds)
        );
        const attendanceSnap = await getDocs(attendanceQuery);

        attendanceSnap.forEach(doc => {
          // Get the eventId directly from the document data
          const data = doc.data() as { eventId: string; attending: boolean }; 
          if (data.eventId && typeof data.attending === 'boolean') { 
            statuses[data.eventId] = data.attending;
          }
        });
      }
      setAttendanceStatuses(statuses); // Set statuses (empty if not logged in/no events)

    } catch (err) {
      console.error("Error fetching data:", err);
      // Check if the error is a permission error, potentially add specific message
      if (err instanceof Error && (err.message.includes('permission') || err.message.includes('PERMISSION_DENIED'))) {
          setError("Permission denied fetching data. Please ensure you are logged in and have the necessary permissions.");
      } else {
          setError("Failed to load events or attendance status. Please try again later.");
      }
      setEvents([]); // Clear events on error
      setAttendanceStatuses({}); // Clear statuses on error
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when component mounts or user changes
  useEffect(() => {
    if (!authLoading) { // Only fetch when auth state is resolved
      fetchEventsAndAttendance();
    }
    // Intentionally disable exhaustive-deps for fetchEventsAndAttendance
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]); // Re-fetch when user logs in/out or auth loading finishes

  const handleViewDetailsClick = (eventId: string) => {
    if (!authLoading) { // Ensure auth state is resolved
      if (user) {
        router.push(`/events/${eventId}`);
      } else {
        setAuthDialogOpen(true); // Open login dialog if not logged in
      }
    }
  };


  return (
    <div className="container mx-auto py-12 px-4 md:px-6">
      <h1 className="text-3xl md:text-4xl font-bold mb-8 text-center text-primary">Upcoming Events</h1>

      {loading && (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <span className="ml-3 text-lg text-muted-foreground">Loading Events...</span>
        </div>
      )}

      {!loading && error && (
        <Alert variant="destructive" className="max-w-lg mx-auto">
          <AlertTitle>Error Loading Data</AlertTitle>
          <AlertDescription>
            {error}
            <Button onClick={fetchEventsAndAttendance} variant="destructive" size="sm" className="mt-3 ml-4">
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {!loading && !error && events.length === 0 && (
        <Card className="shadow-md max-w-lg mx-auto">
          <CardHeader>
            <CardTitle>No Upcoming Events</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">There are currently no upcoming events listed. Check back later!</p>
          </CardContent>
        </Card>
      )}


      {!loading && !error && events.length > 0 && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Find Your Event</CardTitle>
            <CardDescription>Browse upcoming events and coordinate your rides.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead><MapPin className="inline-block h-4 w-4 mr-1" />Location</TableHead>
                  <TableHead><Calendar className="inline-block h-4 w-4 mr-1" />Date</TableHead>
                  {user && <TableHead>Your Status</TableHead>}
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => {
                  const attendingStatus = user ? attendanceStatuses[event.id] : undefined; // Get status safely

                  return (
                    <TableRow key={event.id}>
                      <TableCell className="font-medium">{event.name}</TableCell>
                      <TableCell>{event.city}, {event.state}</TableCell>
                      <TableCell>{formatDateRange(event.startDate, event.endDate)}</TableCell>
                      {/* Conditional Status Cell */}
                      {user && (
                        <TableCell>
                          {attendingStatus === true && (
                            <Badge variant="default" className="bg-accent text-accent-foreground hover:bg-accent/90">
                              <CheckCircle className="mr-1 h-3 w-3" /> Attending
                            </Badge>
                          )}
                          {attendingStatus === false && (
                            <Badge variant="secondary">
                              <XCircle className="mr-1 h-3 w-3" /> Not Attending
                            </Badge>
                          )}
                          {attendingStatus === undefined && ( // Only show if undefined (not explicitly false)
                            <Badge variant="outline">Unknown</Badge>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetailsClick(event.id)}
                          disabled={authLoading} // Disable button while checking auth
                        >
                          {authLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          View Details <ArrowRight className="ml-1 h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      {/* Auth Dialog - Rendered conditionally */}
      <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
    </div>
  );
}
