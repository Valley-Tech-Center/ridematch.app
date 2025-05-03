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
import { useToast } from "@/hooks/use-toast";
import { Event, Attendance, Airport } from '@/types'; // Define your types
import { format, parse } from 'date-fns';
import { Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { RideMatches } from '@/components/conferences/ride-matches'; // Import the RideMatches component
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

  // Fetch airports
  useEffect(() => {
    const loadAirports = async () => {
      try {
        const fetchedAirports = await getAirports();
        setAirports(fetchedAirports);
        // Initialize form state with a default airport if available
        if (fetchedAirports.length > 0) {
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
  }, [toast]);


  // Fetch user's attendance status and details after auth is loaded and event details are potentially fetched
  useEffect(() => {
      if (!user || !eventId || airports.length === 0) {
        // If user is not logged in, or eventId/airports aren't ready, set state accordingly
        if (!authLoading && !user) {
           setIsAttending(null); // Not logged in, status is N/A
           setLoading(false); // Finish loading if auth is done and user is null
        }
         // Keep loading true if eventId or airports aren't ready, or auth is still loading
         else if (!eventId || airports.length === 0 || authLoading) {
            setLoading(true);
         }
        return;
      }

      setLoading(true); // Ensure loading is true while fetching attendance

      const attendanceRef = doc(db, 'events', eventId, 'attendees', user.uid);

      // Use onSnapshot for real-time updates
       const unsubscribe = onSnapshot(attendanceRef, (attendanceSnap) => {
         try {
           if (attendanceSnap.exists()) {
             const data = attendanceSnap.data() as Attendance;
             setAttendance(data);
             setIsAttending(data.attending);
             // Populate form with existing data
             setFormState({
               arrivalAirport: data.arrivalAirport ?? airports[0]?.code ?? '',
               arrivalDate: data.arrivalDateTime?.toDate(),
               arrivalTime: data.arrivalDateTime ? format(data.arrivalDateTime.toDate(), 'HH:mm') : '',
               departureAirport: data.departureAirport ?? airports[0]?.code ?? '',
               departureDate: data.departureDateTime?.toDate(),
               departureTime: data.departureDateTime ? format(data.departureDateTime.toDate(), 'HH:mm') : '',
             });
             setShowMatches(!!(data.arrivalDateTime || data.departureDateTime)); // Show matches if details are saved
           } else {
             setAttendance(null);
             setIsAttending(null); // No record exists, status is unknown, prompt user
             setShowMatches(false);
             // Reset form state if no attendance record
              setFormState({
                arrivalAirport: airports[0]?.code ?? '',
                arrivalDate: undefined,
                arrivalTime: '',
                departureAirport: airports[0]?.code ?? '',
                departureDate: undefined,
                departureTime: '',
              });
           }
         } catch (error) {
           console.error("Error processing attendance snapshot:", error);
           toast({ variant: "destructive", title: "Error", description: "Failed to process attendance status." });
           setIsAttending(null); // Error state
           setShowMatches(false);
         } finally {
           setLoading(false); // Finish loading after attendance snapshot is processed
         }
       }, (error) => {
         // This error callback handles errors during the listen operation itself (e.g., permissions)
         console.error("Error fetching attendance:", error);
         toast({ variant: "destructive", title: "Error", description: "Failed to load your attendance status. Check permissions or network." });
         setIsAttending(null); // Error state
         setShowMatches(false);
         setLoading(false); // Finish loading on error
       });


       // Cleanup listener on component unmount or when dependencies change
       return () => unsubscribe();

     }, [user, eventId, toast, airports, authLoading]); // Add authLoading


  const handleAttendanceChange = async (attending: boolean) => {
    if (!user || !eventId) return;

    setIsSaving(true);
    const attendanceRef = doc(db, 'events', eventId, 'attendees', user.uid);

    try {
      // Base data to ensure user info is always included
      const baseData = {
        userId: user.uid,
        userName: user.displayName || user.email,
        userPhotoURL: user.photoURL,
        updatedAt: Timestamp.now(),
      };

      let dataToSave: Partial<Attendance>;

      if (attending) {
        // === Clicking YES ===
        // Only save the attending status and basic info.
        // Flight details are saved via handleDetailsSubmit.
        // Using merge: true ensures we don't overwrite existing flight details.
        dataToSave = {
          ...baseData,
          attending: true,
        };
      } else {
        // === Clicking NO ===
        // Save attending false and explicitly clear flight details.
        dataToSave = {
          ...baseData,
          attending: false,
          arrivalAirport: deleteField(), // Use deleteField() or null
          arrivalDateTime: deleteField(),
          departureAirport: deleteField(),
          departureDateTime: deleteField(),
        };
      }

      await setDoc(attendanceRef, dataToSave, { merge: true });

      // Local state updates after successful save
      setIsAttending(attending);
      setAttendance(prev => ({ ...(prev ?? baseData), ...dataToSave })); // Update local attendance state

      // Reset form and hide matches if marking as not attending
      if (!attending) {
        setFormState({
          arrivalAirport: airports[0]?.code ?? '',
          arrivalDate: undefined,
          arrivalTime: '',
          departureAirport: airports[0]?.code ?? '',
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
     if (!user || !eventId) return; // Removed isAttending check here

     setIsSaving(true);
     const attendanceRef = doc(db, 'events', eventId, 'attendees', user.uid);

     // Combine Date and Time into Timestamp objects
     let arrivalTimestamp: Timestamp | undefined | null = undefined;
     if (formState.arrivalDate && formState.arrivalTime) {
       try {
         const [hours, minutes] = formState.arrivalTime.split(':').map(Number);
         const arrivalDateTime = new Date(formState.arrivalDate);
         arrivalDateTime.setHours(hours, minutes, 0, 0); // Set hours and minutes
         arrivalTimestamp = Timestamp.fromDate(arrivalDateTime);
       } catch (err) {
           console.error("Invalid arrival date/time format");
           toast({ variant: "destructive", title: "Error", description: "Invalid arrival time format. Please use HH:mm." });
           setIsSaving(false);
           return;
       }
     } else if (formState.arrivalDate === undefined && formState.arrivalTime === '') {
         arrivalTimestamp = null; // Explicitly clearing
     }

     let departureTimestamp: Timestamp | undefined | null = undefined;
     if (formState.departureDate && formState.departureTime) {
        try {
            const [hours, minutes] = formState.departureTime.split(':').map(Number);
            const departureDateTime = new Date(formState.departureDate);
            departureDateTime.setHours(hours, minutes, 0, 0); // Set hours and minutes
            departureTimestamp = Timestamp.fromDate(departureDateTime);
        } catch (err) {
            console.error("Invalid departure date/time format");
            toast({ variant: "destructive", title: "Error", description: "Invalid departure time format. Please use HH:mm." });
            setIsSaving(false);
            return;
        }
     } else if (formState.departureDate === undefined && formState.departureTime === '') {
         departureTimestamp = null; // Explicitly clearing
     }

      // Check if at least one detail is provided or if both are being cleared
     if (!arrivalTimestamp && !departureTimestamp) {
         // Only show error if the user *intended* to submit details but didn't provide any
         // If both were null from the start, allow saving (marks as attending)
         const hasExistingDetails = attendance?.arrivalDateTime || attendance?.departureDateTime;
         if (hasExistingDetails || formState.arrivalAirport || formState.departureAirport) {
            toast({ variant: "destructive", title: "Error", description: "Please provide either arrival or departure details (or both)." });
            setIsSaving(false);
            return;
         }
         // If no existing details and no input, proceed to mark as attending
     }


     try {
        // Base data structure including setting attending to true
        const dataToSave: Partial<Attendance> = {
            userId: user.uid,
            userName: user.displayName || user.email,
            userPhotoURL: user.photoURL,
            attending: true, // Saving details implies attending
            arrivalAirport: arrivalTimestamp ? formState.arrivalAirport : deleteField(), // Use deleteField() if clearing
            arrivalDateTime: arrivalTimestamp === null ? deleteField() : arrivalTimestamp, // Use deleteField() if clearing
            departureAirport: departureTimestamp ? formState.departureAirport : deleteField(), // Use deleteField() if clearing
            departureDateTime: departureTimestamp === null ? deleteField() : departureTimestamp, // Use deleteField() if clearing
            updatedAt: Timestamp.now(),
        };

       // Remove undefined fields that should be deleted
       Object.keys(dataToSave).forEach(key => {
           if (dataToSave[key as keyof typeof dataToSave] === undefined) {
                dataToSave[key as keyof typeof dataToSave] = deleteField();
           }
       });

       await setDoc(attendanceRef, dataToSave, { merge: true }); // Use merge to ensure we don't overwrite other fields unnecessarily

       // Update local state based on saved data
       // Re-fetch or update state carefully based on `dataToSave`
       // Note: Setting state directly might be slightly out of sync if `deleteField` was used extensively
       // The onSnapshot listener should ideally handle the update visually.
        setIsAttending(true); // Ensure isAttending is true
        // Let the snapshot listener update the form and showMatches state for consistency
        // setShowMatches(!!(arrivalTimestamp || departureTimestamp)); // Show matches after saving

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
     // Special handling potentially needed for select if using its 'name' attribute directly
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

  // Render message if event not found or user not logged in for specific actions
  if (!event) {
    return <div className="text-center py-10">Event not found.</div>;
  }

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
                     <Select name="arrivalAirport" value={formState.arrivalAirport} onValueChange={(value) => handleSelectChange('arrivalAirport', value)}>
                         <SelectTrigger>
                             <SelectValue placeholder="Select arrival airport" />
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
                     <Select name="departureAirport" value={formState.departureAirport} onValueChange={(value) => handleSelectChange('departureAirport', value)}>
                         <SelectTrigger>
                             <SelectValue placeholder="Select departure airport" />
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

            {/* Show Ride Matches Component - Only if attending and details have been potentially saved (showMatches is true) */}
            {isAttending === true && showMatches && eventId && user && (
                 <div className="pt-4 border-t">
                      <RideMatches eventId={eventId} currentUserId={user.uid} />
                 </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
