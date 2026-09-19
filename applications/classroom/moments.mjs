// A celebration is a presentation of a teacher's validation, never a validation itself.
export function queueTreeMoment(tree, before, total, now = new Date().toISOString()) {
  if (tree.verses.length <= before.verses && !(!before.completed && tree.completedAt)) return null;
  const previous = tree.moment && !tree.moment.seenAt ? tree.moment.from : Math.round(before.verses / total * 100);
  tree.moment = {
    id: `${now}:${tree.verses.length}`, at: now, from: previous,
    to: Math.round(tree.verses.length / total * 100), complete: Boolean(tree.completedAt), seenAt: null
  };
  return tree.moment;
}

export function nextTreeMoment(student) {
  return Object.entries(student?.trees || {}).filter(([, tree]) => tree.moment && !tree.moment.seenAt)
    .sort((a, b) => a[1].moment.at.localeCompare(b[1].moment.at))[0] || null;
}

export function hasUnreadTreeMessage(tree) {
  const seen = Date.parse(tree.messagesSeenAt || '') || 0;
  return [...(tree.messages || []), ...(tree.verseComments || [])]
    .some(message => (Date.parse(message.at || '') || 0) > seen);
}

// Use the newest message timestamp instead of the device clock. This keeps the
// envelope dismissed even when a phone and the server are a few minutes apart.
export function markTreeMessagesSeen(tree) {
  const newest = [...(tree.messages || []), ...(tree.verseComments || [])]
    .reduce((latest, message) => Math.max(latest, Date.parse(message.at || '') || 0), 0);
  if (!newest) return false;
  tree.messagesSeenAt = new Date(newest).toISOString();
  return true;
}

// Present global encouragements and verse feedback together, newest first.
export function treeMessages(tree) {
  return [
    ...(tree.messages || []).map(message => ({...message, kind: 'global'})),
    ...(tree.verseComments || []).map(message => ({...message, kind: 'verse'}))
  ].sort((a, b) => new Date(b.at) - new Date(a.at));
}
