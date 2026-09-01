import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getFunctions } from 'firebase/functions'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBJgygPJSFqZ8KlAdhVVrhseBPI6hgbrdw",
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "mr-devs.firebaseapp.com",
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID || "mr-devs",
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "mr-devs.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "928226415627",
  appId:             import.meta.env.VITE_FIREBASE_APP_ID || "1:928226415627:web:a0d2b029ffd9d37085a30e",
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-JP9RVB09DH"
}

// Initialize Firebase App (Singleton instance)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)

// Export core Firebase service instances
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export const functions = getFunctions(app)

// Pre-configured OAuth Providers
export const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

export default app
