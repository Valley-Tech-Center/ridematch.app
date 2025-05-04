import type { Timestamp } from 'firebase/firestore';

/**
 * Represents an airport, potentially embedded within an Event or fetched separately.
 */
export interface Airport {
  code: string; // e.g., "SFO"
  name: string; // e.g., "San Francisco International Airport"
  city: string; // e.g., "San Francisco"
  // Potentially add country, coordinates, etc.
}

/**
 * Represents an event document in Firestore.
 */
export interface Event {
  id: string;
  name: string;
  location: string; // Consider splitting into city, state if needed for filtering
  city: string;
  state: string;
  startDate: Timestamp;
  endDate: Timestamp;
  description?: string; // Optional description
  airports: Airport[]; // Array of relevant airports for the event's city
  // Potentially add aggregated counts later if needed for performance
  // attendeeCount?: number;
  // rideMatchCount?: number;
}

/**
 * Represents an attendee's record for a specific event in Firestore,
 * stored likely under `events/{eventId}/attendees/{userId}`.
 */
export interface Attendance {
  userId: string;
  eventId: string; // Often implicitly known from the path, but good to have
  userName?: string | null; // Denormalized for easier display
  userPhotoURL?: string | null; // Denormalized
  attending: boolean; // Explicitly track if they are attending or not
  arrivalAirport?: string | null;
  arrivalDateTime?: Timestamp | null;
  departureAirport?: string | null;
  departureDateTime?: Timestamp | null;
  updatedAt: Timestamp; // Track when the record was last updated
  // Add other relevant fields as needed, e.g., notes, contact preferences
}

/**
 * Represents user profile data, likely stored in a top-level `users` collection.
 */
export interface UserProfile {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  // Add any other profile information you want to store
  createdAt?: Timestamp;
  lastLogin?: Timestamp;
}

/**
 * Represents a notification for a ride request.
 * Likely stored in a `notifications` collection.
 */
export interface RideNotification {
  id?: string; // Firestore document ID
  senderId: string;
  recipientId: string;
  eventId: string;
  type: 'arrival' | 'departure'; // Match type
  senderArrivalDateTime?: Timestamp | null;
  senderDepartureDateTime?: Timestamp | null;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Timestamp;
  read: boolean; // Whether the recipient has read the notification
}