import { useState, useEffect } from 'react';
import { Team, teamsApi } from '../services/api';

function Teams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [subscribedTeams, setSubscribedTeams] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [teamsData, subscribedTeamsData] = await Promise.all([
          teamsApi.getTeams(),
          teamsApi.getSubscribedTeams()
        ]);
        setTeams(teamsData);
        setSubscribedTeams(new Set(subscribedTeamsData));
      } catch (err) {
        setError('Failed to load teams data. Please try again later.');
        console.error('Error fetching teams:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const toggleSubscription = async (teamId: string) => {
    try {
      if (subscribedTeams.has(teamId)) {
        await teamsApi.unsubscribeFromTeam(teamId);
        setSubscribedTeams(prev => {
          const newSet = new Set(prev);
          newSet.delete(teamId);
          return newSet;
        });
      } else {
        await teamsApi.subscribeToTeam(teamId);
        setSubscribedTeams(prev => {
          const newSet = new Set(prev);
          newSet.add(teamId);
          return newSet;
        });
      }
    } catch (err) {
      console.error('Error toggling subscription:', err);
      // You might want to show a toast notification here
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-gray-600">Loading teams...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-3xl font-semibold text-gray-900">Teams</h1>
          <p className="mt-2 text-sm text-gray-700">
            Subscribe to your favorite teams to receive updates about their matches and rankings.
          </p>
        </div>
      </div>

      <div className="mt-8 flow-root">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                      Rank
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Team
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Points
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Change
                    </th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Subscribe</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {teams.map((team) => (
                    <tr key={team.id}>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                        {team.rank}
                        {team.isNew && (
                          <span className="ml-2 inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                            New
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        <div className="flex items-center">
                          {team.logo && (
                            <img
                              src={team.logo}
                              alt={team.logoAlt || ''}
                              className="h-8 w-8 mr-3 rounded-full"
                            />
                          )}
                          <span className="font-medium text-gray-900">{team.name}</span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {team.points}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                            team.change > 0
                              ? 'bg-green-50 text-green-700 ring-green-600/20'
                              : team.change < 0
                              ? 'bg-red-50 text-red-700 ring-red-600/20'
                              : 'bg-gray-50 text-gray-700 ring-gray-600/20'
                          }`}
                        >
                          {team.change > 0 ? '+' : ''}
                          {team.change}
                        </span>
                      </td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <button
                          onClick={() => toggleSubscription(team.id)}
                          className={`rounded-md px-3 py-2 text-sm font-semibold shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                            subscribedTeams.has(team.id)
                              ? 'bg-primary-600 text-white hover:bg-primary-500 focus-visible:outline-primary-600'
                              : 'bg-white text-primary-600 ring-1 ring-inset ring-primary-600 hover:bg-primary-50'
                          }`}
                        >
                          {subscribedTeams.has(team.id) ? 'Subscribed' : 'Subscribe'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Teams; 