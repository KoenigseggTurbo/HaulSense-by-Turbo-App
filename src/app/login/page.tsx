'use client';

import { useState, useEffect } from 'react';
import { useAuth, useUser, initiateEmailSignIn, initiateEmailSignUp, initiatePasswordReset, initiateAnonymousSignIn } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Lock, UserPlus, LogIn, ChevronLeft, Loader2, Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';

type AuthMode = 'signin' | 'signup' | 'reset';

export default function LoginPage() {
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isUserLoading && user && !user.isAnonymous) {
      router.push('/');
    }
  }, [user, isUserLoading, router]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;

    setIsLoading(true);
    try {
      if (mode === 'signin') {
        await initiateEmailSignIn(auth, email, password);
        toast({ title: "Welcome back!", description: "You have signed in successfully." });
      } else if (mode === 'signup') {
        await initiateEmailSignUp(auth, email, password);
        toast({ title: "Account created!", description: "Welcome to HaulSense By Turbo." });
      } else if (mode === 'reset') {
        await initiatePasswordReset(auth, email);
        toast({ title: "Email sent!", description: "Check your inbox for password reset instructions." });
        setMode('signin');
      }
    } catch (error: any) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: error.message || "An unexpected error occurred."
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestSignIn = () => {
    if (auth) initiateAnonymousSignIn(auth);
    router.push('/');
  };

  if (isUserLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 sm:p-6 lg:p-8">
      <Card className="w-full max-w-md border-border/50 shadow-2xl bg-card/50 backdrop-blur-sm">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="relative h-24 w-48 overflow-hidden rounded-xl bg-white shadow-lg shadow-black/10 border border-slate-100 flex items-center justify-center">
              <Image 
                src="/logo.png" 
                alt="HaulSense By Turbo Logo" 
                fill 
                sizes="192px"
                unoptimized
                className="object-cover w-full h-full"
                data-ai-hint="truck logo"
              />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-black tracking-tight font-headline">HaulSense By Turbo</CardTitle>
            <CardDescription className="text-muted-foreground mt-2">
              {mode === 'signin' && "Sign in to your owner-operator portal."}
              {mode === 'signup' && "Create your professional load tracking account."}
              {mode === 'reset' && "Recover your password."}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  className="pl-10 h-11"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            {mode !== 'reset' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {mode === 'signin' && (
                    <Button 
                      variant="link" 
                      className="px-0 h-auto text-xs font-semibold text-primary" 
                      type="button"
                      onClick={() => setMode('reset')}
                    >
                      Forgot?
                    </Button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="pl-10 pr-10 h-11"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                    <span className="sr-only">
                      {showPassword ? "Hide password" : "Show password"}
                    </span>
                  </button>
                </div>
              </div>
            )}

            <Button className="w-full h-11 font-bold text-lg" type="submit" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <>
                  {mode === 'signin' && <LogIn className="mr-2 h-5 w-5" />}
                  {mode === 'signup' && <UserPlus className="mr-2 h-5 w-5" />}
                  {mode === 'reset' && "Send Reset Link"}
                  {mode === 'signin' ? "Sign In" : mode === 'signup' ? "Create Account" : ""}
                </>
              )}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          <Button 
            variant="outline" 
            className="w-full h-11 font-semibold border-border/50 hover:bg-muted/50" 
            onClick={handleGuestSignIn}
          >
            Continue as Guest
          </Button>
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          <div className="text-center text-sm">
            {mode === 'signin' ? (
              <p className="text-muted-foreground">
                Don't have an account?{" "}
                <Button variant="link" className="px-1 h-auto font-bold text-primary" onClick={() => setMode('signup')}>
                  Sign Up
                </Button>
              </p>
            ) : (
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-muted-foreground hover:text-primary" 
                onClick={() => setMode('signin')}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Back to Sign In
              </Button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            By using HaulSense By Turbo, you agree to our Terms and Privacy Policy.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
