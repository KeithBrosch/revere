function Home() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold text-gray-900 mb-6">
        Welcome to Revere
      </h1>
      <p className="text-lg text-gray-600 mb-8">
        Your real-time sports data platform. Track teams, matches, and stay updated with the latest information.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Latest Updates
          </h2>
          <p className="text-gray-600">
            Stay informed with real-time updates about your favorite teams and matches.
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Quick Stats
          </h2>
          <p className="text-gray-600">
            Access key statistics and performance metrics at a glance.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Home; 