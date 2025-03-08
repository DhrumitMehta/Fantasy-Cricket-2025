"use client";

import Link from "next/link";
import { useState, FormEvent } from "react";
import { createClient, AuthError, Provider } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// List of countries for dropdown
const countries = [
  "Afghanistan",
  "Australia",
  "Bangladesh",
  "England",
  "India",
  "Ireland",
  "New Zealand",
  "Pakistan",
  "South Africa",
  "Sri Lanka",
  "West Indies",
  "Zimbabwe",
  // Add more countries as needed
];

// Available cricket teams
const cricketTeams = [
  "Chennai Super Kings",
  "Delhi Capitals",
  "Gujarat Titans",
  "Kolkata Knight Riders",
  "Lucknow Super Giants",
  "Mumbai Indians",
  "Punjab Kings",
  "Rajasthan Royals",
  "Royal Challengers Bangalore",
  "Sunrisers Hyderabad",
  // Add or modify teams as needed
];

export default function Register() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState(""); // Will be used as team name
  const [country, setCountry] = useState("");
  const [favoriteTeam, setFavoriteTeam] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Sign up with email and password
  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    // Validate passwords match
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      setLoading(false);
      return;
    }

    // Validate all fields are filled
    if (!email || !fullName || !username || !country || !favoriteTeam || !password) {
      setError("Please fill in all fields");
      setLoading(false);
      return;
    }

    try {
      // First sign up the user with Supabase Auth
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            full_name: fullName,
            username: username,
            country: country,
            favorite_team: favoriteTeam,
          },
        },
      });

      if (signUpError) throw signUpError;

      // If signup is successful and we have a user ID, update the profile
      if (data.user) {
        // Use upsert operation (update if exists, insert if not)
        const { error: profileError } = await supabase.from("profiles").upsert(
          [
            {
              id: data.user.id, // This is the primary key
              full_name: fullName,
              username: username,
              country: country,
              favorite_team: favoriteTeam,
              updated_at: new Date().toISOString(),
            },
          ],
          {
            onConflict: "id", // Specify the conflict column
            ignoreDuplicates: false, // Update the record if there's a conflict
          }
        );

        if (profileError) {
          console.error("Profile update error:", profileError);
          throw profileError;
        }
      }

      setSuccess(true);
    } catch (error) {
      console.error("Registration error:", error);
      setError(error instanceof Error ? error.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Sign up with third-party providers
  const handleSocialSignUp = async (provider: Provider) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;

      // Note: For social logins, you'll need to handle profile creation
      // in the callback page since we don't have access to the user data yet
    } catch (error) {
      if (error instanceof AuthError) {
        setError(error.message);
      } else {
        setError("An unexpected error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <Link href="/" className="text-blue-500 hover:underline mb-6 block">
        ← Back to Home
      </Link>

      <h1 className="text-2xl font-bold mb-6">Register for Fantasy Cricket</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4">
          Registration successful! Please check your email to confirm your account.
        </div>
      )}

      <form onSubmit={handleSignUp} className="space-y-4 mb-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1">
            Email
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
            required
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="fullName" className="block text-sm font-medium mb-1">
            Full Name
          </label>
          <input
            type="text"
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your full name"
          />
        </div>

        <div>
          <label htmlFor="username" className="block text-sm font-medium mb-1">
            Team Name (Username)
          </label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
            required
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="This will be your team's name in leagues"
          />
        </div>

        <div>
          <label htmlFor="country" className="block text-sm font-medium mb-1">
            Country
          </label>
          <select
            id="country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            required
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select your country</option>
            {countries.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="favoriteTeam" className="block text-sm font-medium mb-1">
            Favorite Team
          </label>
          <select
            id="favoriteTeam"
            value={favoriteTeam}
            onChange={(e) => setFavoriteTeam(e.target.value)}
            required
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select your favorite team</option>
            {cricketTeams.map((team) => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1">
            Password
          </label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
            required
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1">
            Confirm Password
          </label>
          <input
            type="password"
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setConfirmPassword(e.target.value)
            }
            required
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-cyan-400 text-black py-2 rounded font-medium disabled:opacity-50"
        >
          {loading ? "Creating Account..." : "Create Account"}
        </button>
      </form>

      <div className="text-center">
        <p className="text-sm mb-4">or register with</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleSocialSignUp("google")}
            disabled={loading}
            className="bg-white border py-2 rounded flex items-center justify-center disabled:opacity-50"
          >
            <span className="mr-2">G</span> Google
          </button>
          <button
            onClick={() => handleSocialSignUp("facebook")}
            disabled={loading}
            className="bg-blue-600 text-white py-2 rounded flex items-center justify-center disabled:opacity-50"
          >
            <span className="mr-2">f</span> Facebook
          </button>
        </div>
      </div>

      <p className="text-center mt-6">
        Already have an account?{" "}
        <Link href="/" className="text-blue-500 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
