"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, Timestamp, doc, setDoc, serverTimestamp, getDoc, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Plane, PlaneTakeoff, Send } from 'lucide-react'; // Replaced PlaneDeparture with PlaneTakeoff
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Attendance {
  userId: string;
  eventId: string;
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
  eventId: string;
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

const RideMatches: React.FC<RideMatchesProps> = ({ eventId, currentUserId, currentUserAttendance }) => {
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

    // If user has no arrival/departure details, no need to query
    if (!arrivalDateTime && !departureDateTime) {
      setLoading(false);
      return;
    }

    try {
      const attendanceRef = collection(db, 'attendance');
      // --- Base Query: Removed the userId != currentUserId filter --- 
      const baseQuery = query(
        attendanceRef,
        where('eventId', '==', eventId),
        where('attending', '==', true)
        // where('userId', '!=', currentUserId) // REMOVED: Firestore limitation
      );

      let arrivalQuery = null;
      let departureQuery = null;

      // --- Arrival Matching Query ---
      if (arrivalAirport && arrivalDateTime) {
        const arrivalTime = arrivalDateTime.toDate();
        const minArrivalTime = new Date(arrivalTime.getTime() - MAX_TIME_DIFF_MINUTES * 60000);
        const maxArrivalTime = new Date(arrivalTime.getTime() + MAX_TIME_DIFF_MINUTES * 60000);

        arrivalQuery = query(
          baseQuery, // Uses the modified baseQuery
          where('arrivalAirport', '==', arrivalAirport),
          where('arrivalDateTime', '>=', Timestamp.fromDate(minArrivalTime)),
          where('arrivalDateTime', '<=', Timestamp.fromDate(maxArrivalTime))
        );
      }

      // --- Departure Matching Query ---
      if (departureAirport && departureDateTime) {
        const departureTime = departureDateTime.toDate();
        const minDepartureTime = new Date(departureTime.getTime() - MAX_TIME_DIFF_MINUTES * 60000);
        const maxDepartureTime = new Date(departureTime.getTime() + MAX_TIME_DIFF_MINUTES * 60000);

        departureQuery = query(
          baseQuery, // Uses the modified baseQuery
          where('departureAirport', '==', departureAirport),
          where('departureDateTime', '>=', Timestamp.fromDate(minDepartureTime)),
          where('departureDateTime', '<=', Timestamp.fromDate(maxDepartureTime))
        );
      }

      // --- Fetch User Profiles --- 
      const fetchUserProfiles = async (userIds: string[]): Promise<Map<string, UserProfile>> => {
        const profiles = new Map<string, UserProfile>();
        if (userIds.length === 0) return profiles;

        const MAX_IDS_PER_QUERY = 30; // Firestore 'in' query limit
        for (let i = 0; i < userIds.length; i += MAX_IDS_PER_QUERY) {
          const chunkUserIds = userIds.slice(i, i + MAX_IDS_PER_QUERY);
          if (chunkUserIds.length > 0) {
            const usersRef = collection(db, 'users');
            // Ensure the query uses the field name 'uid' as stored in the 'users' collection
            const q = query(usersRef, where('uid', 'in', chunkUserIds)); 
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach((doc) => {
              // Use doc.id (which should be the uid) as the key
              profiles.set(doc.id, { uid: doc.id, ...doc.data() } as UserProfile);
            });
          }
        }
        return profiles;
      };

      // --- Execute Queries and Process Results ---
      const processResults = async (
        querySnapshot: Awaited<ReturnType<typeof getDocs>> | null,
        setMatches: React.Dispatch<React.SetStateAction<RideMatch[]>>
      ) => {
        if (!querySnapshot || querySnapshot.empty) {
          setMatches([]); // Ensure matches are cleared if no results
          return;
        }

        // --- Filter out current user client-side ---
        const filteredDocs = querySnapshot.docs.filter(doc => doc.data().userId !== currentUserId);
        
        if (filteredDocs.length === 0) {
            setMatches([]); // Set empty if only the current user matched
            return;
        }

        const matchesData = filteredDocs.map(doc => doc.data() as Attendance);
        const userIds = matchesData.map(match => match.userId);
        const userProfilesMap = await fetchUserProfiles(userIds);

        const combinedMatches: RideMatch[] = matchesData.map(match => ({
          ...match,
          userProfile: userProfilesMap.get(match.userId) || null,
        }));

        setMatches(combinedMatches);
      };

      // Run queries in parallel
      const [arrivalResults, departureResults] = await Promise.all([
        arrivalQuery ? getDocs(arrivalQuery) : Promise.resolve(null),
        departureQuery ? getDocs(departureQuery) : Promise.resolve(null),
      ]);

      await processResults(arrivalResults, setArrivalMatches);
      await processResults(departureResults, setDepartureMatches);

    } catch (err) {
      console.error("Error fetching matches:", err);
      setError("Failed to load ride matches. Please try again.");
      setArrivalMatches([]); // Clear matches on error
      setDepartureMatches([]);
    } finally {
      setLoading(false);
    }
  }, [eventId, currentUserId, currentUserAttendance]); // Dependencies

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);


  const sendRideRequest = async (recipientId: string, type: 'arrival' | 'departure') => {
    if (!currentUserAttendance || !recipientId) return;

    setSendingNotification(prev => ({ ...prev, [recipientId + type]: true }));

    const notificationData = {
      senderId: currentUserId,
      recipientId: recipientId,
      eventId: eventId,
      type: type, 
      senderArrivalDateTime: currentUserAttendance.arrivalDateTime || null,
      senderDepartureDateTime: currentUserAttendance.departureDateTime || null,
      status: 'pending', 
      createdAt: serverTimestamp(),
      read: false,
    };

    try {
      // Add notification document to Firestore
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

  // Don't show error if there are simply no matches (and loading is done)
  // Error state is now only for actual fetch errors
  if (error) {
    return <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
           </Alert>;
  }

  // Check if user has details to match against
  const hasArrivalDetails = !!currentUserAttendance.arrivalDateTime;
  const hasDepartureDetails = !!currentUserAttendance.departureDateTime;

  // Determine if we should show the "no matches found" messages
  const showNoArrivalMatches = hasArrivalDetails && arrivalMatches.length === 0 && !loading && !error;
  const showNoDepartureMatches = hasDepartureDetails && departureMatches.length === 0 && !loading && !error;

  return (
    <div className="space-y-6">
      {/* Arrival Matches */}
      {hasArrivalDetails && (
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center"><Plane className="mr-2 h-5 w-5 text-primary" /> Arrival Matches ({arrivalMatches.length})</h3>
          {showNoArrivalMatches && <p className="text-muted-foreground text-sm">No attendees found arriving near your time ({formatTime(currentUserAttendance.arrivalDateTime)} at {currentUserAttendance.arrivalAirport}).</p>}
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
                       {/* <Button
                            size="sm"
                            onClick={() => sendRideRequest(match.userId, 'arrival')}
                            disabled={sendingNotification[match.userId + 'arrival']}
                            variant="outline"
                            className="border-primary text-primary hover:bg-primary/10 hover:text-primary"
                        >
                         {sendingNotification[match.userId + 'arrival'] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                         Let's Ride
                       </Button> */}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* Departure Matches */}
      {hasDepartureDetails && (
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center"><PlaneTakeoff className="mr-2 h-5 w-5 text-primary" /> Departure Matches ({departureMatches.length})</h3>
          {showNoDepartureMatches && <p className="text-muted-foreground text-sm">No attendees found departing near your time ({formatTime(currentUserAttendance.departureDateTime)} from {currentUserAttendance.departureAirport}).</p>}
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

      {/* Message if user has no details entered */}
      {!hasArrivalDetails && !hasDepartureDetails && !loading && !error && (
           <p className="text-muted-foreground text-sm p-4 text-center">Enter your arrival or departure details above to find ride matches.</p>
      )}
    </div>
  );
};

export default RideMatches;
