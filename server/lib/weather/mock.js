// mock.js — proveedor de clima de respaldo: devuelve el valor fijo de settings.
module.exports = function mockWeather(settings) {
  return { tempC: settings.weather.mockDefault.tempC, source: 'mock' };
};
