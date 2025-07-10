function About() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">About Revere</h1>
      
      <div className="space-y-8">
        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Our Mission</h2>
          <p className="text-gray-600">
            Revere is dedicated to providing real-time sports data and analytics to fans, teams, and organizations.
            Our platform delivers accurate, up-to-the-minute information about matches, teams, and player statistics.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">What We Offer</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Real-time Updates</h3>
              <p className="text-gray-600">
                Stay informed with live match updates and instant notifications about your favorite teams.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Advanced Analytics</h3>
              <p className="text-gray-600">
                Access detailed statistics and performance metrics to gain deeper insights.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Contact Us</h2>
          <p className="text-gray-600">
            Have questions or feedback? We'd love to hear from you. Reach out to our team at{' '}
            <a href="mailto:contact@revere.com" className="text-primary-600 hover:text-primary-500">
              contact@revere.com
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}

export default About; 