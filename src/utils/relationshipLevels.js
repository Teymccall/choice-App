export const getRelationshipLevel = (messageCount) => {
  if (messageCount >= 2001) return { level: 'Family', color: 'text-purple-600 dark:text-purple-400' };
  if (messageCount >= 1201) return { level: 'Soulmate', color: 'text-pink-600 dark:text-pink-400' };
  if (messageCount >= 801) return { level: 'Inner Circle', color: 'text-indigo-600 dark:text-indigo-400' };
  if (messageCount >= 501) return { level: 'Trusted Ally', color: 'text-blue-600 dark:text-blue-400' };
  if (messageCount >= 301) return { level: 'Best Friend', color: 'text-green-600 dark:text-green-400' };
  if (messageCount >= 151) return { level: 'Close Friend', color: 'text-yellow-600 dark:text-yellow-400' };
  if (messageCount >= 51) return { level: 'Friend', color: 'text-orange-600 dark:text-orange-400' };
  return { level: 'Acquaintance', color: 'text-gray-600 dark:text-gray-400' };
};

export const RELATIONSHIP_LEVELS = [
  { level: 'Acquaintance', minMessages: 0, maxMessages: 50 },
  { level: 'Friend', minMessages: 51, maxMessages: 150 },
  { level: 'Close Friend', minMessages: 151, maxMessages: 300 },
  { level: 'Best Friend', minMessages: 301, maxMessages: 500 },
  { level: 'Trusted Ally', minMessages: 501, maxMessages: 800 },
  { level: 'Inner Circle', minMessages: 801, maxMessages: 1200 },
  { level: 'Soulmate', minMessages: 1201, maxMessages: 2000 },
  { level: 'Family', minMessages: 2001, maxMessages: Infinity }
]; 