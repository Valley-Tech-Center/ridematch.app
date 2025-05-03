"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, Timestamp, doc, setDoc, serverTimestamp, getDoc, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Plane, PlaneDeparture, Send } from 'lucide-react'; // Replaced PlaneArrival with Plane
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Attendance {
  userId: string;
  conferenceId: string;
  attending: boolean;
  arrivalAirport?: string | null;
  arrivalDateTime?: Timestamp | null;
  departureAirport?: string | null;
  departureDateTime?: Timestamp | null;
}

interface UserProfile {
  uid: string;
  displayName?: string | null;
  photoURL?: string | null;
  email?: string | null; // Include email if needed for contact fallback, but be mindful of privacy
}

interface RideMatch extends Attendance {
  userProfile?: UserProfile | null; // Add user profile data to the match
}

interface RideMatchesProps {
  conferenceId: string;
  currentUserId: string;
  currentUserAttendance: Attendance;
}

// Time difference in minutes
const MAX_TIME_DIFF_MINUTES = 30;

// Helper to format time
const formatTime = (ts: Timestamp | null | undefined): string => {
  return ts ? format(ts.toDate(), 'p') : 'N/A'; // 'p' gives locale time (e.g., 1:30 PM)
};

// Helper to get initials
const getInitials = (name?: string | null) => {
  if (!name) return '?';
  const names = name.split(' ');
  if (names.length === 1) return names[0][0].toUpperCase();
  return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
};

