let googleMapsPlacesPromise = null;

const GOOGLE_MAPS_SCRIPT_ID = 'google-maps-places-js';

export async function loadGoogleMapsPlaces(apiKey) {
  if (typeof window === 'undefined') {
    throw new Error('Google Maps autocomplete works only in the browser.');
  }

  if (window.google?.maps?.importLibrary) {
    return window.google.maps;
  }

  if (!apiKey) {
    throw new Error('Missing VITE_GOOGLE_MAPS_API_KEY.');
  }

  if (!googleMapsPlacesPromise) {
    googleMapsPlacesPromise = new Promise((resolve, reject) => {
      const existingScript = document.getElementById(GOOGLE_MAPS_SCRIPT_ID);
      if (existingScript) {
        existingScript.addEventListener(
          'load',
          () => {
            resolve(window.google.maps);
          },
          { once: true },
        );
        existingScript.addEventListener(
          'error',
          () => {
            reject(new Error('Failed to load Google Maps script.'));
          },
          { once: true },
        );
        return;
      }

      // Підвантажуємо Places лише один раз і тільки в браузері.
      const callbackName = '__googleMapsPlacesReady';
      const previousCallback = window[callbackName];

      window[callbackName] = () => {
        if (typeof previousCallback === 'function') {
          previousCallback();
        }

        resolve(window.google.maps);
      };

      const script = document.createElement('script');
      script.id = GOOGLE_MAPS_SCRIPT_ID;
      script.async = true;
      script.defer = true;
      script.onerror = () => {
        reject(new Error('Failed to load Google Maps script.'));
      };
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async&libraries=places&v=weekly&callback=${callbackName}&language=cs&region=CZ`;

      document.head.appendChild(script);
    });
  }

  return googleMapsPlacesPromise;
}

export async function createAutocompleteSessionToken(apiKey) {
  const maps = await loadGoogleMapsPlaces(apiKey);
  await maps.importLibrary('places');
  const AutocompleteSessionToken = maps.places?.AutocompleteSessionToken;

  if (!AutocompleteSessionToken) {
    throw new Error('Google Maps Places session token is unavailable.');
  }

  // Сесія зменшує зайві білінг-запити під час набору адреси.
  return new AutocompleteSessionToken();
}

export async function fetchCzechAutocompleteSuggestions({ apiKey, input, sessionToken }) {
  const maps = await loadGoogleMapsPlaces(apiKey);
  await maps.importLibrary('places');
  const AutocompleteService = maps.places?.AutocompleteService;

  if (!AutocompleteService) {
    throw new Error('Google Maps autocomplete service is unavailable.');
  }

  const service = new AutocompleteService();

  const predictions = await new Promise((resolve, reject) => {
    const request = {
      input,
      componentRestrictions: { country: 'cz' },
    };

    if (sessionToken) {
      request.sessionToken = sessionToken;
    }

    service.getPlacePredictions(
      request,
      (results, status) => {
        if (status === maps.places.PlacesServiceStatus.OK || status === maps.places.PlacesServiceStatus.ZERO_RESULTS) {
          resolve(results || []);
          return;
        }

        reject(new Error(`Autocomplete failed with status: ${status || 'UNKNOWN'}`));
      },
    );
  });

  return predictions.map((prediction, index) => ({
    id: prediction.place_id || `${prediction.description}-${index}`,
    label: prediction.description,
    value: prediction.description,
  }));
}
