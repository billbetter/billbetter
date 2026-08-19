import React from "react";
import Login from "./Login";

/**
 * /Register is the same screen as /Login, mounted in signup mode.
 *
 * Sharing one component keeps the two pages from drifting apart — the Supabase
 * wiring, the OAuth error handling and the layout all live in Login.jsx.
 */
export default function Register() {
  return <Login defaultMode="signup" />;
}
