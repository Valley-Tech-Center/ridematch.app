
"use client"; // This component uses hooks

import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from 'next/link';
import { ArrowRight, Calendar, MapPin, Users, Car } from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns'; // For date formatting
import { useAuth } from '@/context/auth-context'; // Import useAuth
import { useRouter } from 'next/navigation'; // Import useRouter
import { AuthDialog } from '@/components/auth/auth-dialog'; // Import AuthDialog

interface Conference {
  id: string;
  name: string;
  city: string;
  state: string;
  startDate: Timestamp;
  endDate: Timestamp;
  // TODO: Add fields for attendee count and rides coordinated (these might need aggregation)
   attendeeCount?: number; // Placeholder
   rideCount?: number; // Placeholder
}

// Helper to format Firestore Timestamps
const formatDateRange = (start: Timestamp, end: Timestamp): string => {
  const startDate = start.toDate();
  const endDate = end.toDate();
  const startFormat = format(startDate, 'MMM d');
  const endFormat = format(endDate, 'd, yyyy');
  return `${startFormat}-${endFormat}`;
};


export default function ConferencesPage() {
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authDialogOpen, setAuthDialogOpen] = useState(false); // State for AuthDialog

  const { user, loading: authLoading } = useAuth(); // Get user status
  const router = useRouter(); // Get router instance

  useEffect(() => {
    const fetchConferences = async () => {
      setLoading(true);
      setError(null);
      try {
        const conferencesRef = collection(db, 'conferences');
        // Order by start date, upcoming first
        const q = query(conferencesRef, orderBy('startDate', 'asc'));
        const querySnapshot = await getDocs(q);
        const confsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
           // Placeholder counts - these would ideally come from aggregated data
           attendeeCount: Math.floor(Math.random() * 500) + 100, // Random placeholder
           rideCount: Math.floor(Math.random() * 50) + 10, // Random placeholder
        } as Conference));

         // Filter out past conferences (optional, based on requirements)
         const now = Timestamp.now();
         const upcomingConfs = confsData.filter(conf => conf.endDate.seconds >= now.seconds);


        setConferences(upcomingConfs);
      } catch (err) {
        console.error("Error fetching conferences:", err);
        setError("Failed to load conferences. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchConferences();
  }, []);

  const handleViewDetailsClick = (conferenceId: string) => {
    if (!authLoading) { // Ensure auth state is resolved
        if (user) {
          router.push(`/conferences/${conferenceId}`);
        } else {
          setAuthDialogOpen(true); // Open login dialog if not logged in
        }
    }
  };


  return (
    <div className="container mx-auto py-12 px-4 md:px-6">
      <h1 className="text-3xl md:text-4xl font-bold mb-8 text-center text-primary">Upcoming Conferences</h1>

       {loading && (
         <Card className="shadow-md">
            <CardHeader>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64 mt-1" />
            </CardHeader>
           <CardContent>
             <Table>
               <TableHeader>
                 <TableRow>
                    <TableHead><Skeleton className="h-5 w-32" /></TableHead>
                    <TableHead><Skeleton className="h-5 w-24" /></TableHead>
                    <TableHead><Skeleton className="h-5 w-40" /></TableHead>
                    <TableHead className="text-right"><Skeleton className="h-5 w-20 ml-auto" /></TableHead>
                    <TableHead className="text-right"><Skeleton className="h-5 w-20 ml-auto" /></TableHead>
                    <TableHead><Skeleton className="h-8 w-24 ml-auto" /></TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {[...Array(3)].map((_, i) => (
                   <TableRow key={`skel-${i}`}>
                     <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                     <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                     <TableCell><Skeleton className="h-5 w-36" /></TableCell>
                     <TableCell className="text-right"><Skeleton className="h-5 w-12 ml-auto" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-5 w-10 ml-auto" /></TableCell>
                     <TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                   </TableRow>
                 ))}
               </TableBody>
             </Table>
           </CardContent>
         </Card>
       )}

      {!loading && error && (
        <Card className="shadow-md border-destructive bg-destructive/10">
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Conferences</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive-foreground">{error}</p>
             <Button onClick={() => window.location.reload()} variant="destructive" className="mt-4">Retry</Button>
          </CardContent>
        </Card>
      )}

       {!loading && !error && conferences.length === 0 && (
         <Card className="shadow-md">
           <CardHeader>
             <CardTitle>No Upcoming Conferences</CardTitle>
           </CardHeader>
           <CardContent>
             <p className="text-muted-foreground">There are currently no upcoming conferences listed. Check back later!</p>
           </CardContent>
         </Card>
       )}


      {!loading && !error && conferences.length > 0 && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Find Your Event</CardTitle>
            <CardDescription>Browse upcoming conferences and start coordinating your rides.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Conference</TableHead>
                  <TableHead><MapPin className="inline-block h-4 w-4 mr-1" />Location</TableHead>
                  <TableHead><Calendar className="inline-block h-4 w-4 mr-1" />Date</TableHead>
                   <TableHead className="text-right"><Users className="inline-block h-4 w-4 mr-1" />Attendees</TableHead>
                   <TableHead className="text-right"><Car className="inline-block h-4 w-4 mr-1" />Rides</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conferences.map((conf) => (
                  <TableRow key={conf.id}>
                    <TableCell className="font-medium">{conf.name}</TableCell>
                    <TableCell>{conf.city}, {conf.state}</TableCell>
                    <TableCell>{formatDateRange(conf.startDate, conf.endDate)}</TableCell>
                     <TableCell className="text-right">{conf.attendeeCount ?? 'N/A'}</TableCell>
                    <TableCell className="text-right">
                       <Badge variant="secondary">{conf.rideCount ?? 'N/A'}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetailsClick(conf.id)}
                          disabled={authLoading} // Disable button while checking auth
                      >
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
