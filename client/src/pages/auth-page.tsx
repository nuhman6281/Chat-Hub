import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthWrapper';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2 } from 'lucide-react';

// Login form schema
const loginSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

// Registration form schema
const registerSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  displayName: z.string().min(2, 'Display name must be at least 2 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(6, 'Password must be at least 6 characters'),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState('login');
  const [, navigate] = useLocation();
  const { user, loginMutation, registerMutation } = useAuth();

  // Redirect if user is already logged in
  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  // Login form
  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  // Register form
  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: '',
      displayName: '',
      password: '',
      confirmPassword: '',
    },
  });

  // Handle login form submission
  const onLoginSubmit = (values: LoginFormValues) => {
    loginMutation.mutate(values, {
      onSuccess: () => {
        navigate('/');
      },
    });
  };

  // Handle registration form submission
  const onRegisterSubmit = (values: RegisterFormValues) => {
    const { confirmPassword, ...registrationData } = values;
    registerMutation.mutate(registrationData, {
      onSuccess: () => {
        navigate('/');
      },
    });
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left Column - Forms */}
      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">Welcome to ChatHub</CardTitle>
            <CardDescription className="text-center">
              Sign in to your account or create a new one to get started.
            </CardDescription>
          </CardHeader>
          <Tabs
            defaultValue="login"
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>
            
            {/* Login Form */}
            <TabsContent value="login">
              <CardContent className="pt-4">
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                    <FormField
                      control={loginForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter your username" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={loginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Enter your password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={loginMutation.isPending}
                    >
                      {loginMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Logging in...
                        </>
                      ) : (
                        'Login'
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
              <CardFooter>
                <div className="text-sm text-muted-foreground w-full text-center">
                  Don't have an account?{' '}
                  <Button 
                    variant="link" 
                    className="p-0" 
                    onClick={() => setActiveTab('register')}
                  >
                    Sign up now
                  </Button>
                </div>
              </CardFooter>
            </TabsContent>
            
            {/* Register Form */}
            <TabsContent value="register">
              <CardContent className="pt-4">
                <Form {...registerForm}>
                  <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                    <FormField
                      control={registerForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input placeholder="Choose a username" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="displayName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Display Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter your display name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Choose a password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Confirm your password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={registerMutation.isPending}
                    >
                      {registerMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating account...
                        </>
                      ) : (
                        'Create Account'
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
              <CardFooter>
                <div className="text-sm text-muted-foreground w-full text-center">
                  Already have an account?{' '}
                  <Button 
                    variant="link" 
                    className="p-0" 
                    onClick={() => setActiveTab('login')}
                  >
                    Sign in
                  </Button>
                </div>
              </CardFooter>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
      
      {/* Right Column - Hero Section */}
      <div className="flex-1 bg-gradient-to-r from-primary/90 to-primary-foreground p-6 flex flex-col justify-center items-center text-white">
        <div className="max-w-md">
          <h1 className="text-4xl font-bold mb-6">Connect with your team in real time.</h1>
          <p className="text-lg mb-6">
            ChatHub brings together messaging, voice/video calls, and community features in one seamless application.
          </p>
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="flex flex-col">
              <div className="text-2xl font-bold">Messaging</div>
              <p>Real-time text communication with history and search.</p>
            </div>
            <div className="flex flex-col">
              <div className="text-2xl font-bold">Voice & Video</div>
              <p>High-quality calls between team members.</p>
            </div>
            <div className="flex flex-col">
              <div className="text-2xl font-bold">Communities</div>
              <p>Create and join channels for different topics.</p>
            </div>
            <div className="flex flex-col">
              <div className="text-2xl font-bold">Cross-Platform</div>
              <p>Works on web, desktop, and mobile devices.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}