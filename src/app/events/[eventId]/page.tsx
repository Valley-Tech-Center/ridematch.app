
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
import { Event, Attendance, Airport, UserProfile } from '@/types'; // Airport type still needed
import { format, parse } from 'date-fns';
import { Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import RideMatches from '@/components/conferences/ride-matches'; // Changed to default import
// Removed: import { getAirports } from '@/services/airport';


export default function EventDetailsPage() {
  const params = useParams();
  const eventId = params.eventId as string;
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [event, setEvent] = useState<Event | null>(null);
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [airports, setAirports] = useState<Airport[]>([]); // State to hold airports from the event
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


  // Fetch event details (including airports)
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
          // Set airports state from the event data
          if (eventData.airports && Array.isArray(eventData.airports)) {
              setAirports(eventData.airports);
              // Initialize form state with a default airport if available and form state is empty
              // Only do this if the form hasn't already been potentially populated by attendance data
              if (eventData.airports.length > 0 && !formState.arrivalAirport && !formState.departureAirport && !attendance) {
                  setFormState(prev => ({
                      ...prev,
                      arrivalAirport: prev.arrivalAirport || eventData.airports[0].code,
                      departureAirport: prev.departureAirport || eventData.airports[0].code,
                  }));
              }
          } else {
              console.warn("Event data does not contain a valid 'airports' array.");
              setAirports([]); // Set to empty array if not present or invalid
          }
        } else {
          toast({ variant: "destructive", title: "Error", description: "Event not found." });
          setEvent(null); // Ensure event is null if not found
          setAirports([]); // Clear airports if event not found
        }
      } catch (error) {
        console.error("Error fetching event details:", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to load event details." });
        setEvent(null);
        setAirports([]);
      }
      // Don't set loading false here yet, wait for attendance data (or lack thereof)
    };
    fetchEventDetails();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, toast]); // Removed attendance from dependency array here


  // Removed useEffect hook for fetching airports separately


  // Fetch user's attendance status and details after auth is loaded and event details are potentially fetched
  useEffect(() => {
      // Wait for auth, user, eventId, and the event object (which contains airports)
      if (authLoading || !user || !eventId || !event) {
        // If auth is done, user is not logged in, and event is loaded, stop loading
        if (!authLoading && !user && event) {
             setIsAttending(null); // Reset attendance state
             setLoading(false);
        }
        // If waiting for auth or eventId or event, keep loading true or let event fetch handle it
         else if (authLoading || !eventId || !event) {
            setLoading(true);
         }
        return; // Exit if prerequisites aren't met
      }

      // At this point, auth is done, user exists, eventId exists, and event (with airports) is loaded.
      setLoading(true); // Ensure loading is true while fetching attendance

      const attendanceCollectionRef = collection(db, 'attendance');
      const attendanceQuery = query(
          attendanceCollectionRef,
          where('userId', '==', user.uid),
          where('eventId', '==', eventId)
      );

      const unsubscribe = onSnapshot(attendanceQuery, (querySnapshot) => {
         try {
           if (!querySnapshot.empty) {
             const attendanceSnap = querySnapshot.docs[0];
             const data = attendanceSnap.data() as Attendance;
             setAttendance(data);
             setIsAttending(data.attending);

             // Populate form with existing data, use default airport from event if needed
             const defaultAirportCode = airports.length > 0 ? airports[0].code : '';
             setFormState({
               arrivalAirport: data.arrivalAirport || defaultAirportCode, // Use existing or default
               arrivalDate: data.arrivalDateTime?.toDate(),
               arrivalTime: data.arrivalDateTime ? format(data.arrivalDateTime.toDate(), 'HH:mm') : '',
               departureAirport: data.departureAirport || defaultAirportCode, // Use existing or default
               departureDate: data.departureDateTime?.toDate(),
               departureTime: data.departureDateTime ? format(data.departureDateTime.toDate(), 'HH:mm') : '',
             });
             setShowMatches(!!(data.arrivalDateTime || data.departureDateTime));
           } else {
             // No attendance record found
             setAttendance(null);
             setIsAttending(null); // Explicitly set to null (unknown) if no record
             setShowMatches(false);
             // Reset form state, using default airport from event if available
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
           setIsAttending(null); // Reset on error
           setShowMatches(false);
         } finally {
           // Finish loading ONLY when both event AND attendance data (or lack thereof) are processed
           setLoading(false); // Set loading false regardless of event finding, as attendance fetch is done
         }
       }, (error) => {
         console.error("Error fetching attendance:", error);
         toast({ variant: "destructive", title: "Error", description: "Failed to load your attendance status. Check permissions or network." });
         setIsAttending(null); // Reset on error
         setShowMatches(false);
         setLoading(false); // Ensure loading stops on error
       });

       // Cleanup listener
       return () => unsubscribe();

     // Depend on user, eventId, event (contains airports), and authLoading status
     }, [user, eventId, toast, authLoading, event, airports]); // Keep airports dependency as it's used for defaults


  const handleAttendanceChange = async (attending: boolean) => {
    if (!user || !eventId) return;

    setIsSaving(true);
    const attendanceCollectionRef = collection(db, 'attendance');
    const q = query(attendanceCollectionRef, where('userId', '==', user.uid), where('eventId', '==', eventId));

    try {
      const querySnapshot = await getDocs(q);
      let attendanceRef;
      let isNewDoc = querySnapshot.empty;

      if (isNewDoc) {
         attendanceRef = doc(collection(db, 'attendance')); // Ref for a new doc
      } else {
          attendanceRef = querySnapshot.docs[0].ref;
      }

      const baseData = {
        userId: user.uid,
        eventId: eventId,
        userName: user.displayName || user.email,
        userPhotoURL: user.photoURL,
        updatedAt: Timestamp.now(),
      };

      let dataToSave: Partial<Attendance>;

      if (attending) {
        dataToSave = {
          ...baseData,
          attending: true,
        };
      } else {
        dataToSave = {
          ...baseData,
          attending: false,
          arrivalAirport: deleteField(),
          arrivalDateTime: deleteField(),
          departureAirport: deleteField(),
          departureDateTime: deleteField(),
        };
      }

      await setDoc(attendanceRef, dataToSave, { merge: !isNewDoc });

      // Snapshot listener should handle local state updates, but we can optimistically update `isAttending`
      setIsAttending(attending);

      // Reset form and hide matches if marking as not attending
      // Let the snapshot listener handle repopulating the form based on the new attendance state
      if (!attending) {
          setShowMatches(false);
          // Reset form state using default airport from event if available
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
     const attendanceCollectionRef = collection(db, 'attendance');
     const q = query(attendanceCollectionRef, where('userId', '==', user.uid), where('eventId', '==', eventId));

     let arrivalTimestamp: Timestamp | null | undefined = undefined; // undefined means no change intended unless date/time set, null means clear
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
         arrivalTimestamp = null; // Explicitly clearing
     } else if(formState.arrivalDate && !formState.arrivalTime) {
         // Date set, time missing - invalid state
         toast({ variant: "destructive", title: "Error", description: "Please provide arrival time if arrival date is set." });
         setIsSaving(false);
         return;
     }


     let departureTimestamp: Timestamp | null | undefined = undefined; // undefined means no change intended, null means clear
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
         departureTimestamp = null; // Explicitly clearing
     } else if (formState.departureDate && !formState.departureTime) {
         // Date set, time missing - invalid state
         toast({ variant: "destructive", title: "Error", description: "Please provide departure time if departure date is set." });
         setIsSaving(false);
         return;
     }

     // Check if any actual details are being saved or cleared
     const isSavingDetails = arrivalTimestamp !== undefined || departureTimestamp !== undefined;
     if (!isAttending && !isSavingDetails) {
         // If not currently marked as attending and not providing any details, show warning
         toast({ variant: "destructive", title: "Info", description: "Please mark yourself as attending or provide travel details." });
         setIsSaving(false);
         return;
     }


     try {
        const querySnapshot = await getDocs(q);
        let attendanceRef;
        let isNewDoc = querySnapshot.empty;

        if (isNewDoc) {
           attendanceRef = doc(collection(db, 'attendance')); // Ref for a new doc
        } else {
            attendanceRef = querySnapshot.docs[0].ref;
        }

        // Base data structure including setting attending to true if details are provided
        const dataToSave: Partial<Attendance> = {
            userId: user.uid,
            eventId: eventId,
            userName: user.displayName || user.email,
            userPhotoURL: user.photoURL,
            // Only set attending to true if it's not already true OR if details are being added/modified
            attending: isAttending === true || isSavingDetails ? true : false,
            updatedAt: Timestamp.now(),
        };

        // Conditionally add arrival/departure fields based on whether they were set or cleared
        if (arrivalTimestamp !== undefined) { // If undefined, don't touch existing value
            dataToSave.arrivalAirport = arrivalTimestamp === null ? deleteField() : formState.arrivalAirport;
            dataToSave.arrivalDateTime = arrivalTimestamp === null ? deleteField() : arrivalTimestamp;
        }
         if (departureTimestamp !== undefined) { // If undefined, don't touch existing value
             dataToSave.departureAirport = departureTimestamp === null ? deleteField() : formState.departureAirport;
             dataToSave.departureDateTime = departureTimestamp === null ? deleteField() : departureTimestamp;
         }

        // Remove undefined fields before saving, Firestore merge handles this
        Object.keys(dataToSave).forEach(keyStr => {
          const key = keyStr as keyof typeof dataToSave;
          if (dataToSave[key] === undefined) {
            delete dataToSave[key]; // Remove the key if value is undefined
          }
        });

       await setDoc(attendanceRef, dataToSave, { merge: true }); // Always merge

       // Optimistically update attending state if details were saved
       if (isSavingDetails) {
           setIsAttending(true);
           setShowMatches(true); // Show matches immediately after saving details
       }
       // Let the snapshot listener update the form and attendance state for consistency

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
  if (loading || authLoading) { // Still check authLoading as well
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  // Render message if event not found (check after loading is false)
  if (!event) {
    return <div className="text-center py-10">Event not found or failed to load.</div>;
  }

  // Render message if user not logged in (check after loading is false)
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

          {/* Ride Details Form - Show if isAttending is true or null (prompting) */ }
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
                             <SelectValue placeholder={airports.length === 0 ? "No airports listed for event" : "Select arrival airport"} />
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
                         // Removed disabled attribute: Allow entering time even if date is not yet selected
                     />
                   </div>
                </div>

                 {/* Departure Details */}
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                     <Label htmlFor="departureAirport">Departure Airport</Label>
                     <Select name="departureAirport" value={formState.departureAirport || ''} onValueChange={(value) => handleSelectChange('departureAirport', value)} disabled={airports.length === 0}>
                         <SelectTrigger>
                             <SelectValue placeholder={airports.length === 0 ? "No airports listed for event" : "Select departure airport"} />
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
                            // Removed disabled attribute: Allow entering time even if date is not yet selected
                        />
                   </div>
                </div>

                 <Button type="submit" disabled={isSaving}>
                   {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                   Save Travel Details
                 </Button>
              </form>
          )}

            {/* Show Ride Matches Component - Only if attending and details have been potentially saved (showMatches controlled by snapshot/save) */}
            {isAttending === true && showMatches && eventId && user && attendance && (
                 <div className="pt-4 border-t">
                      <RideMatches
                            eventId={eventId}
                            currentUserId={user.uid}
                            currentUserAttendance={attendance} // Pass full attendance object
                       />
                 </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}

