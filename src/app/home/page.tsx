import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-slate-700">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-[800px] mx-auto bg-white/95 backdrop-blur-lg rounded-2xl py-16 px-8 shadow-2xl">
          <h1 className="text-5xl font-bold mb-8 text-center text-blue-600">Fantasy Cricket</h1>

          <p className="text-slate-700 text-center mb-12 text-lg">
            Build your dream team and compete with players worldwide
          </p>

          <nav className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <Link
              href="/my-team"
              className="group p-6 bg-gradient-to-br from-white to-slate-50 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg border border-slate-100"
            >
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-blue-600 rounded-lg shadow-md">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-blue-600">My Team</h2>
                  <p className="text-slate-600">Manage your squad</p>
                </div>
              </div>
            </Link>

            <Link
              href="/transfer-market"
              className="group p-6 bg-gradient-to-br from-white to-slate-50 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg border border-slate-100"
            >
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-blue-600 rounded-lg shadow-md">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-blue-600">Transfer Market</h2>
                  <p className="text-slate-600">Buy & sell players</p>
                </div>
              </div>
            </Link>

            <Link
              href="/leagues"
              className="group p-6 bg-gradient-to-br from-white to-slate-50 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg border border-slate-100"
            >
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-blue-600 rounded-lg shadow-md">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-blue-600">Leagues</h2>
                  <p className="text-slate-600">Join competitions</p>
                </div>
              </div>
            </Link>

            <Link
              href="/leaderboard"
              className="group p-6 bg-gradient-to-br from-white to-slate-50 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg border border-slate-100"
            >
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-blue-600 rounded-lg shadow-md">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-blue-600">Leaderboard</h2>
                  <p className="text-slate-600">Check rankings</p>
                </div>
              </div>
            </Link>
          </nav>
        </div>
      </div>
    </div>
  );
}
