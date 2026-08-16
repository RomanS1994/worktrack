import { useEffect, useRef, useState } from 'react';

import { RequestLoader } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { createAutocompleteSessionToken, fetchCzechAutocompleteSuggestions } from './googleMapsAutocomplete.js';
import './addressAutocomplete.css';

export function AddressAutocompleteField({
  apiKey,
  ariaLabel,
  clearLabel,
  placeholder,
  value,
  onChange,
  onClear,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [sessionToken, setSessionToken] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const requestIdRef = useRef(0);
  const blurTimerRef = useRef(null);
  const autocompleteEnabled = Boolean(apiKey);
  const inputText = String(value ?? '').trim();

  useEffect(() => {
    return () => {
      if (blurTimerRef.current) {
        window.clearTimeout(blurTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setSuggestions([]);
      setIsLoading(false);
      setStatusMessage('');
      return;
    }

    if (!inputText) {
      setSuggestions([]);
      setIsLoading(false);
      setStatusMessage('');
      return;
    }

    if (!autocompleteEnabled) {
      setSuggestions([]);
      setIsLoading(false);
      setStatusMessage('Autocomplete is unavailable.');
      return;
    }

    const requestId = ++requestIdRef.current;
    setIsLoading(true);

    const timer = window.setTimeout(async () => {
      try {
        let nextToken = sessionToken;

        if (!nextToken) {
          try {
            nextToken = await createAutocompleteSessionToken(apiKey);
            setSessionToken(nextToken);
          } catch (error) {
            nextToken = null;
            setSessionToken(null);
          }
        }

        const results = await fetchCzechAutocompleteSuggestions({
          apiKey,
          input: inputText,
          sessionToken: nextToken,
        });

        if (requestId !== requestIdRef.current) {
          return;
        }

        setSuggestions(results);
        setStatusMessage(results.length ? '' : 'No address matches found.');
      } catch (error) {
        if (requestId !== requestIdRef.current) {
          return;
        }

        setSuggestions([]);
        setStatusMessage(error?.message || 'Google Maps autocomplete is unavailable.');
      } finally {
        if (requestId === requestIdRef.current) {
          setIsLoading(false);
        }
      }
    }, 220);

    return () => {
      window.clearTimeout(timer);
    };
  }, [autocompleteEnabled, apiKey, inputText, isOpen, sessionToken]);

  const handleFocus = () => {
    if (blurTimerRef.current) {
      window.clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }

    if (!autocompleteEnabled) {
      setIsOpen(true);
      setSuggestions([]);
      setStatusMessage(inputText ? 'Autocomplete is unavailable.' : '');
      return;
    }

    setIsOpen(true);
  };

  const handleBlur = () => {
    blurTimerRef.current = window.setTimeout(() => {
      setIsOpen(false);
    }, 120);
  };

  const handleInputChange = event => {
    const nextValue = event.target.value;
    onChange(nextValue);

    if (autocompleteEnabled) {
      if (blurTimerRef.current) {
        window.clearTimeout(blurTimerRef.current);
        blurTimerRef.current = null;
      }

      setIsOpen(true);
    } else {
      setIsOpen(true);
      setStatusMessage(nextValue.trim() ? 'Autocomplete is unavailable.' : '');
    }
  };

  const handleSelect = async suggestion => {
    if (suggestion.value) {
      onChange(suggestion.value);
      setIsOpen(false);
      setSuggestions([]);
      return;
    }

    const place = suggestion.placePrediction?.toPlace?.();

    if (!place) {
      return;
    }

    try {
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress'],
      });

      onChange(place.formattedAddress || place.displayName || suggestion.label);
      setSessionToken(null);
    } catch (error) {
      onChange(suggestion.label);
    } finally {
      setIsOpen(false);
      setSuggestions([]);
    }
  };

  return (
    <div className="addressAutocompleteField">
      <div className="addressAutocompleteControl">
        <input
          className="contractField-input"
          type="text"
          placeholder={placeholder}
          aria-label={ariaLabel}
          value={value}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleInputChange}
        />
        {value ? (
          <button className="contractField-clear" type="button" aria-label={clearLabel} onClick={onClear}>
            ×
          </button>
        ) : null}
      </div>

      {isOpen && inputText ? (
        <div className="addressAutocompleteMenu" role="listbox" aria-label={ariaLabel}>
          {isLoading ? (
            <div className="addressAutocompleteStatus">
              <RequestLoader inline size="sm" label="Searching..." />
            </div>
          ) : null}
          {!isLoading && statusMessage ? (
            <div className="addressAutocompleteStatus">{statusMessage}</div>
          ) : null}
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.id}
              className="addressAutocompleteItem"
              type="button"
              onMouseDown={event => event.preventDefault()}
              onClick={() => handleSelect(suggestion)}
            >
              <span className="addressAutocompleteIndex">
                {index + 1}.
              </span>
              <span className="addressAutocompleteText">{suggestion.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
