// Who is signed in, shared with everything inside <AuthGate>.
//   session: { username, isAdmin }
//   logout():  signs out (server cookie cleared) and returns to the login page
//   expired(): the server said 401 mid-session (user removed / password reset / timed out)
import { createContext, useContext } from "react";

export const SessionContext = createContext({ session: null, logout: () => {}, expired: () => {} });

export const useSession = () => useContext(SessionContext);
