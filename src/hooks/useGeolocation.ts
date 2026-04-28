import { useState, useEffect, useCallback } from 'react';

export interface GeolocationPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export interface GeolocationError {
  code: number;
  message: string;
  type: 'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT' | 'NOT_SUPPORTED';
}

export interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  watch?: boolean;
  onSuccess?: (position: GeolocationPosition) => void;
  onError?: (error: GeolocationError) => void;
}

export interface UseGeolocationReturn {
  position: GeolocationPosition | null;
  error: GeolocationError | null;
  loading: boolean;
  supported: boolean;
  getCurrentPosition: () => Promise<GeolocationPosition>;
  clearError: () => void;
  requestPermission: () => Promise<boolean>;
}

export function useGeolocation(options: UseGeolocationOptions = {}): UseGeolocationReturn {
  const {
    enableHighAccuracy = true,
    timeout = 10000,
    maximumAge = 300000, // 5 minutes
    watch = false,
    onSuccess,
    onError
  } = options;

  const [position, setPosition] = useState<GeolocationPosition | null>(null);
  const [error, setError] = useState<GeolocationError | null>(null);
  const [loading, setLoading] = useState(false);
  const [watchId, setWatchId] = useState<number | null>(null);

  const supported = 'geolocation' in navigator;

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const handleSuccess = useCallback((pos: any) => {
    // Supports both browser GeolocationPosition ({ coords }) and our normalized shape
    // ({ latitude, longitude, accuracy, timestamp }).
    const newPosition: GeolocationPosition = pos?.coords
      ? {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        }
      : {
          latitude: pos.latitude,
          longitude: pos.longitude,
          accuracy: pos.accuracy ?? 0,
          timestamp: pos.timestamp ?? Date.now(),
        };
    
    setPosition(newPosition);
    setError(null);
    setLoading(false);
    onSuccess?.(newPosition);
  }, [onSuccess]);

  const handleError = useCallback((err: GeolocationPositionError) => {
    let errorType: GeolocationError['type'];
    let message: string;

    switch (err.code) {
      case err.PERMISSION_DENIED:
        errorType = 'PERMISSION_DENIED';
        message = 'Location access denied. Please enable location permissions to find services near you.';
        break;
      case err.POSITION_UNAVAILABLE:
        errorType = 'POSITION_UNAVAILABLE';
        message = 'Location information is unavailable. Please try again later.';
        break;
      case err.TIMEOUT:
        errorType = 'TIMEOUT';
        message = 'Location request timed out. Please try again.';
        break;
      default:
        errorType = 'POSITION_UNAVAILABLE';
        message = 'An unknown error occurred while retrieving your location.';
    }

    const geolocationError: GeolocationError = {
      code: err.code,
      message,
      type: errorType
    };

    setError(geolocationError);
    setLoading(false);
    onError?.(geolocationError);
  }, [onError]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!supported) {
      setError({
        code: -1,
        message: 'Geolocation is not supported by this browser.',
        type: 'NOT_SUPPORTED'
      });
      return false;
    }

    try {
      // Check if permissions API is available
      if ('permissions' in navigator) {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        
        if (permission.state === 'denied') {
          setError({
            code: 1,
            message: 'Location access is permanently denied. Please enable it in your browser settings.',
            type: 'PERMISSION_DENIED'
          });
          return false;
        }
        
        if (permission.state === 'granted') {
          return true;
        }
      }

      // Try to get position to trigger permission prompt
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => {
            clearError();
            resolve(true);
          },
          (err) => {
            handleError(err);
            resolve(false);
          },
          { enableHighAccuracy: false, timeout: 5000 }
        );
      });
    } catch {
      setError({
        code: -1,
        message: 'Failed to request location permission.',
        type: 'NOT_SUPPORTED'
      });
      return false;
    }
  }, [supported, clearError, handleError]);

  const getCurrentPosition = useCallback((): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!supported) {
        const error: GeolocationError = {
          code: -1,
          message: 'Geolocation is not supported by this browser.',
          type: 'NOT_SUPPORTED'
        };
        setError(error);
        reject(error);
        return;
      }

      setLoading(true);
      setError(null);

      // Safety net: some environments can hang without calling either callback.
      const fallbackTimer = window.setTimeout(() => {
        const timeoutError: GeolocationError = {
          code: 3,
          message: 'Location request timed out. Please try again.',
          type: 'TIMEOUT'
        };
        setError(timeoutError);
        setLoading(false);
        reject(timeoutError);
      }, timeout + 1500);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          window.clearTimeout(fallbackTimer);
          const newPosition: GeolocationPosition = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            timestamp: pos.timestamp
          };
          handleSuccess(newPosition);
          resolve(newPosition);
        },
        (err) => {
          window.clearTimeout(fallbackTimer);
          handleError(err);
          reject(err);
        },
        {
          enableHighAccuracy,
          timeout,
          maximumAge
        }
      );
    });
  }, [supported, enableHighAccuracy, timeout, maximumAge, handleSuccess, handleError]);

  // Effect for watching position
  useEffect(() => {
    if (!supported || !watch) return;

    const id = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      {
        enableHighAccuracy,
        timeout,
        maximumAge
      }
    );

    setWatchId(id);

    return () => {
      if (id) {
        navigator.geolocation.clearWatch(id);
      }
    };
  }, [supported, watch, enableHighAccuracy, timeout, maximumAge, handleSuccess, handleError]);

  // Cleanup watch on unmount
  useEffect(() => {
    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  return {
    position,
    error,
    loading,
    supported,
    getCurrentPosition,
    clearError,
    requestPermission
  };
}