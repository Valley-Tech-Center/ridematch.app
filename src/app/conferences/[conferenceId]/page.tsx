"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, setDoc, getDocFromServer, Timestamp, collection, query, where, getDocs, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/context/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { Calendar as CalendarIcon, CheckCircle, XCircle, Loader2, PlaneArrival, PlaneDeparture, Users, MapPin, Car } from "lucide-react";
import { Airport, getAirports } from '@/services/airport'; // Using the provided service
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import RideMatches from '@/components/conferences/ride-matches'; // Import the RideMatches component

interface Conference {
  id: string;
  name: string;
  city: string;
  state: string;
  startDate: Timestamp;
  endDate: Timestamp;
  airports?: string[]; // Optional: List of relevant airport codes from conference data
}

interface Attendance {
  userId: string;
  conferenceId: string;
  attending: boolean;
  arrivalAirport?: string | null;
  arrivalDateTime?: Timestamp | null;
  departureAirport?: string | null;
  departureDateTime?: Timestamp | null;
}

// Helper to format Firestore Timestamps
const formatDate = (ts: Timestamp | null | undefined): string => {
  return ts ? format(ts.toDate(), 'PPP p') : 'Not set'; // PPP gives "Month d, yyyy", p gives time
};
const formatConferenceDate = (ts: Timestamp | null | undefined): string => {
    return ts ? format(ts.toDate(), 'PPP') : 'N/A';
}


