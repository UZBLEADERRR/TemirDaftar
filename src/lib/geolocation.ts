import { apiCall } from './telegram';

/**
 * Request geolocation permission and send to server on each app launch
 */
export async function trackLocation(): Promise<void> {
  if (!navigator.geolocation) {
    console.warn('Geolocation not supported');
    return;
  }

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });
    });

    const { latitude: lat, longitude: lng } = position.coords;

    // Try reverse geocoding for address
    let address = '';
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&accept-language=uz`
      );
      const data = await res.json();
      address = data.display_name || '';
    } catch {}

    // Send to server
    await apiCall('/api/location', {
      method: 'POST',
      body: JSON.stringify({ lat, lng, address }),
    });
  } catch (err) {
    console.warn('Location tracking failed:', err);
  }
}
