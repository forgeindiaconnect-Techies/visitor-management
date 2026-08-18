export const formatAppointmentDate = (date) => {
  if (!date) return "-";
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    return "-";
  }
  return parsedDate.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const formatAppointmentTime = (time) => {
  if (!time) return "-";
  if (typeof time === 'string' && (time.includes('AM') || time.includes('PM'))) {
    return time;
  }
  const [hours, minutes] = String(time).split(":");
  if (hours === undefined || minutes === undefined) {
    return time;
  }

  const date = new Date();
  date.setHours(Number(hours), Number(minutes), 0, 0);

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};
