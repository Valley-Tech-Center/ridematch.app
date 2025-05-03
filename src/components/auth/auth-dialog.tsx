"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter, // Added DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/auth-context';
import { Chrome, Mail } from 'lucide-react'; // Using Chrome icon for Google
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
  const { signIn, signUpWithEmail, signInWithGoogle, loading, error } = useAuth();
  const [isSignUp, setIsSignUp] = React.useState(false); // State to toggle between sign in and sign up
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const { toast } = useToast();

  React.useEffect(() => {
    if (error) {
       toast({
          variant: "destructive",
          title: "Authentication Error",
          description: error,
        });
    }
   }, [error, toast]);

  const handleEmailAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSignUp) {
      if (password !== confirmPassword) {
         toast({
            variant: "destructive",
            title: "Sign Up Error",
            description: "Passwords do not match.",
          });
        return;
      }
      await signUpWithEmail(email, password);
    } else {
      await signIn(email, password);
    }
    // Close dialog on successful auth (or handle error)
    if (!error && !loading) {
        onOpenChange(false);
        // Reset form
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setIsSignUp(false);
    }
  };

  const handleGoogleSignIn = async () => {
    await signInWithGoogle();
     // Close dialog on successful auth (or handle error)
    if (!error && !loading) {
        onOpenChange(false);
    }
  }

   const toggleAuthMode = () => {
    setIsSignUp(!isSignUp);
    // Reset fields when toggling
    setEmail('');
    setPassword('');
    setConfirmPassword('');
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isSignUp ? 'Create Account' : 'Sign In'}</DialogTitle>
          <DialogDescription>
            {isSignUp ? 'Enter your details to create a new account.' : 'Sign in to access ride coordination features.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
           {/* Google Sign In */}
          <Button variant="outline" onClick={handleGoogleSignIn} disabled={loading}>
             <Chrome className="mr-2 h-4 w-4" /> {isSignUp ? 'Sign up with Google' : 'Sign in with Google'}
          </Button>

           <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

           {/* Email/Password Form */}
          <form onSubmit={handleEmailAuth} className="grid gap-4">
            <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                    id="email"
                    type="email"
                    placeholder="m@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                 />
            </div>
             <div className="grid gap-2">
                 <Label htmlFor="password">Password</Label>
                 <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                 />
            </div>
            {isSignUp && (
              <div className="grid gap-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
            )}
            <Button type="submit" disabled={loading}>
                <Mail className="mr-2 h-4 w-4" /> {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}
            </Button>
          </form>
        </div>
         <DialogFooter className="sm:justify-center">
           <Button variant="link" onClick={toggleAuthMode}>
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
