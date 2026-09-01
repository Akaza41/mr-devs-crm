import { useState, useEffect } from 'react'
import { auth, db } from './lib/firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore'
import Dashboard from './pages/Dashboard'
import AuthGuard from './components/AuthGuard'
import { logActivity } from './lib/activityLogger'
import { ACTIONS } from './lib/activityActions'

export default function App() {
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [unauthorized, setUnauthorized] = useState(false)

  // ── FIREBASE AUTHENTICATION & FIRESTORE PROFILE LISTENER ──
  useEffect(() => {
    let unsubscribeDoc = null

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUserProfile(null)
        setUnauthorized(false)
        setLoading(false)
        if (unsubscribeDoc) unsubscribeDoc()
        return
      }

      // Fetch or initialize profile in Firestore collection 'users'
      const userRef = doc(db, 'users', firebaseUser.uid)
      
      try {
        const userSnap = await getDoc(userRef)
        let profileData = null

        if (userSnap.exists()) {
          profileData = { id: userSnap.id, ...userSnap.data() }

          // Admin bootstrap check
          if (profileData.email?.toLowerCase() === 'mubeenahma1123@gmail.com' && profileData.role !== 'admin') {
            await setDoc(userRef, { role: 'admin' }, { merge: true })
            profileData.role = 'admin'
          }
        } else {
          // Initialize default profile for new Firebase Auth user
          const defaultRole = firebaseUser.email?.toLowerCase() === 'mubeenahma1123@gmail.com' ? 'admin' : 'sales'
          profileData = {
            id: firebaseUser.uid,
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || firebaseUser.email || 'Team Member',
            role: defaultRole,
            photoURL: firebaseUser.photoURL || null,
            active: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          }
          await setDoc(userRef, profileData)
        }

        setUserProfile(profileData)
        setUnauthorized(false)
        setLoading(false)

        // Log login activity
        logActivity({
          action: ACTIONS.USER_LOGGED_IN,
          entityType: 'profile',
          entityId: firebaseUser.uid
        })

        // Real-time listener for profile updates (e.g. role changes by admin)
        unsubscribeDoc = onSnapshot(userRef, (snapshot) => {
          if (snapshot.exists()) {
            setUserProfile({ id: snapshot.id, ...snapshot.data() })
          }
        })

      } catch (err) {
        console.error('Error hydrating user profile from Firestore:', err)
        setUserProfile(null)
        setLoading(false)
      }
    })

    return () => {
      unsubscribeAuth()
      if (unsubscribeDoc) unsubscribeDoc()
    }
  }, [])

  // ── LOGOUT LOGIC ──
  const handleLogout = async () => {
    setLoading(true)
    await signOut(auth)
    setUserProfile(null)
    setUnauthorized(false)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <AuthGuard loading={loading} userProfile={userProfile} unauthorized={unauthorized}>
        <Dashboard userProfile={userProfile} role={userProfile?.role} onLogout={handleLogout} />
      </AuthGuard>
    </div>
  )
}