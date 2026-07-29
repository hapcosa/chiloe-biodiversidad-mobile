package cl.chiloe.biodiversidad.share

import android.content.Intent
import android.content.pm.PackageManager
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

private const val INSTAGRAM_PACKAGE = "com.instagram.android"
private const val FACEBOOK_PACKAGE = "com.facebook.katana"

class SocialShareModule(
    private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
    override fun getName(): String = "SocialShare"

    // Comparte una foto local a Instagram o Facebook Stories usando los intents
    // nativos de cada plataforma (com.instagram.share.ADD_TO_STORY /
    // com.facebook.stories.ADD_TO_STORY). Si ninguna app está instalada, cae a
    // un selector genérico (ACTION_SEND). Nunca sube la foto a un servidor
    // propio — el share es puramente cliente a cliente.
    @ReactMethod
    fun shareToStory(localPath: String, promise: Promise) {
        try {
            val file = File(localPath)
            if (!file.exists()) {
                promise.reject("share_file_missing", "El archivo de la foto no existe: $localPath")
                return
            }

            val authority = "${reactContext.packageName}.fileprovider"
            val uri = FileProvider.getUriForFile(reactContext, authority, file)

            val target = when {
                isInstalled(INSTAGRAM_PACKAGE) -> "instagram"
                isInstalled(FACEBOOK_PACKAGE) -> "facebook"
                else -> "chooser"
            }

            val intent = when (target) {
                "instagram" -> Intent("com.instagram.share.ADD_TO_STORY").apply {
                    setDataAndType(uri, "image/*")
                    putExtra("interactive_asset_uri", uri)
                    setPackage(INSTAGRAM_PACKAGE)
                }
                "facebook" -> Intent("com.facebook.stories.ADD_TO_STORY").apply {
                    setDataAndType(uri, "image/*")
                    putExtra("interactive_asset_uri", uri)
                    setPackage(FACEBOOK_PACKAGE)
                }
                else -> Intent(Intent.ACTION_SEND).apply {
                    type = "image/*"
                    putExtra(Intent.EXTRA_STREAM, uri)
                }
            }
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)

            val activity = reactContext.currentActivity
            val launchIntent =
                if (target == "chooser") Intent.createChooser(intent, "Compartir encuentro") else intent
            if (activity != null) {
                activity.startActivity(launchIntent)
            } else {
                launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                reactContext.startActivity(launchIntent)
            }

            promise.resolve(target)
        } catch (error: Throwable) {
            promise.reject("share_failed", error)
        }
    }

    private fun isInstalled(packageName: String): Boolean = try {
        reactContext.packageManager.getPackageInfo(packageName, 0)
        true
    } catch (error: PackageManager.NameNotFoundException) {
        false
    }
}