const RideMatches: React.FC<RideMatchesProps> = ({ conferenceId, currentUserId, currentUserAttendance }) => {
  const [arrivalMatches, setArrivalMatches] = useState<RideMatch[]>([]);
  const [departureMatches, setDepartureMatches] = useState<RideMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendingNotification, setSendingNotification] = useState<Record<string, boolean>>({}); // Track sending state per user
  const { toast } = useToast();

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    setArrivalMatches([]);
    setDepartureMatches([]);

    const { arrivalAirport, arrivalDateTime, departureAirport, departureDateTime } = currentUserAttendance;

    if (!arrivalDateTime && !departureDateTime) {
        setLoading(false);
        return; // No details to match against
    }


    try {
      const attendanceRef = collection(db, 'attendance');
      const baseQuery = query(
        attendanceRef,
        where('conferenceId', '==', conferenceId),
        where('attending', '==', true),
        where('userId', '!=', currentUserId) // Exclude self
      );

      let arrivalQuery = null;
      let departureQuery = null;

      // --- Arrival Matching ---
      if (arrivalAirport && arrivalDateTime) {
         const arrivalTime = arrivalDateTime.toDate();
         const minArrivalTime = new Date(arrivalTime.getTime() - MAX_TIME_DIFF_MINUTES * 60000);
         const maxArrivalTime = new Date(arrivalTime.getTime() + MAX_TIME_DIFF_MINUTES * 60000);

         arrivalQuery = query(
           baseQuery,
           where('arrivalAirport', '==', arrivalAirport),
           where('arrivalDateTime', '>=', Timestamp.fromDate(minArrivalTime)),
           where('arrivalDateTime', '<=', Timestamp.fromDate(maxArrivalTime))
         );
      }

      // --- Departure Matching ---
      if (departureAirport && departureDateTime) {
          const departureTime = departureDateTime.toDate();
          const minDepartureTime = new Date(departureTime.getTime() - MAX_TIME_DIFF_MINUTES * 60000);
          const maxDepartureTime = new Date(departureTime.getTime() + MAX_TIME_DIFF_MINUTES * 60000);

          departureQuery = query(
            baseQuery,
            where('departureAirport', '==', departureAirport),
            where('departureDateTime', '>=', Timestamp.fromDate(minDepartureTime)),
            where('departureDateTime', '<=', Timestamp.fromDate(maxDepartureTime))
          );
      }

       // --- Fetch User Profiles ---
       const fetchUserProfiles = async (userIds: string[]): Promise<Map<string, UserProfile>> => {
         const profiles = new Map<string, UserProfile>();
         if (userIds.length === 0) return profiles;

         // Firestore 'in' query limit is 30 - chunk if necessary
         const MAX_IDS_PER_QUERY = 30;
         for (let i = 0; i < userIds.length; i += MAX_IDS_PER_QUERY) {
             const chunkUserIds = userIds.slice(i, i + MAX_IDS_PER_QUERY);
             if (chunkUserIds.length > 0) {
                  const usersRef = collection(db, 'users');
                  const q = query(usersRef, where('uid', 'in', chunkUserIds));
                  const querySnapshot = await getDocs(q);
                  querySnapshot.forEach((doc) => {
                      profiles.set(doc.id, doc.data() as UserProfile);
                  });
             }
         }
         return profiles;
       };


       // --- Execute Queries and Process Results ---
        const processResults = async (querySnapshot: Awaited<ReturnType<typeof getDocs>> | null, setMatches: React.Dispatch<React.SetStateAction<RideMatch[]>>) => {
            if (!querySnapshot) return;

            const matchesData = querySnapshot.docs.map(doc => doc.data() as Attendance);
            const userIds = matchesData.map(match => match.userId);
            const userProfilesMap = await fetchUserProfiles(userIds);

             const combinedMatches: RideMatch[] = matchesData.map(match => ({
               ...match,
               userProfile: userProfilesMap.get(match.userId) || null,
            }));

            setMatches(combinedMatches);
        };


      // Run queries in parallel if both exist
      const [arrivalResults, departureResults] = await Promise.all([
         arrivalQuery ? getDocs(arrivalQuery) : null,
         departureQuery ? getDocs(departureQuery) : null,
      ]);


      await processResults(arrivalResults, setArrivalMatches);
      await processResults(departureResults, setDepartureMatches);


    } catch (err) {
      console.error("Error fetching matches:", err);
      setError("Failed to load ride matches. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [conferenceId, currentUserId, currentUserAttendance]); // Include currentUserAttendance

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]); // Depend on the memoized fetchMatches function


  const sendRideRequest = async (recipientId: string, type: 'arrival' | 'departure') => {
    if (!currentUserAttendance || !recipientId) return;

    setSendingNotification(prev => ({ ...prev, [recipientId + type]: true }));

    const notificationData = {
      senderId: currentUserId,
      recipientId: recipientId,
      conferenceId: conferenceId,
      type: type, // 'arrival' or 'departure'
      senderArrivalDateTime: currentUserAttendance.arrivalDateTime || null,
      senderDepartureDateTime: currentUserAttendance.departureDateTime || null,
      status: 'pending', // 'pending', 'accepted', 'declined'
      createdAt: serverTimestamp(),
      read: false,
    };

    try {
       // TODO: Implement actual notification sending logic.
       // This could involve:
       // 1. Writing to a 'notifications' collection in Firestore.
       // 2. Setting up Cloud Functions to listen to this collection and send push notifications (FCM), emails, etc.
       // 3. For now, we'll just simulate by writing to Firestore and showing a toast.

      await addDoc(collection(db, 'notifications'), notificationData);

      toast({
        title: "Ride Request Sent!",
        description: `Your request to share a ride has been sent.`,
      });
    } catch (err) {
      console.error("Error sending notification:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to send ride request.",
      });
    } finally {
       setSendingNotification(prev => ({ ...prev, [recipientId + type]: false }));
    }
  };


  if (loading) {
    return <div className="flex justify-center items-center p-6"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <span className="ml-2">Finding matches...</span></div>;
  }

  if (error) {
    return <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
           </Alert>;
  }

   const noArrivalMatches = currentUserAttendance.arrivalDateTime && arrivalMatches.length === 0;
   const noDepartureMatches = currentUserAttendance.departureDateTime && departureMatches.length === 0;


  return (
    <div className="space-y-6">
      {/* Arrival Matches */}
      {currentUserAttendance.arrivalDateTime && (
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center"><Plane className="mr-2 h-5 w-5 text-primary" /> Arrival Matches ({arrivalMatches.length})</h3>
          {noArrivalMatches && !loading && <p className="text-muted-foreground text-sm">No attendees found arriving around your time ({formatTime(currentUserAttendance.arrivalDateTime)} at {currentUserAttendance.arrivalAirport}).</p>}
          {arrivalMatches.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Attendee</TableHead>
                  <TableHead>Arrival Time</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {arrivalMatches.map((match) => (
                  <TableRow key={match.userId}>
                    <TableCell className="flex items-center space-x-3">
                      <Avatar className="h-8 w-8">
                         <AvatarImage src={match.userProfile?.photoURL ?? undefined} alt={match.userProfile?.displayName ?? 'User'} />
                         <AvatarFallback>{getInitials(match.userProfile?.displayName)}</AvatarFallback>
                      </Avatar>
                       <span className="font-medium">{match.userProfile?.displayName ?? 'Attendee'}</span>
                    </TableCell>
                    <TableCell>{formatTime(match.arrivalDateTime)}</TableCell>
                    <TableCell className="text-right">
                       <Button
                            size="sm"
                            onClick={() => sendRideRequest(match.userId, 'arrival')}
                            disabled={sendingNotification[match.userId + 'arrival']}
                            variant="outline"
                            className="border-primary text-primary hover:bg-primary/10 hover:text-primary"
                        >
                         {sendingNotification[match.userId + 'arrival'] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                         Let's Ride
                       </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* Departure Matches */}
      {currentUserAttendance.departureDateTime && (
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center"><PlaneDeparture className="mr-2 h-5 w-5 text-primary" /> Departure Matches ({departureMatches.length})</h3>
          {noDepartureMatches && !loading && <p className="text-muted-foreground text-sm">No attendees found departing around your time ({formatTime(currentUserAttendance.departureDateTime)} from {currentUserAttendance.departureAirport}).</p>}
          {departureMatches.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                   <TableHead>Attendee</TableHead>
                  <TableHead>Departure Time</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departureMatches.map((match) => (
                  <TableRow key={match.userId}>
                     <TableCell className="flex items-center space-x-3">
                       <Avatar className="h-8 w-8">
                         <AvatarImage src={match.userProfile?.photoURL ?? undefined} alt={match.userProfile?.displayName ?? 'User'} />
                          <AvatarFallback>{getInitials(match.userProfile?.displayName)}</AvatarFallback>
                       </Avatar>
                       <span className="font-medium">{match.userProfile?.displayName ?? 'Attendee'}</span>
                     </TableCell>
                    <TableCell>{formatTime(match.departureDateTime)}</TableCell>
                    <TableCell className="text-right">
                       <Button
                            size="sm"
                            onClick={() => sendRideRequest(match.userId, 'departure')}
                            disabled={sendingNotification[match.userId + 'departure']}
                             variant="outline"
                             className="border-primary text-primary hover:bg-primary/10 hover:text-primary"
                       >
                         {sendingNotification[match.userId + 'departure'] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                         Let's Ride
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  );
};

export default RideMatches;
