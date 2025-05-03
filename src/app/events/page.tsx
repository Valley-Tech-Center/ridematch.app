
"use client"; // This component uses hooks

import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, Timestamp, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from 'next/link';
import { ArrowRight, Calendar, MapPin, Users, Car, Loader2 } from "lucide-react"; // Added Loader2
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authDialogOpen, setAuthDialogOpen] = useState(false); // State for AuthDialog

  const { user, loading: authLoading } = useAuth(); // Get user status
  const router = useRouter(); // Get router instance

  const fetchEvents = async () => {
      setLoading(true);
      setError(null);
      try {
        const eventsRef = collection(db, 'events');
        // Order by start date, upcoming first
        // Filter out past events using Firestore query
        const now = Timestamp.now();
        const q = query(
            eventsRef,
            where('endDate', '>=', now), // Only show events ending today or later
            orderBy('endDate', 'asc'), // Order by end date first (to show soonest ending first?) or startDate?
            orderBy('startDate', 'asc') // Then order by start date
        );
        const querySnapshot = await getDocs(q);
        const eventsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as Event));

        // No need to filter in JS if Firestore query handles it
        // const upcomingEvents = eventsData; // Already filtered by query

        setEvents(eventsData);
      } catch (err) {
        console.error("Error fetching events:", err);
        setError("Failed to load events. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    fetchEvents();
  }, []);

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
        //  <Card className="shadow-md">
        //     <CardHeader>
        //       <Skeleton className="h-6 w-48" />
        //       <Skeleton className="h-4 w-64 mt-1" />
        //     </CardHeader>
        //    <CardContent>
        //      <Table>
        //        <TableHeader>
        //          <TableRow>
        //             <TableHead><Skeleton className="h-5 w-32" /></TableHead>
        //             <TableHead><Skeleton className="h-5 w-24" /></TableHead>
        //             <TableHead><Skeleton className="h-5 w-40" /></TableHead>
        //             {/* <TableHead className="text-right"><Skeleton className="h-5 w-20 ml-auto" /></TableHead>
        //             <TableHead className="text-right"><Skeleton className="h-5 w-20 ml-auto" /></TableHead> */}
        //             <TableHead className="text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableHead>
        //          </TableRow>
        //        </TableHeader>
        //        <TableBody>
        //          {[...Array(3)].map((_, i) => (
        //            <TableRow key={`skel-${i}`}>
        //              <TableCell><Skeleton className="h-5 w-40" /></TableCell>
        //              <TableCell><Skeleton className="h-5 w-28" /></TableCell>
        //              <TableCell><Skeleton className="h-5 w-36" /></TableCell>
        //              {/* <TableCell className="text-right"><Skeleton className="h-5 w-12 ml-auto" /></TableCell>
        //               <TableCell className="text-right"><Skeleton className="h-5 w-10 ml-auto" /></TableCell> */}
        //              <TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
        //            </TableRow>
        //          ))}
        //        </TableBody>
        //      </Table>
        //    </CardContent>
        //  </Card>
       )}

      {!loading && error && (
        <Alert variant="destructive" className="max-w-lg mx-auto">
          <AlertTitle>Error Loading Events</AlertTitle>
          <AlertDescription>
            {error}
            <Button onClick={fetchEvents} variant="destructive" size="sm" className="mt-3 ml-4">
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
                   {/* <TableHead className="text-right"><Users className="inline-block h-4 w-4 mr-1" />Attendees</TableHead>
                   <TableHead className="text-right"><Car className="inline-block h-4 w-4 mr-1" />Rides</TableHead> */}
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-medium">{event.name}</TableCell>
                    <TableCell>{event.city}, {event.state}</TableCell>
                    <TableCell>{formatDateRange(event.startDate, event.endDate)}</TableCell>
                     {/* <TableCell className="text-right">{event.attendeeCount ?? 'N/A'}</TableCell>
                    <TableCell className="text-right">
                       <Badge variant="secondary">{event.rideCount ?? 'N/A'}</Badge>
                    </TableCell> */}
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
                ))}
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

