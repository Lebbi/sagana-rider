package expo.modules.googleservices

import android.content.Context
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.Looper
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val FRESH_FIX_MS = 2 * 60 * 1000L

class GoogleServicesModule : Module() {
  private val listeners = mutableMapOf<Int, LocationListener>()

  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("React context is not ready")

  private val locationManager: LocationManager
    get() = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager

  override fun definition() = ModuleDefinition {
    Name("GoogleServices")

    Events("onLocation")

    Function("isGooglePlayServicesAvailable") {
      GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(context) == ConnectionResult.SUCCESS
    }

    // Android's own LocationManager, for phones where expo-location's fused provider has no Google services behind it.
    Function("startWatching") { watchId: Int, minTimeMs: Double, minDistanceM: Double ->
      stopWatching(watchId)
      val providers = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
        .filter { runCatching { locationManager.isProviderEnabled(it) }.getOrDefault(false) }
      if (providers.isEmpty()) {
        throw IllegalStateException("Location services are off")
      }
      val listener = object : LocationListener {
        override fun onLocationChanged(location: Location) = emit(watchId, location)
        override fun onProviderEnabled(provider: String) {}
        override fun onProviderDisabled(provider: String) {}
        @Deprecated("Required on Android 10 and older")
        override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
      }
      try {
        providers.forEach {
          locationManager.requestLocationUpdates(it, minTimeMs.toLong(), minDistanceM.toFloat(), listener, Looper.getMainLooper())
        }
        listeners[watchId] = listener
        providers.mapNotNull { locationManager.getLastKnownLocation(it) }
          .maxByOrNull { it.time }
          ?.takeIf { System.currentTimeMillis() - it.time < FRESH_FIX_MS }
          ?.let { emit(watchId, it) }
      } catch (e: SecurityException) {
        locationManager.removeUpdates(listener)
        throw IllegalStateException("Location permission not granted")
      }
    }

    Function("stopWatching") { watchId: Int -> stopWatching(watchId) }

    OnDestroy {
      listeners.keys.toList().forEach { stopWatching(it) }
    }
  }

  private fun stopWatching(watchId: Int) {
    listeners.remove(watchId)?.let { runCatching { locationManager.removeUpdates(it) } }
  }

  private fun emit(watchId: Int, location: Location) {
    sendEvent(
      "onLocation",
      mapOf(
        "watchId" to watchId,
        "latitude" to location.latitude,
        "longitude" to location.longitude,
        "altitude" to if (location.hasAltitude()) location.altitude else null,
        "accuracy" to if (location.hasAccuracy()) location.accuracy.toDouble() else null,
        "heading" to if (location.hasBearing()) location.bearing.toDouble() else null,
        "speed" to if (location.hasSpeed()) location.speed.toDouble() else null,
        "timestamp" to location.time.toDouble(),
      ),
    )
  }
}
