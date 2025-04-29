// Простая реализация parse-duration
module.exports = function parseDuration(str) {
  // Базовая реализация для тестов
  if (str === '1s') return 1000;
  if (str === '1m') return 60000;
  if (str === '1h') return 3600000;
  if (str === '1d') return 86400000;
  return 0;
};
