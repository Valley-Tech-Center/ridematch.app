"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/auth-context';
import { Chrome, Mail, CheckCircle2, XCircle } from 'lucide-react'; // Added CheckCircle2, XCircle
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MIN_PASSWORD_LENGTH = 12;

const Requirement = ({ valid, text }: { valid: boolean; text: string }) => (
  <div className={`flex items-center text-sm ${valid ? 'text-green-500' : 'text-red-500'}`}>
    {valid ? <CheckCircle2 className="mr-2 h-4 w-4 flex-shrink-0" /> : <XCircle className="mr-2 h-4 w-4 flex-shrink-0" />}
    {text}
  </div>
);

export function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
  const { signIn, signUpWithEmail, signInWithGoogle, loading, error } = useAuth();
  const [isSignUp, setIsSignUp] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const { toast } = useToast();

  const [passwordCriteria, setPasswordCriteria] = React.useState({
    uppercase: false,
    lowercase: false,
    specialChar: false,
    numeric: false,
    minLength: false,
  });
  const [passwordFocused, setPasswordFocused] = React.useState(false);

  React.useEffect(() => {
    if (error) {
       toast({
          variant: "destructive",
          title: "Authentication Error",
          description: error,
        });
    }
   }, [error, toast]);

  React.useEffect(() => {
    setPasswordCriteria({
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      specialChar: /[!@#$%^&*()_+\-=\[\]{};':"\|,.<>\/?]+/.test(password),
      numeric: /[0-9]/.test(password),
      minLength: password.length >= MIN_PASSWORD_LENGTH,
    });
  }, [password]);

  const allPasswordCriteriaMet = Object.values(passwordCriteria).every(Boolean);

  const resetPasswordValidation = () => {
    setPasswordCriteria({
        uppercase: false,
        lowercase: false,
        specialChar: false,
        numeric: false,
        minLength: false,
    });
    setPasswordFocused(false);
  };

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
      if (!allPasswordCriteriaMet) {
        toast({
          variant: "destructive",
          title: "Sign Up Error",
          description: "Password does not meet all requirements.",
        });
        setPasswordFocused(true); // Keep requirements visible
        return;
      }
      await signUpWithEmail(email, password);
    } else {
      await signIn(email, password);
    }
    if (!error && !loading) { // Check error and loading again after await
        onOpenChange(false);
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setIsSignUp(false);
        resetPasswordValidation();
    }
  };

  const handleGoogleSignIn = async () => {
    await signInWithGoogle();
    if (!error && !loading) { // Check error and loading again after await
        onOpenChange(false);
    }
  }

   const toggleAuthMode = () => {
    setIsSignUp(!isSignUp);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    resetPasswordValidation();
    // Clear any existing auth errors when toggling mode
    // This would require a clearError function in useAuth context if we want to clear context error state too
  };


  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
        onOpenChange(isOpen);
        if (!isOpen) { // Reset state if dialog is closed externally
            setEmail('');
            setPassword('');
            setConfirmPassword('');
            setIsSignUp(false);
            resetPasswordValidation();
        }
    }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isSignUp ? 'Create Account' : 'Sign In'}</DialogTitle>
          <DialogDescription>
            {isSignUp ? 'Enter your details to create a new account.' : 'Sign in to access ride coordination features.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
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
                    onFocus={() => setPasswordFocused(true)}
                    disabled={loading}
                 />
            </div>
            {isSignUp && (passwordFocused || password.length > 0) && (
              <div className="mt-1 mb-2 space-y-1 px-1">
                <Requirement valid={passwordCriteria.minLength} text={`At least ${MIN_PASSWORD_LENGTH} characters`} />
                <Requirement valid={passwordCriteria.uppercase} text="An uppercase letter" />
                <Requirement valid={passwordCriteria.lowercase} text="A lowercase letter" />
                <Requirement valid={passwordCriteria.numeric} text="A number" />
                <Requirement valid={passwordCriteria.specialChar} text="A special character (e.g., !@#$%)" />
              </div>
            )}
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
            <Button 
              type="submit" 
              disabled={loading || (isSignUp && (!allPasswordCriteriaMet || password !== confirmPassword || !email))}
            >
                <Mail className="mr-2 h-4 w-4" /> {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}
            </Button>
          </form>
        </div>
         <DialogFooter className="sm:justify-center">
           <Button variant="link" onClick={toggleAuthMode} disabled={loading}>
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
