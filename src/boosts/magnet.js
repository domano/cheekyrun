// Magnet: while active the pickup pull jumps to a big radius floor, vacuuming
// nearby ground rolls onto your line (air ribbons are still earned by jumping).
export default {
  id: 'magnet',
  icon: '🧲',
  color: 0x4fd0ff,
  label: 'Magnet',
  order: 10,
  magnetFloor: 9,   // magnet radius is raised to at least this while active
};
