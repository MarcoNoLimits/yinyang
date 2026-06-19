import * as React from "react";
import { useState } from "react";
import LoginNav from "../components/LoginNav";
import { useNavigate } from "react-router-dom";
import Auth from "../utils/Auth";
import { supabase } from "../config/supabaseClient";
import { uniqueNamesGenerator, adjectives, animals } from "unique-names-generator";

function Login() {
  const [isEmailClicked, setIsEmailClicked] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleEmailClick = () => {
    setIsEmailClicked(true);
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      let email = username;

      // If the input username does not contain '@', select the email from users table
      if (!username.includes("@")) {
        const { data: userProfile, error: userError } = await supabase
          .from("users")
          .select("email")
          .eq("username", username)
          .single();

        if (userError || !userProfile) {
          setError("Username not found");
          return;
        }
        email = userProfile.email;
      }

      // Perform signInWithPassword
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      const token = signInData.session?.access_token;
      if (token) {
        localStorage.setItem("jwtToken", token);
        Auth.login(token);
      }

      // Fetch user's role and details from the users profile table
      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("*")
        .eq("user_id", signInData.user?.id)
        .single();

      if (profileError || !profile) {
        setError("Failed to fetch user profile details.");
        return;
      }

      const userRole = profile.role;
      const profileUsername = profile.username;

      if (userRole === "admin") {
        navigate("/AdminDashboard", { state: { username: profileUsername } });
      } else if (userRole === "moderator") {
        navigate("/Moderator", { state: { username: profileUsername } });
      } else {
        navigate("/", { state: { username: profileUsername } });
      }

    } catch (error: any) {
      console.error("Error logging in:", error);
      setError(error.message || "An error occurred while logging in");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#212121] relative overflow-x-hidden">
      <LoginNav username={username} />

      <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[95vw] max-w-[900px] h-[50vh] max-h-[450px] rounded-[20px] md:rounded-[30px] shadow-2xl overflow-hidden">
        <img
          src="https://media.giphy.com/media/wM2jsoKbVTur6/giphy.gif"
          alt="GIF Animation"
          className="w-full h-full object-cover"
        />
      </div>

      <div
        className={`absolute bg-[#121212] p-4 sm:p-6 rounded-xl md:rounded-2xl shadow-lg text-white w-[95vw] max-w-[350px] transition-all duration-500 ease-in-out ${
          isEmailClicked
            ? "top-[calc(50%+20vh)] md:top-[calc(50%+110px)] left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-auto min-h-[300px] md:min-h-[400px]"
            : "left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 md:left-[calc(40%-520px)] md:-translate-x-0"
        }`}
      >
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-center">
          Get access to your favorite characters!
        </h2>
        <p className="text-gray-400 text-[11px] sm:text-sm mt-1 md:mt-2 text-center">
          Sign up in just ten seconds
        </p>

        <div className="mt-3 sm:mt-4 space-y-2 sm:space-y-3">
          {!isEmailClicked ? (
            <>
              <button
                onClick={handleEmailClick}
                className="w-full bg-white text-black flex items-center justify-center gap-1 p-1.5 sm:p-2 rounded-md shadow text-xs sm:text-sm md:text-base"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  className="w-3 h-3 sm:w-4 sm:h-4 md:w-6 md:h-6"
                  fill="currentColor"
                >
                  <path d="M2 4.5A2.5 2.5 0 0 1 4.5 2h15A2.5 2.5 0 0 1 22 4.5v15a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 19.5v-15zM4.5 4a.5.5 0 0 0-.5.5V6l8 5 8-5V4.5a.5.5 0 0 0-.5-.5h-15zM20 8.2l-7.5 4.7a1 1 0 0 1-1 0L4 8.2V19.5a.5.5 0 0 0 .5.5h15a.5.5 0 0 0 .5-.5V8.2z" />
                </svg>
                Continue with Email
              </button>

              <button
                onClick={async () => {
                  const randomName: string = uniqueNamesGenerator({
                    dictionaries: [adjectives, animals],
                  });
                  setUsername(randomName);
                  setPassword("Guest123!");
                  const guestEmail = `${randomName.toLowerCase()}@guest.com`;
                  const guestPassword = "Guest123!";

                  try {
                    // Sign up the guest user in Supabase with metadata
                    const { error: signUpError } = await supabase.auth.signUp({
                      email: guestEmail,
                      password: guestPassword,
                      options: {
                        data: {
                          first_name: randomName,
                          surname: "Guest",
                          username: randomName,
                          role: "user",
                        },
                      },
                    });

                    if (signUpError) {
                      setError(signUpError.message);
                      return;
                    }

                    // Sign in the guest user
                    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                      email: guestEmail,
                      password: guestPassword,
                    });

                    if (signInError) {
                      setError(signInError.message);
                      return;
                    }

                    const token = signInData.session?.access_token;
                    if (token) {
                      localStorage.setItem("jwtToken", token);
                      Auth.login(token);
                    }

                    // Fetch profile details
                    const { data: profile, error: profileError } = await supabase
                      .from("users")
                      .select("*")
                      .eq("user_id", signInData.user?.id)
                      .single();

                    if (profileError || !profile) {
                      setError("Failed to fetch guest profile details.");
                      return;
                    }

                    setError("User registered successfully!");
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    navigate("/", { state: { username: profile.username } });
                  } catch (error) {
                    console.error("Guest login failed:", error);
                    setError("Failed to connect to Supabase");
                  }
                }}
                className="cursor-pointer w-full bg-gray-900 text-white flex items-center justify-center gap-1 p-1.5 sm:p-2 rounded-md shadow text-xs sm:text-sm md:text-base"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  className="w-3 h-3 sm:w-4 sm:h-4 md:w-6 md:h-6"
                  fill="currentColor"
                >
                  <path d="M12 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm-6 14a6 6 0 0 1 12 0v4a1 1 0 0 1-2 0v-4a4 4 0 1 0-8 0v4a1 1 0 0 1-2 0v-4z" />
                </svg>
                Continue as Guest
              </button>

              <div className="flex items-center justify-center text-gray-500 text-[10px] sm:text-xs md:text-sm">
                OR
              </div>

              <button
                onClick={() => navigate("/SignUp")}
                className="w-full bg-gray-800 text-white flex items-center justify-center gap-1 p-1.5 sm:p-2 rounded-md shadow text-xs sm:text-sm md:text-base"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  className="w-3 h-3 sm:w-4 sm:h-4 md:w-6 md:h-6"
                  fill="currentColor"
                >
                  <path d="M2 4.5A2.5 2.5 0 0 1 4.5 2h15A2.5 2.5 0 0 1 22 4.5v15a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 19.5v-15zM4.5 4a.5.5 0 0 0-.5.5V6l8 5 8-5V4.5a.5.5 0 0 0-.5-.5h-15zM20 8.2l-7.5 4.7a1 1 0 0 1-1 0L4 8.2V19.5a.5.5 0 0 0 .5.5h15a.5.5 0 0 0 .5-.5V8.2z" />
                </svg>
                Sign up
              </button>
            </>
          ) : (
            <form onSubmit={handleLogin} className="space-y-2 sm:space-y-3">
              <input
                type="text"
                placeholder="Email or Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full p-1.5 sm:p-2 bg-gray-900 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-white text-xs sm:text-sm md:text-base"
              />
              
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-1.5 sm:p-2 bg-gray-900 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-white text-xs sm:text-sm md:text-base pr-8"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  {showPassword ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      className="w-4 h-4 sm:w-5 sm:h-5"
                      fill="currentColor"
                    >
                      <path d="M12 5c4.378 0 8.275 2.943 9.593 7.054a1 1 0 0 1 0 .892C20.275 17.057 16.378 20 12 20s-8.275-2.943-9.593-7.054a1 1 0 0 1 0-.892C3.725 7.943 7.622 5 12 5zm0 2a8 8 0 0 0-7.032 4.125C5.403 13.66 8.23 16 12 16s6.597-2.34 7.032-4.875A8 8 0 0 0 12 7zm0 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"/>
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      className="w-4 h-4 sm:w-5 sm:h-5"
                      fill="currentColor"
                    >
                      <path d="M2.808 1.393l19.799 19.8-1.415 1.414-3.608-3.608-2.673 2.673a8 8 0 0 1-9.879-1.901l-1.838 1.837-1.414-1.414 1.837-1.838a7.963 7.963 0 0 1-2.696-3.804A1 1 0 0 1 2.93 13H5v-2H2.93a1 1 0 0 1-.997-.923c-.055-.677-.108-1.276.217-1.885C2.756 7.024 3.345 5.71 4.282 4.45L1.393 2.808l1.415-1.415zM20.515 16.846l-1.592-1.592c.204-.458.375-.918.513-1.36a1 1 0 0 1 .997-.923H19v2h1.07c-.03.298-.064.59-.107.876zm-2.86-2.86l-1.473-1.473c.509-.157.92-.52 1.122-1.013.313-.76.204-1.638-.222-2.554C16.716 7.755 14.91 7 12 7c-.652 0-1.274.067-1.862.192L8.333 5.36a8.019 8.019 0 0 1 3.667-.36c3.377.476 6.168 2.694 7.395 5.276.112.233.215.47.306.711a9.954 9.954 0 0 1-1.086 2.239z"/>
                    </svg>
                  )}
                </button>
              </div>

              {error && (
                <p className="text-red-500 text-xs sm:text-sm">{error}</p>
              )}
              <button
                type="submit"
                className="w-full bg-white hover:bg-gray-300 text-black p-1.5 sm:p-2 rounded-md shadow text-xs sm:text-sm md:text-base cursor-pointer"
              >
                Log In
              </button>
            </form>
          )}
          <p className="text-xs text-gray-400 mt-2 sm:mt-3 text-center">
            Forgot your password?{" "}
            <span
              className="text-blue-400 cursor-pointer hover:underline"
              onClick={() => navigate("/ResetPassword")}
            >
              Reset it here
            </span>
          </p>
          <p className="text-[9px] xs:text-[10px] sm:text-xs text-gray-500 mt-2 sm:mt-3 text-center">
            By continuing, you agree with the{" "}
            <a href="/TermsOfService" className="underline">
              Terms
            </a>{" "}
            and{" "}
            <a href="/PrivacyPolicy" className="underline">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;