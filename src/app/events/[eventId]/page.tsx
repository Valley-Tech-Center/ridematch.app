
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc, setDoc, getDocs, collection, Timestamp, query, where, onSnapshot, deleteField } from 'firebase/firestore'; // Import deleteField
import { db, auth } from '@/lib/firebase/config';
import { useAuth } from '@/context/auth-context';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from '@/hooks/use-toast';
import { Event, Attendance, Airport, UserProfile } from '@/types'; // Define your types
import { format, parse } from 'date-fns';
import { Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import RideMatches from '@/components/conferences/ride-matches'; // Changed to default import
import { getAirports } from '@/services/airport';


export default function EventDetailsPage() {
  const params = useParams();
  const eventId = params.eventId as string;
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [event, setEvent] = useState<Event | null>(null);
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [airports, setAirports] = useState<Airport[]>([]);
  const [loading, setLoading] = useState(true); // Overall loading state for the page
  const [isAttending, setIsAttending] = useState<boolean | null>(null); // null = loading/unknown, false = not attending, true = attending
  const [formState, setFormState] = useState<{
    arrivalAirport: string;
    arrivalDate: Date | undefined;
    arrivalTime: string; // HH:mm format
    departureAirport: string;
    departureDate: Date | undefined;
    departureTime: string; // HH:mm format
  }>({
    arrivalAirport: '',
    arrivalDate: undefined,
    arrivalTime: '',
    departureAirport: '',
    departureDate: undefined,
    departureTime: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showMatches, setShowMatches] = useState(false); // State to control showing matches


  // Fetch event details
  useEffect(() => {
    if (!eventId) return;
    setLoading(true); // Start loading when fetching event details
    const fetchEventDetails = async () => {
      const eventRef = doc(db, 'events', eventId);
      try {
        const docSnap = await getDoc(eventRef);
        if (docSnap.exists()) {
          const eventData = docSnap.data() as Event;
          setEvent({ ...eventData, id: docSnap.id }); // Set event data
        } else {
          toast({ variant: "destructive", title: "Error", description: "Event not found." });
        }
      } catch (error) {
        console.error("Error fetching event details:", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to load event details." });
      }
      // Don't set loading false here yet, wait for attendance data
    };
    fetchEventDetails();
  }, [eventId, toast]);

  // Fetch airports based on event city (if event exists)
  useEffect(() => {
    if (!event?.city) return; // Only fetch if event and its city are loaded

    const loadAirports = async () => {
      try {
        console.log(`Fetching airports for city: ${event.city}`);
        const fetchedAirports = await getAirports(event.city); // Pass city to getAirports
        console.log("Fetched airports:", fetchedAirports);
        setAirports(fetchedAirports);
        // Initialize form state with a default airport if available and form state is empty
        if (fetchedAirports.length > 0 && !formState.arrivalAirport && !formState.departureAirport) {
          setFormState(prev => ({
            ...prev,
            arrivalAirport: prev.arrivalAirport || fetchedAirports[0].code,
            departureAirport: prev.departureAirport || fetchedAirports[0].code,
          }));
        }
      } catch (error) {
        console.error("Error fetching airports:", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to load airport data." });
      }
    };
    loadAirports();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.city, toast]); // Depend on event.city


  // Fetch user's attendance status and details after auth is loaded and event details are potentially fetched
  useEffect(() => {
      // Adjusted condition: Wait for auth, eventId. Airports might still be loading, handle default later.
      if (!user || !eventId) {
        if (!authLoading && !user) {
           setIsAttending(null);
           setLoading(false);
        }
         else if (!eventId || authLoading) {
            setLoading(true);
         }
        return;
      }

      setLoading(true); // Ensure loading is true while fetching attendance

      // --- Modified Firestore Path ---
      // Attendance data is now stored in the top-level 'attendance' collection
      const attendanceCollectionRef = collection(db, 'attendance');
      // Create a query to find the specific attendance document for this user and event
      const attendanceQuery = query(
          attendanceCollectionRef,
          where('userId', '==', user.uid),
          where('eventId', '==', eventId)
      );

      // Use onSnapshot for real-time updates on the query result
       const unsubscribe = onSnapshot(attendanceQuery, (querySnapshot) => {
         try {
            // Since we query by userId and eventId, there should be 0 or 1 result
           if (!querySnapshot.empty) {
             const attendanceSnap = querySnapshot.docs[0]; // Get the first (and likely only) document
             const data = attendanceSnap.data() as Attendance;
             setAttendance(data);
             setIsAttending(data.attending);

             // Populate form with existing data, use default airport if needed and airports are loaded
             const defaultAirportCode = airports.length > 0 ? airports[0].code : '';
             setFormState({
               arrivalAirport: data.arrivalAirport ?? defaultAirportCode,
               arrivalDate: data.arrivalDateTime?.toDate(),
               arrivalTime: data.arrivalDateTime ? format(data.arrivalDateTime.toDate(), 'HH:mm') : '',
               departureAirport: data.departureAirport ?? defaultAirportCode,
               departureDate: data.departureDateTime?.toDate(),
               departureTime: data.departureDateTime ? format(data.departureDateTime.toDate(), 'HH:mm') : '',
             });
             setShowMatches(!!(data.arrivalDateTime || data.departureDateTime));
           } else {
              // No attendance record found for this user/event
             setAttendance(null);
             setIsAttending(null);
             setShowMatches(false);
             // Reset form state, use default airport if loaded
              const defaultAirportCode = airports.length > 0 ? airports[0].code : '';
              setFormState({
                arrivalAirport: defaultAirportCode,
                arrivalDate: undefined,
                arrivalTime: '',
                departureAirport: defaultAirportCode,
                departureDate: undefined,
                departureTime: '',
              });
           }
         } catch (error) {
           console.error("Error processing attendance snapshot:", error);
           toast({ variant: "destructive", title: "Error", description: "Failed to process attendance status." });
           setIsAttending(null);
           setShowMatches(false);
         } finally {
           // Finish loading ONLY when both event AND attendance data (or lack thereof) are processed
           // This ensures airports list is potentially ready before render attempts
           if (event) { // Make sure event is loaded too
                setLoading(false);
           }
         }
       }, (error) => {
         console.error("Error fetching attendance:", error);
         toast({ variant: "destructive", title: "Error", description: "Failed to load your attendance status. Check permissions or network." });
         setIsAttending(null);
         setShowMatches(false);
         setLoading(false);
       });


       // Cleanup listener
       return () => unsubscribe();

     }, [user, eventId, toast, airports, authLoading, event]); // Added event dependency


  const handleAttendanceChange = async (attending: boolean) => {
    if (!user || !eventId) return;

    setIsSaving(true);
    // --- Modified Firestore Path ---
    // We need to query for the existing doc or create a new one.
    // It's simpler to use a consistent document ID if possible,
    // but if not, query then update/add. Let's query first.
    const attendanceCollectionRef = collection(db, 'attendance');
    const q = query(attendanceCollectionRef, where('userId', '==', user.uid), where('eventId', '==', eventId));

    try {
      const querySnapshot = await getDocs(q);
      let attendanceRef;

      if (querySnapshot.empty) {
         // No existing document, create a new one (Firestore generates ID)
         // We'll add the data directly later.
         attendanceRef = doc(collection(db, 'attendance')); // Ref for a new doc
      } else {
          // Existing document found, get its reference
          attendanceRef = querySnapshot.docs[0].ref;
      }


      // Base data to ensure user info is always included
      const baseData = {
        userId: user.uid,
        eventId: eventId, // Explicitly add eventId
        userName: user.displayName || user.email,
        userPhotoURL: user.photoURL,
        updatedAt: Timestamp.now(),
      };

      let dataToSave: Partial<Attendance>;

      if (attending) {
        // === Clicking YES ===
        dataToSave = {
          ...baseData,
          attending: true,
        };
      } else {
        // === Clicking NO ===
        dataToSave = {
          ...baseData,
          attending: false,
          arrivalAirport: deleteField(),
          arrivalDateTime: deleteField(),
          departureAirport: deleteField(),
          departureDateTime: deleteField(),
        };
      }

      // Use setDoc with the determined ref, merge if updating existing
      await setDoc(attendanceRef, dataToSave, { merge: !querySnapshot.empty });


      // Local state updates after successful save
      setIsAttending(attending);
      // Update local attendance state, ensuring eventId is present
      const updatedLocalAttendance = { ...(attendance ?? {}), ...dataToSave, eventId: eventId };
      setAttendance(updatedLocalAttendance as Attendance); // Assert type after merge

      // Reset form and hide matches if marking as not attending
      if (!attending) {
        const defaultAirportCode = airports.length > 0 ? airports[0].code : '';
        setFormState({
          arrivalAirport: defaultAirportCode,
          arrivalDate: undefined,
          arrivalTime: '',
          departureAirport: defaultAirportCode,
          departureDate: undefined,
          departureTime: '',
        });
        setShowMatches(false);
      }

      toast({ title: "Success", description: `You are now marked as ${attending ? 'attending' : 'not attending'}.` });
    } catch (error) {
      console.error("Error updating attendance:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to update your attendance." });
    } finally {
      setIsSaving(false);
    }
  };


 const handleDetailsSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
     e.preventDefault();
     if (!user || !eventId) return;

     setIsSaving(true);
     // --- Modified Firestore Path ---
     const attendanceCollectionRef = collection(db, 'attendance');
     const q = query(attendanceCollectionRef, where('userId', '==', user.uid), where('eventId', '==', eventId));


     // Combine Date and Time into Timestamp objects
     let arrivalTimestamp: Timestamp | undefined | null = undefined;
     if (formState.arrivalDate && formState.arrivalTime) {
       try {
         const [hours, minutes] = formState.arrivalTime.split(':').map(Number);
         const arrivalDateTime = new Date(formState.arrivalDate);
         arrivalDateTime.setHours(hours, minutes, 0, 0);
         arrivalTimestamp = Timestamp.fromDate(arrivalDateTime);
       } catch (err) {
           console.error("Invalid arrival date/time format");
           toast({ variant: "destructive", title: "Error", description: "Invalid arrival time format. Please use HH:mm." });
           setIsSaving(false);
           return;
       }
     } else if (!formState.arrivalDate && !formState.arrivalTime) {
         // If both date and time are empty/undefined, treat as clearing the field
         arrivalTimestamp = null; // Explicitly clearing
     }

     let departureTimestamp: Timestamp | undefined | null = undefined;
     if (formState.departureDate && formState.departureTime) {
        try {
            const [hours, minutes] = formState.departureTime.split(':').map(Number);
            const departureDateTime = new Date(formState.departureDate);
            departureDateTime.setHours(hours, minutes, 0, 0);
            departureTimestamp = Timestamp.fromDate(departureDateTime);
        } catch (err) {
            console.error("Invalid departure date/time format");
            toast({ variant: "destructive", title: "Error", description: "Invalid departure time format. Please use HH:mm." });
            setIsSaving(false);
            return;
        }
     } else if (!formState.departureDate && !formState.departureTime) {
         // If both date and time are empty/undefined, treat as clearing the field
         departureTimestamp = null; // Explicitly clearing
     }

      // Check if at least one detail is provided (or being cleared explicitly)
      // Allow saving even if both are null, as this might just be marking attendance
     if (arrivalTimestamp === undefined && departureTimestamp === undefined) {
        // If they *tried* to enter details but failed (e.g., only date, no time)
        if ((formState.arrivalDate && !formState.arrivalTime) || (formState.departureDate && !formState.departureTime)) {
             toast({ variant: "destructive", title: "Error", description: "Please provide both date and time for arrival/departure." });
             setIsSaving(false);
             return;
        }
        // If both sections are truly empty (not just missing time), allow proceeding
        // This will mark them as attending without flight details.
     }


     try {
        const querySnapshot = await getDocs(q);
        let attendanceRef;
        let isNewDoc = false;

        if (querySnapshot.empty) {
           attendanceRef = doc(collection(db, 'attendance')); // Ref for a new doc
           isNewDoc = true;
        } else {
            attendanceRef = querySnapshot.docs[0].ref;
        }

        // Base data structure including setting attending to true
        const dataToSave: Partial<Attendance> = {
            userId: user.uid,
            eventId: eventId, // Ensure eventId is saved
            userName: user.displayName || user.email,
            userPhotoURL: user.photoURL,
            attending: true, // Saving details implies attending
            arrivalAirport: arrivalTimestamp ? formState.arrivalAirport : (attendance?.arrivalAirport === undefined ? deleteField() : null),
            arrivalDateTime: arrivalTimestamp === null ? deleteField() : arrivalTimestamp, // Use deleteField() for explicit clear
            departureAirport: departureTimestamp ? formState.departureAirport : (attendance?.departureAirport === undefined ? deleteField() : null),
            departureDateTime: departureTimestamp === null ? deleteField() : departureTimestamp, // Use deleteField() for explicit clear
            updatedAt: Timestamp.now(),
        };

       // Clean up undefined values before saving, replace with deleteField() only if necessary
       Object.keys(dataToSave).forEach(keyStr => {
          const key = keyStr as keyof typeof dataToSave;
           if (dataToSave[key] === undefined) {
               // Only delete if it's not already being set to null (explicit clear)
               if (key !== 'arrivalDateTime' && key !== 'departureDateTime') {
                  // For airports, deleteField if undefined, otherwise keep null/value
                  dataToSave[key] = deleteField();
               }
               // If arrivalTimestamp/departureTimestamp was undefined (not null), keep dataToSave field undefined for merge
               // If it was null, dataToSave already has deleteField()
           }
       });


       await setDoc(attendanceRef, dataToSave, { merge: !isNewDoc });

       setIsAttending(true); // Ensure isAttending is true locally
       // Let the snapshot listener update the form and showMatches state for consistency

       toast({ title: "Success", description: "Your travel details have been saved." });
     } catch (error) {
       console.error("Error saving travel details:", error);
       toast({ variant: "destructive", title: "Error", description: "Failed to save your travel details." });
     } finally {
       setIsSaving(false);
     }
   };


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormState(prev => ({ ...prev, [name]: value }));
  };


  const handleDateChange = (name: string, date: Date | undefined) => {
      setFormState(prev => ({
        ...prev,
        [name]: date,
        // Reset time if date is cleared
        [`${name.replace('Date', 'Time')}`]: date ? prev[`${name.replace('Date', 'Time')}` as keyof typeof formState] : '',
      }));
  };


  // Render loading state
  if (loading || authLoading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  // Render message if event not found
  if (!event) {
    return <div className="text-center py-10">Event not found.</div>;
  }

  // Render message if user not logged in
  if (!user) {
      return (
          <div className="container mx-auto p-4">
              <Card>
                  <CardHeader>
                      <CardTitle>{event.name}</CardTitle>
                      <CardDescription>
                          {format(event.startDate.toDate(), 'PPP')} - {format(event.endDate.toDate(), 'PPP')} <br />
                          {event.location}
                      </CardDescription>
                  </CardHeader>
                  <CardContent>
                      <p>Please log in to view attendance details and find ride matches.</p>
                      {/* Optionally add a login button here */}
                  </CardContent>
              </Card>
          </div>
      );
  }


  // Main component render
  return (
    <div className="container mx-auto p-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{event.name}</CardTitle>
          <CardDescription>
            {format(event.startDate.toDate(), 'PPP')} - {format(event.endDate.toDate(), 'PPP')} <br />
            {event.location}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Attendance Buttons */}
          <div className="flex gap-4 items-center">
              <span>Are you attending?</span>
              <Button
                onClick={() => handleAttendanceChange(true)}
                variant={isAttending === true ? "default" : "outline"}
                disabled={isSaving || isAttending === true}
              >
                Yes
              </Button>
              <Button
                onClick={() => handleAttendanceChange(false)}
                variant={isAttending === false ? "default" : "outline"}
                disabled={isSaving || isAttending === false}
              >
                No
              </Button>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>

          {/* Ride Details Form - Show if isAttending is true OR if it's null (meaning unknown/prompt) */}
          {(isAttending === true || isAttending === null) && (
              <form onSubmit={handleDetailsSubmit} className="space-y-4 pt-4 border-t">
                 <h3 className="text-lg font-semibold">Share Your Travel Details (Optional)</h3>
                 <p className="text-sm text-muted-foreground">
                    {isAttending === null ? "Indicate if you are attending first, or fill this in to automatically mark yourself as attending." : "Provide your flight details to find potential ride matches."}
                 </p>

                 {/* Arrival Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                     <Label htmlFor="arrivalAirport">Arrival Airport</Label>
                     <Select name="arrivalAirport" value={formState.arrivalAirport || ''} onValueChange={(value) => handleSelectChange('arrivalAirport', value)} disabled={airports.length === 0}>
                         <SelectTrigger>
                             <SelectValue placeholder={airports.length === 0 ? "Loading airports..." : "Select arrival airport"} />
                         </SelectTrigger>
                         <SelectContent>
                             {airports.map(airport => (
                                 <SelectItem key={airport.code} value={airport.code}>
                                     {airport.code} - {airport.name}
                                 </SelectItem>
                             ))}
                         </SelectContent>
                     </Select>
                  </div>
                   <div className="space-y-2">
                     <Label htmlFor="arrivalDate">Arrival Date</Label>
                     <Popover>
                       <PopoverTrigger asChild>
                         <Button
                           variant={"outline"}
                           className={cn(
                             "w-full justify-start text-left font-normal",
                             !formState.arrivalDate && "text-muted-foreground"
                           )}
                         >
                           <CalendarIcon className="mr-2 h-4 w-4" />
                           {formState.arrivalDate ? format(formState.arrivalDate, "PPP") : <span>Pick a date</span>}
                         </Button>
                       </PopoverTrigger>
                       <PopoverContent className="w-auto p-0">
                         <Calendar
                           mode="single"
                           selected={formState.arrivalDate}
                           onSelect={(date) => handleDateChange('arrivalDate', date)}
                           initialFocus
                         />
                       </PopoverContent>
                     </Popover>
                   </div>
                   <div className="space-y-2">
                     <Label htmlFor="arrivalTime">Arrival Time (HH:mm)</Label>
                     <Input
                         id="arrivalTime"
                         name="arrivalTime"
                         type="time"
                         value={formState.arrivalTime}
                         onChange={handleInputChange}
                         disabled={!formState.arrivalDate} // Disable if date is not set
                     />
                   </div>
                </div>

                 {/* Departure Details */}
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                     <Label htmlFor="departureAirport">Departure Airport</Label>
                     <Select name="departureAirport" value={formState.departureAirport || ''} onValueChange={(value) => handleSelectChange('departureAirport', value)} disabled={airports.length === 0}>
                         <SelectTrigger>
                             <SelectValue placeholder={airports.length === 0 ? "Loading airports..." : "Select departure airport"} />
                         </SelectTrigger>
                         <SelectContent>
                             {airports.map(airport => (
                                 <SelectItem key={airport.code} value={airport.code}>
                                     {airport.code} - {airport.name}
                                 </SelectItem>
                             ))}
                         </SelectContent>
                     </Select>
                  </div>
                   <div className="space-y-2">
                     <Label htmlFor="departureDate">Departure Date</Label>
                     <Popover>
                       <PopoverTrigger asChild>
                         <Button
                           variant={"outline"}
                           className={cn(
                             "w-full justify-start text-left font-normal",
                             !formState.departureDate && "text-muted-foreground"
                           )}
                         >
                           <CalendarIcon className="mr-2 h-4 w-4" />
                           {formState.departureDate ? format(formState.departureDate, "PPP") : <span>Pick a date</span>}
                         </Button>
                       </PopoverTrigger>
                       <PopoverContent className="w-auto p-0">
                         <Calendar
                           mode="single"
                           selected={formState.departureDate}
                           onSelect={(date) => handleDateChange('departureDate', date)}
                           initialFocus
                         />
                       </PopoverContent>
                     </Popover>
                   </div>
                    <div className="space-y-2">
                        <Label htmlFor="departureTime">Departure Time (HH:mm)</Label>
                        <Input
                            id="departureTime"
                            name="departureTime"
                            type="time"
                            value={formState.departureTime}
                            onChange={handleInputChange}
                            disabled={!formState.departureDate} // Disable if date is not set
                        />
                   </div>
                </div>

                 <Button type="submit" disabled={isSaving}>
                   {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                   Save Travel Details
                 </Button>
              </form>
          )}

            {/* Show Ride Matches Component - Only if attending and details have been saved (showMatches is true) and attendance is loaded */}
            {isAttending === true && showMatches && eventId && user && attendance && (
                 <div className="pt-4 border-t">
                      {/* Pass the current user's attendance details */}
                      <RideMatches
                            eventId={eventId}
                            currentUserId={user.uid}
                            currentUserAttendance={attendance}
                       />
                 </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}

