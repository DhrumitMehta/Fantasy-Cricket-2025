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
    <div className="min-h-screen bg-[#1a1c2e]">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header Section */}
        <div className="mb-12">
          <Link
            href="/"
            className="text-[#4ade80] hover:text-[#22c55e] transition-colors inline-flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Home
          </Link>
        </div>

        <div className="max-w-2xl mx-auto">
          {/* Title Section */}
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold text-white mb-3">Join the Cricket Fantasy League</h1>
            <p className="text-gray-400">
              Create your account and start building your dream team today
            </p>
          </div>

          {/* Alert Messages */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-[#4ade80]/10 border border-[#4ade80]/20 text-[#4ade80] px-4 py-3 rounded-lg mb-6">
              Registration successful! Please check your email to confirm your account.
            </div>
          )}

          {/* Registration Form */}
          <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-8 border border-white/10">
            <form onSubmit={handleSignUp} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Email */}
                <div className="md:col-span-2">
                  <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:ring-2 focus:ring-[#4ade80] focus:border-transparent transition-all"
                    placeholder="Enter your email"
                  />
                </div>

                {/* Full Name */}
                <div>
                  <label
                    htmlFor="fullName"
                    className="block text-sm font-medium text-gray-300 mb-2"
                  >
                    Full Name
                  </label>
                  <input
                    type="text"
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:ring-2 focus:ring-[#4ade80] focus:border-transparent transition-all"
                    placeholder="John Doe"
                  />
                </div>

                {/* Team Name */}
                <div>
                  <label
                    htmlFor="username"
                    className="block text-sm font-medium text-gray-300 mb-2"
                  >
                    Team Name
                  </label>
                  <input
                    type="text"
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:ring-2 focus:ring-[#4ade80] focus:border-transparent transition-all"
                    placeholder="Your team name"
                  />
                </div>

                {/* Country */}
                <div>
                  <label htmlFor="country" className="block text-sm font-medium text-gray-300 mb-2">
                    Country
                  </label>
                  <select
                    id="country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:ring-2 focus:ring-[#4ade80] focus:border-transparent transition-all"
                  >
                    <option value="" className="bg-[#1a1c2e]">
                      Select your country
                    </option>
                    {countries.map((country) => (
                      <option key={country} value={country} className="bg-[#1a1c2e]">
                        {country}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Favorite Team */}
                <div>
                  <label
                    htmlFor="favoriteTeam"
                    className="block text-sm font-medium text-gray-300 mb-2"
                  >
                    Favorite Team
                  </label>
                  <select
                    id="favoriteTeam"
                    value={favoriteTeam}
                    onChange={(e) => setFavoriteTeam(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:ring-2 focus:ring-[#4ade80] focus:border-transparent transition-all"
                  >
                    <option value="" className="bg-[#1a1c2e]">
                      Select favorite team
                    </option>
                    {cricketTeams.map((team) => (
                      <option key={team} value={team} className="bg-[#1a1c2e]">
                        {team}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Password */}
                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-gray-300 mb-2"
                  >
                    Password
                  </label>
                  <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:ring-2 focus:ring-[#4ade80] focus:border-transparent transition-all"
                    placeholder="••••••••"
                  />
                </div>

                {/* Confirm Password */}
                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-medium text-gray-300 mb-2"
                  >
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:ring-2 focus:ring-[#4ade80] focus:border-transparent transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#4ade80] hover:bg-[#22c55e] text-gray-900 font-medium py-3 rounded-lg transition-all transform hover:scale-105 disabled:opacity-50"
              >
                {loading ? "Creating Account..." : "Create Account"}
              </button>
            </form>

            {/* Social Sign Up */}
            <div className="mt-8">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-[#1a1c2e] text-gray-400">or continue with</span>
                </div>
              </div>

              <div className="mt-6">
                <button
                  onClick={() => handleSocialSignUp("google")}
                  disabled={loading}
                  className="w-full flex items-center justify-center px-4 py-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all text-white"
                >
                  <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Continue with Google
                </button>
              </div>
            </div>

            {/* Sign In Link */}
            <p className="text-center mt-8 text-gray-400">
              Already have an account?{" "}
              <Link href="/" className="text-[#4ade80] hover:text-[#22c55e] transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