export default function ConferenceDetailPage() {
  const params = useParams();
  const conferenceId = params.conferenceId as string;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [conference, setConference] = useState<Conference | null>(null);
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [airports, setAirports] = useState<Airport[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAttending, setIsAttending] = useState<boolean | null>(null); // null = loading, false = not attending, true = attending
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

  // Fetch conference details
  useEffect(() => {
    if (!conferenceId) return;

    const fetchConference = async () => {
      setLoading(true);
      try {
        const confRef = doc(db, 'conferences', conferenceId);
        const confSnap = await getDoc(confRef);

        if (confSnap.exists()) {
          const confData = { id: confSnap.id, ...confSnap.data() } as Conference;
          setConference(confData);
          // Fetch airports based on conference city
          const fetchedAirports = await getAirports(confData.city);
          setAirports(fetchedAirports);
          // Set default airport if available
           if (fetchedAirports.length > 0) {
             setFormState(prev => ({
                ...prev,
                arrivalAirport: confData.airports?.[0] ?? fetchedAirports[0].code,
                departureAirport: confData.airports?.[0] ?? fetchedAirports[0].code,
             }));
           }

        } else {
          toast({ variant: "destructive", title: "Error", description: "Conference not found." });
          router.push('/conferences'); // Redirect if conference doesn't exist
        }
      } catch (error) {
        console.error("Error fetching conference:", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to load conference details." });
      } finally {
        // Loading is set to false after attendance is fetched
      }
    };

    fetchConference();
  }, [conferenceId, router, toast]);


  // Fetch user's attendance status and details
  const fetchAttendance = useCallback(async () => {
     if (!user || !conferenceId) {
        setIsAttending(null); // Reset if user logs out or conferenceId changes
        setLoading(false); // Ensure loading finishes if no user
        return;
     }

     try {
       // Construct the document ID for the user's attendance
       const attendanceDocId = `${user.uid}_${conferenceId}`;
       const attendanceRef = doc(db, 'attendance', attendanceDocId);
       const attendanceSnap = await getDocFromServer(attendanceRef); // Use getDocFromServer for fresher data


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
         setIsAttending(false); // Assume not attending if no record exists
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
       console.error("Error fetching attendance:", error);
       toast({ variant: "destructive", title: "Error", description: "Failed to load your attendance status." });
       setIsAttending(null); // Error state
       setShowMatches(false);
     } finally {
       setLoading(false); // Finish loading after attendance is fetched
     }
   }, [user, conferenceId, toast, airports]); // Add airports to dependency array


    useEffect(() => {
      if (!authLoading) { // Only fetch attendance once auth status is confirmed
          fetchAttendance();
      }
    }, [authLoading, fetchAttendance]); // Depend on authLoading and the fetch function


   const handleAttendanceChange = async (attending: boolean) => {
       if (!user || !conferenceId) return;
       setIsSaving(true);
       setIsAttending(attending); // Optimistic UI update

        // Construct the document ID
       const attendanceDocId = `${user.uid}_${conferenceId}`;
       const attendanceRef = doc(db, 'attendance', attendanceDocId);


       try {
         if (attending) {
            // Mark as attending, keep existing details or set defaults
            const currentData = attendance || {
                userId: user.uid,
                conferenceId: conferenceId,
                arrivalAirport: null,
                arrivalDateTime: null,
                departureAirport: null,
                departureDateTime: null,
            };
            await setDoc(attendanceRef, { ...currentData, attending: true }, { merge: true });
            setAttendance(prev => ({...(prev || { userId: user.uid, conferenceId: conferenceId }), attending: true}));
            toast({ title: "Attendance Updated", description: "You are marked as attending." });
         } else {
             // Mark as not attending, potentially clear details or just update flag
             // Option 1: Just update the flag
              // await setDoc(attendanceRef, { attending: false }, { merge: true });
             // Option 2: Delete the record (or clear sensitive fields)
              await deleteDoc(attendanceRef); // Let's delete the record
              setAttendance(null);
              // Reset form and hide matches
              setFormState({
                 arrivalAirport: airports[0]?.code ?? '',
                 arrivalDate: undefined,
                 arrivalTime: '',
                 departureAirport: airports[0]?.code ?? '',
                 departureDate: undefined,
                 departureTime: '',
               });
               setShowMatches(false);
              toast({ title: "Attendance Updated", description: "You are marked as not attending." });
         }
          // Re-fetch after change to be sure? Or rely on optimistic update + state management.
         // await fetchAttendance(); // Re-fetch to confirm
       } catch (error) {
         console.error("Error updating attendance:", error);
         toast({ variant: "destructive", title: "Error", description: "Failed to update attendance." });
         setIsAttending(attendance ? false : true); // Revert optimistic update on error
       } finally {
         setIsSaving(false);
       }
     };

   const handleFormChange = (field: keyof typeof formState, value: any) => {
    setFormState(prev => ({ ...prev, [field]: value }));
    setShowMatches(false); // Hide matches when form changes until saved
  };

   const handleSaveDetails = async (event: React.FormEvent) => {
       event.preventDefault();
       if (!user || !conferenceId || !isAttending) return;
       setIsSaving(true);

       const { arrivalAirport, arrivalDate, arrivalTime, departureAirport, departureDate, departureTime } = formState;

       // Combine Date and Time into Timestamps
       const combineDateTime = (date: Date | undefined, time: string): Timestamp | null => {
         if (!date || !time) return null;
         const [hours, minutes] = time.split(':').map(Number);
         if (isNaN(hours) || isNaN(minutes)) return null; // Basic validation
         const combinedDate = new Date(date);
         combinedDate.setHours(hours, minutes, 0, 0); // Set hours and minutes
         return Timestamp.fromDate(combinedDate);
       };

       const arrivalDateTime = combineDateTime(arrivalDate, arrivalTime);
       const departureDateTime = combineDateTime(departureDate, departureTime);


        // Basic validation
       if ((arrivalDate && !arrivalTime) || (!arrivalDate && arrivalTime)) {
            toast({ variant: "destructive", title: "Validation Error", description: "Please provide both arrival date and time, or neither." });
            setIsSaving(false);
            return;
        }
       if ((departureDate && !departureTime) || (!departureDate && departureTime)) {
            toast({ variant: "destructive", title: "Validation Error", description: "Please provide both departure date and time, or neither." });
            setIsSaving(false);
            return;
        }


       const attendanceDocId = `${user.uid}_${conferenceId}`;
       const attendanceRef = doc(db, 'attendance', attendanceDocId);

       const dataToSave: Partial<Attendance> = {
         attending: true, // Ensure attending is true
         arrivalAirport: arrivalAirport || null,
         arrivalDateTime: arrivalDateTime,
         departureAirport: departureAirport || null,
         departureDateTime: departureDateTime,
       };

       try {
         await setDoc(attendanceRef, dataToSave, { merge: true });
         setAttendance(prev => ({ ...(prev || { userId: user.uid, conferenceId: conferenceId }), ...dataToSave } as Attendance));
         toast({ title: "Success", description: "Your flight details have been saved." });
          setShowMatches(true); // Show matches after saving
       } catch (error) {
         console.error("Error saving details:", error);
         toast({ variant: "destructive", title: "Error", description: "Failed to save flight details." });
          setShowMatches(false);
       } finally {
         setIsSaving(false);
       }
     };


     const handleFindRideClick = () => {
         if (attendance && (attendance.arrivalDateTime || attendance.departureDateTime)) {
             setShowMatches(true);
         } else {
             toast({ title: "Enter Details", description: "Please save your arrival or departure details first to find matches."});
         }
     };

  if (loading || authLoading) {
    return (
      <div className="container mx-auto py-12 px-4 md:px-6 flex justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!conference) {
    return ( // Handles case where conference fetch finished but found nothing (already handled by redirect, but good safety check)
        <div className="container mx-auto py-12 px-4 md:px-6">
             <p className="text-center text-muted-foreground">Conference not found.</p>
         </div>
    );
  }

  const canSave = formState.arrivalAirport && formState.arrivalDate && formState.arrivalTime ||
                   formState.departureAirport && formState.departureDate && formState.departureTime;


  return (
    <div className="container mx-auto py-12 px-4 md:px-6 space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl text-primary">{conference.name}</CardTitle>
          <CardDescription className="flex items-center space-x-4 text-md">
            <span><MapPin className="inline-block h-4 w-4 mr-1" />{conference.city}, {conference.state}</span>
            <span><CalendarIcon className="inline-block h-4 w-4 mr-1" />{formatConferenceDate(conference.startDate)} - {formatConferenceDate(conference.endDate)}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-6">Coordinate your airport transportation with other attendees for {conference.name}.</p>

          {!user && (
            <Card className="border-dashed border-primary bg-primary/5 p-4 text-center">
              <p className="text-primary mb-2 font-medium">Please sign in to manage your attendance and find rides.</p>
              {/* Maybe add a sign-in button here? The header one works too. */}
            </Card>
          )}

          {user && isAttending === null && ( // Show loading indicator only when logged in and attendance is loading
              <div className="flex items-center justify-center p-4">
                 <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" /> Loading attendance status...
              </div>
            )}

           {user && isAttending !== null && (
                <div className="space-y-4">
                     <div className="flex items-center space-x-4">
                        <Label className="text-lg">Are you attending?</Label>
                        <div className="flex items-center space-x-2">
                            <Button
                                variant={isAttending ? "default" : "outline"}
                                onClick={() => !isAttending && handleAttendanceChange(true)}
                                disabled={isSaving || isAttending}
                                size="sm"
                            >
                                <CheckCircle className={`mr-2 h-4 w-4 ${isAttending ? '' : 'text-muted-foreground'}`} /> Yes
                            </Button>

                             <AlertDialog>
                                 <AlertDialogTrigger asChild>
                                    <Button
                                        variant={!isAttending ? "destructive" : "outline"}
                                        disabled={isSaving || !isAttending}
                                        size="sm"
                                    >
                                        <XCircle className={`mr-2 h-4 w-4 ${!isAttending ? '' : 'text-muted-foreground'}`} /> No
                                    </Button>
                                 </AlertDialogTrigger>
                                 <AlertDialogContent>
                                    <AlertDialogHeader>
                                    <AlertDialogTitle>Confirm Attendance Change</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Marking yourself as not attending will remove your saved flight details and ride matches for this conference. Are you sure?
                                    </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleAttendanceChange(false)} className={Button({ variant: "destructive" })}>
                                        Yes, Not Attending
                                    </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>


                            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                        </div>
                     </div>

                    {isAttending && (
                        <Card className="bg-secondary/50 p-6">
                             <form onSubmit={handleSaveDetails} className="space-y-6">
                                <h3 className="text-xl font-semibold mb-4 text-primary">Your Flight Details</h3>
                                {/* Arrival Details */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                                    <div>
                                        <Label htmlFor="arrival-airport">Arrival Airport</Label>
                                         <Select
                                             value={formState.arrivalAirport}
                                             onValueChange={(value) => handleFormChange('arrivalAirport', value)}
                                         >
                                             <SelectTrigger id="arrival-airport">
                                                 <SelectValue placeholder="Select airport" />
                                             </SelectTrigger>
                                             <SelectContent>
                                                 {airports.map(ap => (
                                                    <SelectItem key={ap.code} value={ap.code}>{ap.code} - {ap.name}</SelectItem>
                                                 ))}
                                            </SelectContent>
                                         </Select>
                                     </div>
                                     <div>
                                         <Label htmlFor="arrival-date">Arrival Date</Label>
                                         <Popover>
                                             <PopoverTrigger asChild>
                                                 <Button
                                                    id="arrival-date"
                                                    variant={"outline"}
                                                    className="w-full justify-start text-left font-normal"
                                                >
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {formState.arrivalDate ? format(formState.arrivalDate, "PPP") : <span>Pick a date</span>}
                                                </Button>
                                             </PopoverTrigger>
                                             <PopoverContent className="w-auto p-0">
                                                 <Calendar
                                                     mode="single"
                                                     selected={formState.arrivalDate}
                                                     onSelect={(date) => handleFormChange('arrivalDate', date)}
                                                     initialFocus
                                                     // Disable dates outside conference range? (Optional)
                                                     // fromDate={conference.startDate.toDate()}
                                                     // toDate={conference.endDate.toDate()}
                                                 />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                     <div>
                                         <Label htmlFor="arrival-time">Arrival Time</Label>
                                         <Input
                                             id="arrival-time"
                                             type="time"
                                             value={formState.arrivalTime}
                                             onChange={(e) => handleFormChange('arrivalTime', e.target.value)}
                                         />
                                     </div>
                                </div>

                                {/* Departure Details */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                                     <div>
                                         <Label htmlFor="departure-airport">Departure Airport</Label>
                                          <Select
                                             value={formState.departureAirport}
                                             onValueChange={(value) => handleFormChange('departureAirport', value)}
                                         >
                                             <SelectTrigger id="departure-airport">
                                                 <SelectValue placeholder="Select airport" />
                                             </SelectTrigger>
                                             <SelectContent>
                                                  {airports.map(ap => (
                                                    <SelectItem key={ap.code} value={ap.code}>{ap.code} - {ap.name}</SelectItem>
                                                 ))}
                                            </SelectContent>
                                         </Select>
                                     </div>
                                     <div>
                                         <Label htmlFor="departure-date">Departure Date</Label>
                                          <Popover>
                                             <PopoverTrigger asChild>
                                                 <Button
                                                    id="departure-date"
                                                    variant={"outline"}
                                                    className="w-full justify-start text-left font-normal"
                                                 >
                                                     <CalendarIcon className="mr-2 h-4 w-4" />
                                                     {formState.departureDate ? format(formState.departureDate, "PPP") : <span>Pick a date</span>}
                                                 </Button>
                                             </PopoverTrigger>
                                             <PopoverContent className="w-auto p-0">
                                                 <Calendar
                                                     mode="single"
                                                     selected={formState.departureDate}
                                                     onSelect={(date) => handleFormChange('departureDate', date)}
                                                     initialFocus
                                                      // fromDate={conference.startDate.toDate()}
                                                      // toDate={conference.endDate.toDate()} // Allow departure after end date?
                                                 />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <div>
                                        <Label htmlFor="departure-time">Departure Time</Label>
                                         <Input
                                             id="departure-time"
                                             type="time"
                                             value={formState.departureTime}
                                             onChange={(e) => handleFormChange('departureTime', e.target.value)}
                                         />
                                    </div>
                                </div>

                                <Button type="submit" disabled={isSaving || !canSave} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Save Details
                                 </Button>
                             </form>
                         </Card>
                    )}
                </div>
            )}
        </CardContent>
        {/* Add a footer for consistency or actions if needed */}
         {/* <CardFooter>
           <p>Footer content if needed</p>
         </CardFooter> */}
      </Card>

       {/* Ride Matching Section - Conditionally rendered */}
       {user && isAttending && (
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="text-2xl text-primary">Find a Ride</CardTitle>
                    <CardDescription>
                         {showMatches
                             ? "See who's travelling around the same time as you."
                             : "Save your flight details to view potential ride matches."}
                     </CardDescription>
                </CardHeader>
                 <CardContent>
                    {!showMatches && (
                        <div className="text-center">
                            <Button onClick={handleFindRideClick} disabled={!canSave}>
                                <Car className="mr-2 h-4 w-4"/> View Potential Matches
                            </Button>
                            {!canSave && <p className="text-sm text-muted-foreground mt-2">Enter and save at least one flight detail first.</p>}
                        </div>
                    )}
                     {showMatches && attendance && conferenceId && user && (
                         <RideMatches
                             conferenceId={conferenceId}
                             currentUserAttendance={attendance}
                             currentUserId={user.uid}
                          />
                    )}
                 </CardContent>
            </Card>
        )}

    </div>
  );
}
