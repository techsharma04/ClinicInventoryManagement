// src/app/store.js
import { configureStore } from "@reduxjs/toolkit";
import authReducer from "../features/authSlice";
import { Timestamp } from "firebase/firestore";

export const store = configureStore({
  reducer: {
    auth: authReducer,
  },

  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Allow Firestore Timestamp
        isSerializable: (value) => {
          if (value instanceof Timestamp) return true;
          return typeof value !== "function";
        },

        // Ignore paths that contain Timestamp
        ignoredActionPaths: ["payload.createdAt", "meta.arg.createdAt"],
        ignoredPaths: ["auth.user.createdAt"],
      },
    }),
});
