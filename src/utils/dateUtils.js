export const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const date = typeof timestamp === 'number' 
    ? new Date(timestamp) 
    : timestamp.toDate?.() || new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const formatDate = (timestamp) => {
  if (!timestamp) return '';
  const date = typeof timestamp === 'number' 
    ? new Date(timestamp) 
    : timestamp.toDate?.() || new Date(timestamp);
  return date.toLocaleDateString();
}; 