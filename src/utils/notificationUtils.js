export const normalizeNotifications = (value) => {
  if (Array.isArray(value)) {
    return value;
  }
  if (Array.isArray(value?.notifications)) {
    return value.notifications;
  }
  if (Array.isArray(value?.data?.notifications)) {
    return value.data.notifications;
  }
  if (Array.isArray(value?.data)) {
    return value.data;
  }
  return [];
};
