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
  const seen = tree.messagesSeenAt || '';
  return [...(tree.messages || []), ...(tree.verseComments || [])].some(message => message.at > seen);
}
