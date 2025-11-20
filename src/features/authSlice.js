// src/features/authSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";

const initialState = {
  user: null,
  loading: false,
  error: null,
  initialized: false,
};

// listen to auth
export const listenToAuth = createAsyncThunk(
  "auth/listenToAuth",
  async (_, { rejectWithValue }) =>
    new Promise((resolve, reject) => {
      onAuthStateChanged(
        auth,
        async (firebaseUser) => {
          if (!firebaseUser) {
            resolve(null);
            return;
          }
          const ref = doc(db, "doctors", firebaseUser.uid);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            resolve({ uid: firebaseUser.uid, ...snap.data() });
          } else {
            resolve({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
            });
          }
        },
        (err) => reject(rejectWithValue(err.message))
      );
    })
);

// signup
export const signupDoctor = createAsyncThunk(
  "auth/signupDoctor",
  async ({ name, email, password }, { rejectWithValue }) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const { uid } = cred.user;

      await setDoc(doc(db, "doctors", uid), {
        name,
        email,
        role: "doctor",
        createdAt: new Date(),
      });

      return { uid, name, email, role: "doctor" };
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

// login
export const loginDoctor = createAsyncThunk(
  "auth/loginDoctor",
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const { uid } = cred.user;

      const snap = await getDoc(doc(db, "doctors", uid));
      if (snap.exists()) {
        return { uid, ...snap.data() };
      }
      return { uid, email: cred.user.email };
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

// forgot password
export const resetPassword = createAsyncThunk(
  "auth/resetPassword",
  async (email, { rejectWithValue }) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return true;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

// logout
export const logoutDoctor = createAsyncThunk(
  "auth/logoutDoctor",
  async (_, { rejectWithValue }) => {
    try {
      await signOut(auth);
      return true;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    clearAuthError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // listen
      .addCase(listenToAuth.pending, (state) => {
        state.initialized = false;
      })
      .addCase(listenToAuth.fulfilled, (state, action) => {
        state.initialized = true;
        state.user = action.payload;
      })
      .addCase(listenToAuth.rejected, (state) => {
        state.initialized = true;
        state.user = null;
      })
      // signup
      .addCase(signupDoctor.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signupDoctor.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
      })
      .addCase(signupDoctor.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // login
      .addCase(loginDoctor.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginDoctor.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
      })
      .addCase(loginDoctor.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // reset
      .addCase(resetPassword.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(resetPassword.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(resetPassword.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // logout
      .addCase(logoutDoctor.fulfilled, (state) => {
        state.user = null;
      });
  },
});

export const { clearAuthError } = authSlice.actions;
export default authSlice.reducer;
