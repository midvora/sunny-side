// Browser geolocation, used by the request form and the roadside page. The position stays on the device
// until the visitor chooses to send it.

export interface Fix {
  lat: number;
  lon: number;
  accuracy: number;
}

export function getFix(): Promise<Fix> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('unsupported'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy }),
      (err) => reject(new Error(err.code === err.PERMISSION_DENIED ? 'denied' : err.code === err.TIMEOUT ? 'timeout' : 'unavailable')),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  });
}

export const mapsLink = (f: Fix): string => `https://www.google.com/maps?q=${f.lat.toFixed(6)},${f.lon.toFixed(6)}`;
export const coordText = (f: Fix): string => `${f.lat.toFixed(5)}, ${f.lon.toFixed(5)} (within about ${Math.max(5, Math.round(f.accuracy))} m)`;

export function explain(reason: string): string {
  switch (reason) {
    case 'denied':
      return 'Location sharing is blocked in your browser. You can type your location instead: mile marker, exit or cross street.';
    case 'timeout':
      return 'We couldn’t get a location fix in time. Try again, or type your location instead.';
    case 'unsupported':
      return 'This browser can’t share a location. Please type your location instead.';
    default:
      return 'We couldn’t find your location. Please type it instead: mile marker, exit or cross street.';
  }
}
