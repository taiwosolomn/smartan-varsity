const getCalendarDays = (currentDate) => {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayIndex = new Date(year, month, 1).getDay() || 7; // Mon = 1, Sun = 7
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();

  const days = [];

  // Prev month overflow buffer
  for (let i = firstDayIndex - 1; i > 0; i--) {
    days.push({
      date: new Date(year, month - 1, prevDays - i + 1),
      isOtherMonth: true
    });
  }

  // Active month days
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({
      date: new Date(year, month, d),
      isOtherMonth: false
    });
  }

  // Next month overflow buffer to complete grid weeks
  while (days.length % 7 !== 0) {
    const nextDaysCount = days.length - daysInMonth - (firstDayIndex - 1);
    days.push({
      date: new Date(year, month + 1, nextDaysCount + 1),
      isOtherMonth: true
    });
  }

  return days;
};

const date = new Date(2026, 6, 8); // July 2026
const days = getCalendarDays(date);
days.forEach((d, idx) => {
  console.log(`${idx}: ${d.date.toDateString()} (other: ${d.isOtherMonth})`);
});
