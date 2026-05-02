const calculateMatchScore = (user1, user2) => {
  let score = 0;

  // Intent match
  if (user1.intent === user2.intent) {
    score += 30;
  }

  // Personality similarity
  score += 10 - Math.abs(user1.personality_score - user2.personality_score);

  // Ambition similarity
  score += 10 - Math.abs(user1.ambition_score - user2.ambition_score);

  // Interest overlap
  const commonInterests = user1.interests.filter((i) =>
    user2.interests.includes(i)
  );

  score += commonInterests.length * 5;

  return score;
};

const findMatches = (currentUser, allUsers) => {
  const matches = allUsers
    .filter((user) => user.phone !== currentUser.phone)
    .map((user) => ({
      user,
      score: calculateMatchScore(currentUser, user),
    }))
    .sort((a, b) => b.score - a.score);

  return matches.slice(0, 5);
};

module.exports = { findMatches };