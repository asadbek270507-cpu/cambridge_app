// hooks/useUser.js

import { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '../firebase';

export const useUser = () => {
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true); // optional: loading holat

  useEffect(() => {
    const auth = getAuth();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userRef = doc(firestore, 'users', user.uid);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            setRole(userSnap.data().role || 'student');
          } else {
            setRole('student');
          }
        } catch (error) {
          console.error('Error fetching user role:', error);
          setRole('student');
        }
      } else {
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { role, loading };
};
