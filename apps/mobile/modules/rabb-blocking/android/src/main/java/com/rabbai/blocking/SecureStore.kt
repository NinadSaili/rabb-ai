package com.rabbai.blocking

import android.content.Context
import android.util.Base64
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.google.crypto.tink.Aead
import com.google.crypto.tink.KeyTemplates
import com.google.crypto.tink.aead.AeadConfig
import com.google.crypto.tink.integration.android.AndroidKeysetManager
import com.rabbai.blocking.logic.Window
import kotlinx.coroutines.flow.first
import org.json.JSONArray
import org.json.JSONObject

private val Context.dataStore by preferencesDataStore(name = "rabb_blocking")

/**
 * Encrypted DataStore. Selected package names and windows are encrypted with a Tink AEAD key held in the Android Keystore.
 * Package names never leave the device: nothing in this class logs or transmits them.
 */
class SecureStore(private val context: Context) {
    private val aead: Aead by lazy {
        AeadConfig.register()
        AndroidKeysetManager.Builder()
            .withSharedPref(context, "rabb_keyset", "rabb_keyset_prefs")
            .withKeyTemplate(KeyTemplates.get("AES256_GCM"))
            .withMasterKeyUri("android-keystore://rabb_master_key")
            .build().keysetHandle.getPrimitive(Aead::class.java)
    }

    private suspend fun read(key: String): String? {
        val raw = context.dataStore.data.first()[stringPreferencesKey(key)] ?: return null
        return runCatching { String(aead.decrypt(Base64.decode(raw, Base64.NO_WRAP), key.toByteArray()), Charsets.UTF_8) }.getOrNull()
    }

    private suspend fun write(key: String, value: String) {
        val enc = Base64.encodeToString(aead.encrypt(value.toByteArray(Charsets.UTF_8), key.toByteArray()), Base64.NO_WRAP)
        context.dataStore.edit { it[stringPreferencesKey(key)] = enc }
    }

    suspend fun selectedPackages(): Set<String> =
        read("selected")?.let { s -> JSONArray(s).let { a -> (0 until a.length()).map { a.getString(it) }.toSet() } } ?: emptySet()

    suspend fun setSelectedPackages(pkgs: Set<String>) = write("selected", JSONArray(pkgs.toList()).toString())

    suspend fun windows(): List<Window> =
        read("windows")?.let { s -> JSONArray(s).let { a -> (0 until a.length()).map { i -> a.getJSONObject(i).let { o -> Window(o.getString("id"), o.getLong("start"), o.getLong("end")) } } } } ?: emptyList()

    suspend fun setWindows(w: List<Window>) =
        write("windows", JSONArray(w.map { JSONObject().put("id", it.scheduleId).put("start", it.startMs).put("end", it.endMs) }).toString())

    suspend fun suspendedUntil(): Long = read("suspended_until")?.toLongOrNull() ?: 0L
    suspend fun setSuspendedUntil(ms: Long) = write("suspended_until", ms.toString())
    suspend fun heartbeat(): Long = read("heartbeat")?.toLongOrNull() ?: 0L
    suspend fun setHeartbeat(ms: Long) = write("heartbeat", ms.toString())
    suspend fun tier1Flag(): Boolean = read("flag_tier1") == "1"
    suspend fun accessibilityFlag(): Boolean = read("flag_accessibility") == "1"
    suspend fun setFlags(tier1: Boolean, accessibility: Boolean) { write("flag_tier1", if (tier1) "1" else "0"); write("flag_accessibility", if (accessibility) "1" else "0") }
}
