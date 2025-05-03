"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  getAuth,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  User,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  AuthError
} from 'firebase/auth';
import { firebaseApp } from '@/lib/firebase/config'; // Ensure you have Firebase initialized
import { doc, setDoc, getFirestore, serverTimestamp } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast"; // Import useToast

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const auth = getAuth(firebaseApp);
  const db = getFirestore(firebaseApp);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);
       if (currentUser) {
         // Optionally sync user data to Firestore here if needed on every auth state change
         // await syncUserData(currentUser);
       }
    });
    return () => unsubscribe();
  }, [auth]);

  // Function to sync user data to Firestore 'users' collection
  const syncUserData = async (userData: User) => {
     if (!userData) return;
     const userRef = doc(db, 'users', userData.uid);
     try {
       await setDoc(userRef, {
         uid: userData.uid,
         email: userData.email,
         displayName: userData.displayName,
         photoURL: userData.photoURL,
         lastLogin: serverTimestamp(),
         createdAt: serverTimestamp(), // Set createdAt only if creating new doc (use merge: true?)
       }, { merge: true }); // Use merge to avoid overwriting existing fields if syncing later
       console.log("User data synced to Firestore");
     } catch (err) {
       console.error("Error syncing user data to Firestore:", err);
       setError("Failed to save user profile.");
       toast({
         variant: "destructive",
         title: "Profile Error",
         description: "Could not save user profile information.",
       });
     }
   };

  const handleAuthError = (err: unknown) => {
     console.error("Authentication error:", err);
      let message = "An unknown authentication error occurred.";
      if (err instanceof Error) {
          // Check for specific Firebase error codes
          const errorCode = (err as AuthError).code;
          switch (errorCode) {
              case 'auth/user-not-found':
                  message = "No user found with this email.";
                  break;
              case 'auth/wrong-password':
                  message = "Incorrect password.";
                  break;
              case 'auth/email-already-in-use':
                  message = "This email is already registered.";
                  break;
              case 'auth/weak-password':
                  message = "Password is too weak. It should be at least 6 characters.";
                  break;
               case 'auth/popup-closed-by-user':
                  message = "Sign-in process cancelled.";
                  break;
               case 'auth/cancelled-popup-request':
                   message = "Sign-in process cancelled.";
                  break;
               case 'auth/popup-blocked':
                  message = "Sign-in popup was blocked by the browser. Please allow popups for this site.";
                  break;
              default:
                  message = err.message || message;
          }
      }
      setError(message);
      setLoading(false);
      // Do not show toast here, let the component using the context decide or show error inline
      // toast({ variant: "destructive", title: "Authentication Failed", description: message });
  }

  const signIn = async (email: string, pass: string) => {
    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      // User data will be synced via onAuthStateChanged listener
      setLoading(false);
    } catch (err) {
        handleAuthError(err);
    }
  };

  const signUpWithEmail = async (email: string, pass: string) => {
    setLoading(true);
    setError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      await syncUserData(userCredential.user); // Sync immediately after creation
      setLoading(false);
       toast({
        title: "Account Created",
        description: "Welcome! Your account has been successfully created.",
      });
    } catch (err) {
      handleAuthError(err);
    }
  };

  const signInWithGoogle = async () => {
    setLoading(true);
    setError(null);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      await syncUserData(result.user); // Sync after Google sign-in/up
      setLoading(false);
    } catch (err) {
      handleAuthError(err);
    }
  };


  const signOut = async () => {
    setLoading(true);
    setError(null);
    try {
      await firebaseSignOut(auth);
      setUser(null); // Explicitly set user to null
      setLoading(false);
      toast({
          title: "Signed Out",
          description: "You have been successfully signed out.",
        });
    } catch (err) {
      console.error("Sign out error:", err);
      setError(err instanceof Error ? err.message : "Failed to sign out.");
      setLoading(false);
       toast({
        variant: "destructive",
        title: "Sign Out Error",
        description: "Could not sign you out.",
      });
    }
  };

  const value = {
    user,
    loading,
    error,
    signIn,
    signUpWithEmail,
    signInWithGoogle,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
